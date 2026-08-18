/**
 * webchat — a browser chat channel for an agent.
 *
 * The app (`app/`) talks to this plugin's inbox at
 * `/webhook/<agent>/webchat/api/*`; the agent talks back through the seeded
 * `scripts/webchat/webchat-cli`. Messages land on the thread named in config
 * (`threadId`, default `main`) — the SAME thread telegram routes to — so the
 * web panel and Telegram are one conversation, not two.
 *
 * Endpoints
 *   POST api/upload   raw body + `x-file-name`  → stores in inbox/, returns {name}
 *   POST api/send     {text, attachments?[]}    → transcript + notify(agent)
 *   GET  api/messages ?since=<id>|?before=<id>  → {messages, hasMore, pending, cursor}
 *                     &limit=<n>                (newest n of that window)
 *   GET  api/file     ?name=<stored name>       → the bytes
 *   POST api/reset                              → wipe thread context + transcript
 *   POST api/reply    {text, attachments?[]}    → agent's reply (CLI only)
 *
 * Auth is two-sided, because the two sides are different callers:
 *   - browser routes (upload/send/messages/file/reset) require a valid harness
 *     session — the plugin forwards the request's cookie to the harness's own
 *     `/api/auth/me`. The webhook prefix is NOT authenticated by the router, so
 *     without this anyone who can reach the port could chat as the operator and
 *     drop files on the agent's disk.
 *   - `api/reply` requires COGNISPHERE_WEBHOOK_SECRET, which only in-harness
 *     processes (i.e. the agent) have.
 *
 * ponytail: transcript is an append-only JSONL read into memory at start, and
 *   the browser polls `api/messages`. No SSE, no DB. Swap to SSE if a poll
 *   every 2s ever shows up in a profile.
 */
import { createReadStream } from "node:fs";
import {
  appendFile,
  copyFile,
  mkdir,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

interface WebchatConfig {
  threadId: string;
  maxUploadMb: number;
  pendingTimeoutSec: number;
  historyLimit: number;
}

interface ChatFile {
  name: string; // stored name, unique within inbox/outbox
  label: string; // original file name, for display
  mime: string;
  size: number;
  dir: "inbox" | "outbox";
}

interface ChatMessage {
  id: number;
  at: number;
  role: "user" | "agent";
  text: string;
  files: ChatFile[];
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".json": "application/json",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Strip anything that could escape the inbox/outbox dir, keep it recognisable. */
function safeName(raw: string): string {
  const base = basename(raw).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  return base.replace(/^\.+/, "") || "file";
}

export default class WebchatPlugin {
  manifest = {
    displayName: "Web Chat",
    description:
      "Browser chat channel. Inbox at /webhook/<agent>/webchat/api/*; the agent replies with scripts/webchat/webchat-cli.",
    configSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          default: "main",
          description:
            "Thread web messages are delivered to. Defaults to `main` so the web panel shares context with telegram's main route.",
        },
        maxUploadMb: { type: "number", default: 25 },
        pendingTimeoutSec: {
          type: "number",
          default: 900,
          description:
            "How long the 'agent is working' indicator may stay up without a reply before the UI stops showing it.",
        },
        historyLimit: {
          type: "number",
          default: 200,
          description: "Messages kept in memory / returned to the browser.",
        },
      },
      additionalProperties: false,
    },
    secretsSchema: { type: "object", properties: {}, additionalProperties: false },
  };

  private ctx?: any;
  private cfg!: WebchatConfig;
  private messages: ChatMessage[] = [];
  private nextId = 1;
  /** When the last user message was handed to the agent; null once answered. */
  private pendingSince: number | null = null;
  private transcriptPath = "";
  private outboxDir = "";
  private apiBase = "";

  async start(ctx: any): Promise<void> {
    this.ctx = ctx;
    this.cfg = ctx.config as WebchatConfig;
    this.transcriptPath = join(ctx.stateDir, "transcript.jsonl");
    this.outboxDir = join(ctx.stateDir, "outbox");
    await mkdir(ctx.inboxDir, { recursive: true });
    await mkdir(this.outboxDir, { recursive: true });

    // httpBaseUrl is `<server>/webhook/<agent>/webchat` — the harness's own API
    // sits at the same origin, which is what we need for session checks.
    this.apiBase = String(ctx.httpBaseUrl ?? "").split("/webhook/")[0];
    if (!this.apiBase) {
      ctx.log.error(
        "webchat: no httpBaseUrl — session checks cannot run, browser endpoints will refuse every request",
      );
    }

    try {
      const raw = await readFile(this.transcriptPath, "utf8");
      this.messages = raw
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as ChatMessage);
      this.nextId = (this.messages[this.messages.length - 1]?.id ?? 0) + 1;
      this.trim();
    } catch {
      /* no transcript yet */
    }
    ctx.log.info(
      { threadId: this.cfg.threadId, messages: this.messages.length },
      "webchat started",
    );
  }

  async stop(): Promise<void> {
    this.ctx = undefined;
  }

  private trim() {
    const extra = this.messages.length - this.cfg.historyLimit;
    if (extra > 0) this.messages.splice(0, extra);
  }

  private async record(m: Omit<ChatMessage, "id">): Promise<ChatMessage> {
    const msg: ChatMessage = { ...m, id: this.nextId++ };
    this.messages.push(msg);
    this.trim();
    await appendFile(this.transcriptPath, JSON.stringify(msg) + "\n");
    return msg;
  }

  /** True while the agent owes an answer and hasn't timed out. */
  private isPending(): boolean {
    if (this.pendingSince === null) return false;
    if (Date.now() - this.pendingSince > this.cfg.pendingTimeoutSec * 1000) {
      this.pendingSince = null;
      return false;
    }
    return true;
  }

  /** Ask the harness whose session this cookie is. Null = not signed in. */
  private async sessionUser(cookie: string): Promise<string | null> {
    if (!this.apiBase || !cookie) return null;
    try {
      const res = await fetch(`${this.apiBase}/api/auth/me`, {
        headers: { cookie },
      });
      if (!res.ok) return null;
      // /me answers 200 {"user":null} for a bad session — the status is not the answer.
      const body = (await res.json()) as { user?: string | null };
      return body.user ?? null;
    } catch {
      return null; // harness unreachable: fail closed
    }
  }

  async handleHttpRequest(req: any, res: any): Promise<void> {
    const ctx = this.ctx;
    const json = (code: number, obj: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (!ctx) return json(503, { error: "plugin not started" });

    const url = new URL(req.url || "/", "http://local");
    const path = url.pathname;

    try {
      // --- agent side: only in-harness callers (they hold the boot secret) ---
      if (req.method === "POST" && path === "/api/reply") {
        const expected = process.env.COGNISPHERE_WEBHOOK_SECRET;
        if (expected && req.headers["x-webhook-secret"] !== expected)
          return json(401, { error: "missing or invalid X-Webhook-Secret" });
        const b = await this.readJson(req);
        const text = String(b.text ?? "").trim();
        const paths = Array.isArray(b.attachments) ? b.attachments : [];
        if (!text && paths.length === 0)
          return json(400, { error: "text or attachments required" });
        const files: ChatFile[] = [];
        for (const p of paths) {
          const src = resolve(ctx.agentDir, String(p));
          if (!src.startsWith(resolve(ctx.agentDir)))
            return json(400, { error: `attachment outside agent dir: ${p}` });
          const label = basename(src);
          const name = `${Date.now()}-${files.length}-${safeName(label)}`;
          await copyFile(src, join(this.outboxDir, name));
          const st = await stat(src);
          files.push({
            name,
            label,
            mime: MIME[extname(label).toLowerCase()] ?? "application/octet-stream",
            size: st.size,
            dir: "outbox",
          });
        }
        const msg = await this.record({
          at: Date.now(),
          role: "agent",
          text,
          files,
        });
        this.pendingSince = null; // answered — drop the "working" indicator
        return json(200, { ok: true, id: msg.id });
      }

      // --- browser side: everything below needs a real harness session ---
      const user = await this.sessionUser(String(req.headers.cookie ?? ""));
      if (!user) return json(401, { error: "unauthorized" });

      if (req.method === "GET" && path === "/api/messages") {
        const since = Number(url.searchParams.get("since") ?? 0);
        const before = Number(url.searchParams.get("before") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 0);
        // `since` walks forward (the poll); `before` walks backward (the
        // panel's "load earlier"). `limit` keeps the newest slice of whichever
        // window was asked for — the poll leaves it off so it can never drop a
        // message it is the only one delivering.
        const window =
          before > 0
            ? this.messages.filter((m) => m.id < before)
            : this.messages.filter((m) => m.id > since);
        const messages = limit > 0 ? window.slice(-limit) : window;
        return json(200, {
          messages,
          hasMore: messages.length < window.length,
          pending: this.isPending(),
          cursor: this.messages[this.messages.length - 1]?.id ?? 0,
        });
      }

      if (req.method === "GET" && path === "/api/file") {
        const name = safeName(url.searchParams.get("name") ?? "");
        const file = this.messages
          .flatMap((m) => m.files)
          .find((f) => f.name === name);
        if (!file) return json(404, { error: "unknown attachment" });
        const dir = file.dir === "outbox" ? this.outboxDir : ctx.inboxDir;
        const path = join(dir, name);
        // Length from the bytes on disk, never from `file.size` — that one is
        // client-declared for uploads, and a Content-Length that disagrees with
        // the body truncates or hangs the response.
        let bytes: number;
        try {
          bytes = (await stat(path)).size;
        } catch {
          return json(404, { error: "attachment missing on disk" });
        }
        res.writeHead(200, {
          "content-type": file.mime,
          "content-length": String(bytes),
          // Audio needs range support to be seekable in the player.
          "accept-ranges": "bytes",
          "content-disposition": `inline; filename="${file.label.replace(/"/g, "")}"`,
        });
        createReadStream(path).pipe(res);
        return;
      }

      if (req.method === "POST" && path === "/api/upload") {
        const label = safeName(String(req.headers["x-file-name"] ?? "upload"));
        const max = this.cfg.maxUploadMb * 1024 * 1024;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > max)
            return json(413, { error: `file exceeds ${this.cfg.maxUploadMb}MB` });
          chunks.push(c as Buffer);
        }
        const name = `${Date.now()}-${safeName(label)}`;
        await writeFile(join(ctx.inboxDir, name), Buffer.concat(chunks));
        return json(200, {
          name,
          label,
          size,
          mime:
            String(req.headers["content-type"] ?? "") ||
            MIME[extname(label).toLowerCase()] ||
            "application/octet-stream",
        });
      }

      if (req.method === "POST" && path === "/api/send") {
        const b = await this.readJson(req);
        const text = String(b.text ?? "").trim();
        const uploads = Array.isArray(b.attachments) ? b.attachments : [];
        if (!text && uploads.length === 0)
          return json(400, { error: "text or attachments required" });

        const files: ChatFile[] = uploads.map((u: any) => ({
          name: safeName(String(u.name ?? "")),
          label: String(u.label ?? u.name ?? "file"),
          mime: String(u.mime ?? "application/octet-stream"),
          size: Number(u.size ?? 0),
          dir: "inbox" as const,
        }));

        const msg = await this.record({
          at: Date.now(),
          role: "user",
          text,
          files,
        });

        // Attachment paths are inlined in the body (same shape telegram uses)
        // so the agent can `read` them without reconstructing a path, and also
        // listed in metadata for anything that wants them structured.
        const rel = files.map((f) => join("plugins/webchat/inbox", f.name));
        const body =
          text +
          files
            .map((f, i) => `\n<${f.label}>[${rel[i]}]`)
            .join("");

        ctx.notify("web_message", {
          text: body,
          channelId: "web",
          threadIdOverride: this.cfg.threadId,
          metadata: {
            senderName: user,
            messageId: msg.id,
            ...(rel.length ? { attachments: rel } : {}),
          },
        });
        this.pendingSince = Date.now();
        return json(200, { ok: true, id: msg.id });
      }

      if (req.method === "POST" && path === "/api/reset") {
        ctx.resetThread("web", this.cfg.threadId);
        this.messages = [];
        this.nextId = 1;
        this.pendingSince = null;
        await writeFile(this.transcriptPath, "");
        return json(200, { ok: true });
      }

      json(404, { error: "not found" });
    } catch (e) {
      ctx.log.error({ err: String(e) }, "webchat request failed");
      if (!res.headersSent) json(500, { error: String(e) });
    }
  }

  private async readJson(req: any): Promise<Record<string, unknown>> {
    let s = "";
    for await (const c of req) s += c;
    return s ? (JSON.parse(s) as Record<string, unknown>) : {};
  }
}

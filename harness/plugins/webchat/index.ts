/**
 * webchat — a browser chat channel for an agent, one transcript per thread.
 *
 * The app (`app/`) talks to this plugin's inbox at
 * `/webhook/<agent>/webchat/api/*`; the agent talks back through the seeded
 * `scripts/webchat/webchat-cli`. Every endpoint takes an optional thread id
 * and defaults to the configured one (`threadId`, default `main` — the SAME
 * thread telegram routes to, so the web panel's default conversation and
 * Telegram are one conversation, not two). Other threads (`jr-12`,
 * `supplier-<slug>`, `customer-<slug>`, `router`) each get their own
 * transcript file under `state/threads/`, which is what lets the panel open
 * any of the agent's threads and the supplier portal join a supplier's own.
 *
 * Endpoints
 *   POST api/upload   raw body + `x-file-name`  → stores in inbox/, returns {name}
 *   POST api/send     {text, attachments?, threadId?, page?} → transcript + notify(agent)
 *   GET  api/messages ?since=<id>|?before=<id>&thread=<id>&read=1 → {messages, hasMore, pending, cursor, readId}
 *   GET  api/threads  → {threads:[{threadId,lastId,lastAt,lastRole,lastText,readId}]}
 *   GET  api/file     ?name=<stored name>       → the bytes
 *   POST api/read     {threadId?, lastId?}      → mark that thread read (web side)
 *   POST api/reset    {threadId?}               → wipe that thread's context + transcript
 *   POST api/reply    {text, attachments?, threadId?} → agent's reply (CLI only)
 *   POST api/app-upload   raw body + thread/name headers → server-to-server (portal)
 *   POST api/app-send     {threadId, text, attachments?, senderName, page?} → server-to-server (portal)
 *   GET  api/app-messages ?thread=<id>&since=<id>&read=1  → server-to-server (portal)
 *   GET  api/app-file     ?thread=<id>&name=<stored>      → server-to-server (portal)
 *
 * Storage is Supabase (migration 0078): one `threads` row per (agent, thread
 * id) and the transcript in `thread_messages`, `seq` being the per-thread
 * message id. This plugin is the only writer, so it keeps a write-through
 * in-memory copy (the newest `historyLimit` per thread, loaded at start) and
 * serves every read from that; the database is what survives, what the app
 * subscribes to (Realtime → SSE), and what the entity tables' `*_thread_ref`
 * columns point at. Attachment bytes stay on disk (inbox/, state/outbox/).
 *
 * Read state is two cursors per thread on the `threads` row — `web` for the
 * team's panel, `portal` for the supplier — each the id of the newest message
 * that side has seen. A poll carrying `read=1` comes from a panel that is
 * open on the thread, so it marks everything in that thread read; sending
 * marks your own message read. Any device sees the same dots, which is the
 * point. The two cursors are deliberately separate: a supplier's message is
 * unread for the team, an agent's reply is unread for the supplier, and both
 * live on one thread.
 *
 * Auth is three-sided, because the callers differ:
 *   - browser routes (upload/send/messages/threads/file/reset) require a valid
 *     harness session — the plugin forwards the request's cookie to the
 *     harness's own `/api/auth/me`.
 *   - `api/reply` requires COGNISPHERE_WEBHOOK_SECRET, which only in-harness
 *     processes (i.e. the agent) have.
 *   - `api/app-*` endpoints require the optional WEBCHAT_APP_SECRET
 *     (X-App-Secret) — presented by the app's *server* routes for the supplier
 *     portal, whose users are not harness users. Without the secret configured
 *     all four answer 404.
 *
 * ponytail: the browser still polls this plugin for the transcript; the
 *   database is the store and the push signal (the app's SSE route relays
 *   Realtime changes), not a second read path.
 */
import { createReadStream } from "node:fs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, readdir, writeFile, stat, unlink } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** What the sender had open when the message was sent — self-reported by the client. */
interface PageContext {
  path: string;
  title?: string;
}

/** Validate a client-supplied `page` — an app-relative path plus an optional title. */
function pageContext(raw: unknown): PageContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const path = String(r.path ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  const title = String(r.title ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  return title ? { path, title } : { path };
}

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
  /** Portal messages carry who typed them; panel messages get it from the session. */
  senderName?: string;
  /** Portal-visible: set on portal-sent messages and on `--portal` replies.
   *  api/app-messages serves ONLY these — the team's internal panel traffic
   *  on a supplier thread never reaches the supplier's portal. */
  portal?: boolean;
}

/** The newest message id each side has seen on a thread. */
interface ReadCursors {
  web: number;
  portal: number;
}

interface Thread {
  /** `threads.id` — null until the row exists (first message or first mark). */
  dbId: number | null;
  messages: ChatMessage[];
  nextId: number;
  /** When the last user message was handed to the agent; null once answered. */
  pendingSince: number | null;
}

/** A `thread_messages` row. */
interface MessageRow {
  seq: number;
  role: "user" | "agent";
  text: string;
  files: ChatFile[];
  sender_name: string | null;
  portal: boolean;
  created_at: string;
}

function fromRow(r: MessageRow): ChatMessage {
  return {
    id: r.seq,
    at: Date.parse(r.created_at),
    role: r.role,
    text: r.text,
    files: r.files ?? [],
    ...(r.sender_name ? { senderName: r.sender_name } : {}),
    ...(r.portal ? { portal: true } : {}),
  };
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
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const PORTAL_UPLOAD_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".txt", ".csv", ".md", ".json", ".xlsx", ".docx",
  ".webm", ".ogg", ".mp3", ".m4a", ".wav",
]);
const PORTAL_UPLOAD_TTL_MS = 60 * 60 * 1000;
const PORTAL_PENDING_MAX_FILES = 20;
const PORTAL_PENDING_MAX_BYTES = 100 * 1024 * 1024;
const PORTAL_MESSAGE_MAX_FILES = 10;
const PORTAL_MESSAGE_MAX_BYTES = 50 * 1024 * 1024;
const PORTAL_STORED_NAME = /^portal-(\d+)-[a-f0-9]{24}\.[A-Za-z0-9]+$/;

/** Strip anything that could escape the inbox/outbox dir, keep it recognisable. */
function safeName(raw: string): string {
  const base = basename(raw).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  return base.replace(/^\.+/, "") || "file";
}

/** Stored ids are already generated by us: validate path safety without truncating. */
function storedName(raw: unknown): string | null {
  const value = String(raw ?? "");
  return value && value.length <= 255 && basename(value) === value && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

/** Keep untrusted upload metadata from becoming an invalid response header. */
function safeMime(raw: unknown, label: string): string {
  const value = String(raw ?? "").split(";", 1)[0].trim().toLowerCase();
  return /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(value)
    ? value
    : MIME[extname(label).toLowerCase()] ?? "application/octet-stream";
}

function uploadTicket(secret: string, threadId: string, file: Omit<ChatFile, "dir">): string {
  const payload = [threadId, file.name, file.label, file.mime, file.size].join("\0");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function validUploadTicket(secret: string, threadId: string, file: Omit<ChatFile, "dir">, ticket: unknown): boolean {
  const expected = Buffer.from(uploadTicket(secret, threadId, file), "hex");
  const actualHex = String(ticket ?? "");
  if (!/^[a-f0-9]{64}$/.test(actualHex)) return false;
  const actual = Buffer.from(actualHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export default class WebchatPlugin {
  manifest = {
    displayName: "Web Chat",
    description:
      "Browser chat channel, one transcript per thread. Inbox at /webhook/<agent>/webchat/api/*; the agent replies with scripts/webchat/webchat-cli.",
    configSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          default: "main",
          description:
            "Default thread when a request names none. Defaults to `main` so the web panel's default conversation shares context with telegram's main route.",
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
          description: "Messages kept in memory / returned to the browser, per thread.",
        },
      },
      additionalProperties: false,
    },
    secretsSchema: {
      type: "object",
      properties: {
        WEBCHAT_APP_SECRET: {
          type: "string",
          description:
            "Optional shared secret for the app's server-to-server portal endpoints (X-App-Secret). Without it api/app-upload/app-send/app-messages/app-file answer 404. Wired by scripts/app/secrets.sh for rosie."
        },
        WEBCHAT_SUPABASE_URL: {
          type: "string",
          description: "Supabase project URL — transcripts live in threads / thread_messages. Wired by scripts/app/secrets.sh.",
        },
        WEBCHAT_SUPABASE_SECRET_KEY: {
          type: "string",
          description: "Supabase secret key (sb_secret_*), prefixed because keys are unique across an agent's buckets. Wired by scripts/app/secrets.sh.",
        },
      },
      required: ["WEBCHAT_SUPABASE_URL", "WEBCHAT_SUPABASE_SECRET_KEY"],
    },
  };

  private ctx?: any;
  private cfg!: WebchatConfig;
  private db!: SupabaseClient;
  private threads = new Map<string, Thread>();
  private read = new Map<string, ReadCursors>();
  private outboxDir = "";
  private apiBase = "";
  private portalActiveUploads = 0;

  private thread(id: string): Thread {
    let t = this.threads.get(id);
    if (!t) {
      t = { dbId: null, messages: [], nextId: 1, pendingSince: null };
      this.threads.set(id, t);
    }
    return t;
  }

  /**
   * The `threads.id` for a thread id, creating the row when it is missing.
   * Always an upsert, never the cached id: a job request's delete takes its
   * thread row with it (migration 0079), and a cached id would then dangle.
   */
  private async dbThreadId(threadId: string): Promise<number> {
    const t = this.thread(threadId);
    const { data, error } = await this.db.rpc("link_thread", {
      p_agent: this.ctx.agentId,
      p_thread_id: threadId,
    });
    if (error) throw new Error(`threads upsert failed: ${error.message}`);
    t.dbId = Number(data);
    return t.dbId;
  }

  /** Write one `threads` column set; logged, never thrown — the in-memory copy is already right. */
  private updateThread(threadId: string, patch: Record<string, unknown>): void {
    void this.dbThreadId(threadId)
      .then(async (id) => {
        const { error } = await this.db.from("threads").update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      })
      .catch((e) => this.ctx?.log.error({ err: String(e), threadId }, "webchat: threads update failed"));
  }

  private setPending(threadId: string, since: number | null): void {
    this.thread(threadId).pendingSince = since;
    this.updateThread(threadId, { pending_since: since === null ? null : new Date(since).toISOString() });
  }

  private cursors(threadId: string): ReadCursors {
    return this.read.get(threadId) ?? { web: 0, portal: 0 };
  }

  /** Newest portal-visible message — the portal cursor's ceiling. */
  private portalCursor(t: Thread): number {
    for (let i = t.messages.length - 1; i >= 0; i--) {
      if (t.messages[i].portal) return t.messages[i].id;
    }
    return 0;
  }

  /** Move one side's cursor forward. No-op when it already covers `lastId`. */
  private markRead(threadId: string, side: keyof ReadCursors, lastId: number): void {
    if (!Number.isInteger(lastId) || lastId <= 0) return;
    const cursors = this.cursors(threadId);
    if (cursors[side] >= lastId) return;
    cursors[side] = lastId;
    this.read.set(threadId, cursors);
    this.updateThread(threadId, { [side === "web" ? "web_read_id" : "portal_read_id"]: lastId });
  }

  async start(ctx: any): Promise<void> {
    this.ctx = ctx;
    this.cfg = ctx.config as WebchatConfig;
    const url = String(ctx.secrets?.WEBCHAT_SUPABASE_URL ?? "");
    const key = String(ctx.secrets?.WEBCHAT_SUPABASE_SECRET_KEY ?? "");
    if (!url || !key) throw new Error("webchat: WEBCHAT_SUPABASE_URL and WEBCHAT_SUPABASE_SECRET_KEY are required");
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

    // Load every thread of this agent that has a transcript: the newest
    // `historyLimit` messages each, plus its cursors. Rows without a
    // transcript (ids minted by an entity trigger) stay unknown here until
    // their first message — `link_thread` finds them then.
    const { data: rows, error } = await this.db
      .from("threads")
      .select("id, thread_id, web_read_id, portal_read_id")
      .eq("agent", ctx.agentId)
      .not("last_seq", "is", null);
    if (error) throw new Error(`webchat: threads load failed: ${error.message}`);
    for (const row of rows ?? []) {
      const { data: msgs, error: e2 } = await this.db
        .from("thread_messages")
        .select("seq, role, text, files, sender_name, portal, created_at")
        .eq("thread_id", row.id)
        .order("seq", { ascending: false })
        .limit(this.cfg.historyLimit);
      if (e2) throw new Error(`webchat: transcript load failed (${row.thread_id}): ${e2.message}`);
      const messages = ((msgs ?? []) as MessageRow[]).reverse().map(fromRow);
      this.threads.set(row.thread_id, {
        dbId: row.id,
        messages,
        nextId: (messages[messages.length - 1]?.id ?? 0) + 1,
        // A restarted harness is not mid-turn; the column is cleared below.
        pendingSince: null,
      });
      this.read.set(row.thread_id, { web: Number(row.web_read_id), portal: Number(row.portal_read_id) });
    }
    await this.db.from("threads").update({ pending_since: null }).eq("agent", ctx.agentId).not("pending_since", "is", null);

    await this.cleanupPortalOrphans();
    ctx.log.info(
      { defaultThread: this.cfg.threadId, threads: this.threads.size },
      "webchat started",
    );
  }

  async stop(): Promise<void> {
    this.ctx = undefined;
  }

  /** Delete expired, unreferenced public-portal uploads and report live quota use. */
  private async cleanupPortalOrphans(): Promise<{ count: number; bytes: number }> {
    const ctx = this.ctx;
    if (!ctx) return { count: 0, bytes: 0 };
    const referenced = new Set(
      [...this.threads.values()]
        .flatMap((thread) => thread.messages)
        .flatMap((message) => message.files)
        .filter((file) => file.dir === "inbox")
        .map((file) => file.name),
    );
    let count = 0;
    let bytes = 0;
    for (const name of await readdir(ctx.inboxDir)) {
      if (!PORTAL_STORED_NAME.test(name) || referenced.has(name)) continue;
      try {
        const info = await stat(join(ctx.inboxDir, name));
        if (Date.now() - info.mtimeMs > PORTAL_UPLOAD_TTL_MS) {
          await unlink(join(ctx.inboxDir, name));
        } else {
          count += 1;
          bytes += info.size;
        }
      } catch {
        /* raced with another cleanup or disappeared */
      }
    }
    return { count, bytes };
  }

  private trim(t: Thread) {
    const extra = t.messages.length - this.cfg.historyLimit;
    if (extra > 0) t.messages.splice(0, extra);
  }

  private async record(threadId: string, m: Omit<ChatMessage, "id">): Promise<ChatMessage> {
    const dbId = await this.dbThreadId(threadId);
    const t = this.thread(threadId);
    const msg: ChatMessage = { ...m, id: t.nextId };
    const { error } = await this.db.from("thread_messages").insert({
      thread_id: dbId,
      seq: msg.id,
      role: msg.role,
      text: msg.text,
      files: msg.files,
      sender_name: msg.senderName ?? null,
      portal: Boolean(msg.portal),
      created_at: new Date(msg.at).toISOString(),
    });
    if (error) throw new Error(`thread_messages insert failed: ${error.message}`);
    t.nextId += 1;
    t.messages.push(msg);
    this.trim(t);
    return msg;
  }

  /** True while the agent owes an answer on this thread and hasn't timed out. */
  private isPending(t: Thread): boolean {
    if (t.pendingSince === null) return false;
    if (Date.now() - t.pendingSince > this.cfg.pendingTimeoutSec * 1000) {
      t.pendingSince = null; // memory only: the column is a hint, and the next answer clears it
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

  /**
   * True while the runner is chewing on ANY event for this agent — a cron
   * tick, a telegram message, another agent's ping. A thread's own
   * `pendingSince` only knows about web messages, so without this the
   * indicator reads "Online" while the agent is visibly busy elsewhere.
   */
  private async hasInFlightEvent(cookie: string): Promise<boolean> {
    if (!this.apiBase || !this.ctx) return false;
    try {
      const res = await fetch(
        `${this.apiBase}/api/agents/${this.ctx.agentId}/events?status=in_flight&limit=1`,
        { headers: { cookie } },
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { total?: number };
      return (body.total ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /** The messages window the panel and the portal both page through. */
  private window(t: Thread, url: URL) {
    const since = Number(url.searchParams.get("since") ?? 0);
    const before = Number(url.searchParams.get("before") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 0);
    const window =
      before > 0
        ? t.messages.filter((m) => m.id < before)
        : t.messages.filter((m) => m.id > since);
    const messages = limit > 0 ? window.slice(-limit) : window;
    return {
      messages,
      hasMore: messages.length < window.length,
      cursor: t.messages[t.messages.length - 1]?.id ?? 0,
    };
  }

  /**
   * Deliver one inbound user message: transcript row + notify the agent.
   *
   * `page` is what the sender had open when they hit send — appended to the
   * agent-facing body as "Additional context" (never to the transcript, which
   * shows only what the user typed) so the agent can read intent off the
   * screen the message was written against.
   */
  private async deliver(
    threadId: string,
    text: string,
    files: ChatFile[],
    senderName: string,
    channelId: string,
    page?: PageContext,
  ): Promise<ChatMessage> {
    const ctx = this.ctx;
    const msg = await this.record(threadId, {
      at: Date.now(),
      role: "user",
      text,
      files,
      ...(channelId === "portal" ? { senderName, portal: true } : {}),
    });

    // Attachment paths are inlined in the body (same shape telegram uses)
    // so the agent can `read` them without reconstructing a path.
    const rel = files.map((f) => join("plugins/webchat/inbox", f.name));
    const body =
      text +
      files.map((f, i) => `\n<${f.label}>[${rel[i]}]`).join("") +
      (page
        ? `\n\nAdditional context:\n- Current page: ${page.title ? `${page.title} (${page.path})` : page.path}`
        : "");

    ctx.notify("web_message", {
      text: body,
      channelId,
      threadIdOverride: threadId,
      metadata: {
        senderName,
        messageId: msg.id,
        webchatThreadId: threadId,
        ...(rel.length ? { attachments: rel } : {}),
        ...(page ? { page: page.path } : {}),
      },
    });
    this.setPending(threadId, Date.now());
    return msg;
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
        const threadId = String(b.threadId ?? "").trim() || this.cfg.threadId;
        const portal = Boolean(b.portal);
        const text = String(b.text ?? "").trim();
        const paths = Array.isArray(b.attachments) ? b.attachments : [];
        if (!text && paths.length === 0)
          return json(400, { error: "text or attachments required" });
        const files: ChatFile[] = [];
        for (const p of paths) {
          const agentDir = resolve(ctx.agentDir);
          const src = resolve(agentDir, String(p));
          const fromAgent = relative(agentDir, src);
          if (fromAgent === ".." || fromAgent.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(fromAgent))
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
        const msg = await this.record(threadId, {
          at: Date.now(),
          role: "agent",
          text,
          files,
          ...(portal ? { portal: true } : {}),
        });
        this.setPending(threadId, null); // answered
        return json(200, { ok: true, id: msg.id, threadId });
      }

      // --- app server side: the supplier portal, authed by shared secret ----
      if (["/api/app-upload", "/api/app-send", "/api/app-messages", "/api/app-file"].includes(path)) {
        const secret = String(ctx.secrets?.WEBCHAT_APP_SECRET ?? "");
        if (!secret) return json(404, { error: "not found" });
        if (req.headers["x-app-secret"] !== secret)
          return json(401, { error: "missing or invalid X-App-Secret" });

        if (req.method === "GET" && path === "/api/app-messages") {
          const threadId = String(url.searchParams.get("thread") ?? "").trim();
          if (!threadId) return json(400, { error: "thread required" });
          const t = this.thread(threadId);
          // Only the portal-visible half of the thread crosses this endpoint.
          const view: Thread = {
            dbId: t.dbId,
            messages: t.messages.filter((m) => m.portal),
            nextId: t.nextId,
            pendingSince: t.pendingSince,
          };
          const page = this.window(view, url);
          // `read=1` comes from the portal's open chat panel. The bell's peek
          // poll runs while that panel is CLOSED and omits it — marking there
          // would clear the alert before the supplier ever saw it.
          if (url.searchParams.get("read") === "1") this.markRead(threadId, "portal", page.cursor);
          return json(200, {
            ...page,
            readId: this.cursors(threadId).portal,
            pending: this.isPending(t),
          });
        }

        if (req.method === "POST" && path === "/api/app-upload") {
          const threadId = String(url.searchParams.get("thread") ?? "").trim();
          if (!threadId) return json(400, { error: "thread required" });
          const encodedLabel = String(req.headers["x-file-name"] ?? "upload");
          let decodedLabel = encodedLabel;
          try {
            decodedLabel = decodeURIComponent(encodedLabel);
          } catch {
            /* malformed percent escapes are sanitized as literal text */
          }
          const label = safeName(decodedLabel);
          const extension = extname(label).toLowerCase();
          if (!PORTAL_UPLOAD_EXTENSIONS.has(extension))
            return json(415, { error: "unsupported file type" });
          const pending = await this.cleanupPortalOrphans();
          if (pending.count >= PORTAL_PENDING_MAX_FILES || pending.bytes >= PORTAL_PENDING_MAX_BYTES)
            return json(429, { error: "too many pending portal uploads; try again later" });
          // Reserve one worst-case file per active request so concurrent public
          // bodies cannot race past the 100MB pending pool.
          const max = this.cfg.maxUploadMb * 1024 * 1024;
          if (
            this.portalActiveUploads >= 4 ||
            pending.bytes + (this.portalActiveUploads + 1) * max > PORTAL_PENDING_MAX_BYTES
          ) return json(429, { error: "too many uploads in progress; try again later" });
          this.portalActiveUploads += 1;
          try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const c of req) {
              size += c.length;
              if (size > max)
                return json(413, { error: `file exceeds ${this.cfg.maxUploadMb}MB` });
              chunks.push(c as Buffer);
            }
            if (size === 0) return json(400, { error: "empty file" });
            if (pending.bytes + size > PORTAL_PENDING_MAX_BYTES)
              return json(429, { error: "pending portal upload quota exceeded; try again later" });
            // Fixed-length opaque ids never need the display-name sanitizer and
            // cannot overflow a filesystem component for long thread/file names.
            const name = `portal-${Date.now()}-${randomBytes(12).toString("hex")}${extension}`;
            await writeFile(join(ctx.inboxDir, name), Buffer.concat(chunks));
            const file = { name, label, size, mime: MIME[extension] ?? "application/octet-stream" };
            return json(200, { ...file, ticket: uploadTicket(secret, threadId, file) });
          } finally {
            this.portalActiveUploads -= 1;
          }
        }

        if (req.method === "POST" && path === "/api/app-send") {
          const b = await this.readJson(req);
          const threadId = String(b.threadId ?? "").trim();
          const text = String(b.text ?? "").trim();
          const senderName = String(b.senderName ?? "").trim() || "Portal user";
          const uploads = Array.isArray(b.attachments) ? b.attachments : [];
          if (!threadId || (!text && uploads.length === 0))
            return json(400, { error: "threadId and text or attachments required" });
          if (uploads.length > PORTAL_MESSAGE_MAX_FILES)
            return json(400, { error: `at most ${PORTAL_MESSAGE_MAX_FILES} attachments per message` });
          await this.cleanupPortalOrphans();
          const files: ChatFile[] = [];
          let totalBytes = 0;
          for (const upload of uploads) {
            const u = upload as Record<string, unknown>;
            const name = storedName(u.name);
            if (!name || !PORTAL_STORED_NAME.test(name))
              return json(400, { error: "invalid attachment name" });
            let stored;
            try {
              stored = await stat(join(ctx.inboxDir, name));
            } catch {
              return json(400, { error: "attachment missing" });
            }
            const file = {
              name,
              label: safeName(String(u.label ?? name)),
              mime: safeMime(u.mime, String(u.label ?? name)),
              size: stored.size,
            };
            if (!validUploadTicket(secret, threadId, file, u.ticket))
              return json(400, { error: "invalid attachment ticket" });
            totalBytes += stored.size;
            if (totalBytes > PORTAL_MESSAGE_MAX_BYTES)
              return json(400, { error: "attachment total exceeds 50MB" });
            files.push({ ...file, dir: "inbox" });
          }
          const msg = await this.deliver(threadId, text, files, senderName, "portal", pageContext(b.page));
          this.markRead(threadId, "portal", msg.id);
          return json(200, { ok: true, id: msg.id });
        }

        if (req.method === "GET" && path === "/api/app-file") {
          const threadId = String(url.searchParams.get("thread") ?? "").trim();
          const name = storedName(url.searchParams.get("name"));
          if (!threadId || !name) return json(400, { error: "thread and valid name required" });
          const file = this.thread(threadId).messages
            .filter((message) => message.portal)
            .flatMap((message) => message.files)
            .find((candidate) => candidate.name === name);
          if (!file) return json(404, { error: "unknown attachment" });
          const dir = file.dir === "outbox" ? this.outboxDir : ctx.inboxDir;
          const storedPath = join(dir, name);
          let bytes: number;
          try {
            bytes = (await stat(storedPath)).size;
          } catch {
            return json(404, { error: "attachment missing on disk" });
          }
          const disposition = file.mime.startsWith("image/") || file.mime.startsWith("audio/")
            ? "inline"
            : "attachment";
          const headers = {
            "content-type": file.mime,
            "accept-ranges": "bytes",
            "content-disposition": `${disposition}; filename="${safeName(file.label)}"`,
            "x-content-type-options": "nosniff",
          };
          const range = String(req.headers.range ?? "");
          if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range);
            if (!match) {
              res.writeHead(416, { ...headers, "content-range": `bytes */${bytes}` });
              res.end();
              return;
            }
            const suffix = !match[1] && match[2] ? Number(match[2]) : 0;
            const start = suffix ? Math.max(0, bytes - suffix) : Number(match[1] || 0);
            const end = suffix ? bytes - 1 : Math.min(bytes - 1, Number(match[2] || bytes - 1));
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes) {
              res.writeHead(416, { ...headers, "content-range": `bytes */${bytes}` });
              res.end();
              return;
            }
            res.writeHead(206, {
              ...headers,
              "content-length": String(end - start + 1),
              "content-range": `bytes ${start}-${end}/${bytes}`,
            });
            createReadStream(storedPath, { start, end }).pipe(res);
            return;
          }
          res.writeHead(200, { ...headers, "content-length": String(bytes) });
          createReadStream(storedPath).pipe(res);
          return;
        }

        return json(404, { error: "not found" });
      }

      // --- browser side: everything below needs a real harness session ------
      const cookie = String(req.headers.cookie ?? "");
      const user = await this.sessionUser(cookie);
      if (!user) return json(401, { error: "unauthorized" });

      if (req.method === "GET" && path === "/api/messages") {
        const threadId = String(url.searchParams.get("thread") ?? "").trim() || this.cfg.threadId;
        const t = this.thread(threadId);
        const page = this.window(t, url);
        // Only the panel that is open on this thread asks with `read=1`, and an
        // open panel has seen the whole thread — not just the page it fetched.
        if (url.searchParams.get("read") === "1") this.markRead(threadId, "web", page.cursor);
        return json(200, {
          ...page,
          readId: this.cursors(threadId).web,
          pending: this.isPending(t) || (await this.hasInFlightEvent(cookie)),
        });
      }

      if (req.method === "GET" && path === "/api/threads") {
        const threads = [...this.threads.entries()]
          .filter(([, t]) => t.messages.length > 0)
          .map(([threadId, t]) => {
            const last = t.messages[t.messages.length - 1];
            return {
              threadId,
              lastId: last.id,
              lastAt: last.at,
              lastRole: last.role,
              // Present only on portal messages — how the app tells a
              // supplier's message from the operator's own panel sends.
              ...(last.senderName ? { lastSender: last.senderName } : {}),
              lastText: last.text.slice(0, 120),
              readId: this.cursors(threadId).web,
            };
          })
          .sort((a, b) => b.lastAt - a.lastAt);
        return json(200, { threads });
      }

      if (req.method === "GET" && path === "/api/file") {
        const name = storedName(url.searchParams.get("name"));
        if (!name) return json(400, { error: "valid name required" });
        const file = [...this.threads.values()]
          .flatMap((t) => t.messages)
          .flatMap((m) => m.files)
          .find((f) => f.name === name);
        if (!file) return json(404, { error: "unknown attachment" });
        const dir = file.dir === "outbox" ? this.outboxDir : ctx.inboxDir;
        const path = join(dir, name);
        // Length from the bytes on disk, never from `file.size` — that one is
        // client-declared for uploads.
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
          "content-disposition": `inline; filename="${safeName(file.label)}"`,
          "x-content-type-options": "nosniff",
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
        const threadId = String(b.threadId ?? "").trim() || this.cfg.threadId;
        const text = String(b.text ?? "").trim();
        const uploads = Array.isArray(b.attachments) ? b.attachments : [];
        if (!text && uploads.length === 0)
          return json(400, { error: "text or attachments required" });

        const files: ChatFile[] = [];
        for (const upload of uploads) {
          const u = upload as Record<string, unknown>;
          const name = storedName(u.name);
          if (!name) return json(400, { error: "invalid attachment name" });
          files.push({
            name,
            label: safeName(String(u.label ?? u.name ?? "file")),
            mime: safeMime(u.mime, String(u.label ?? name)),
            size: Number(u.size ?? 0),
            dir: "inbox",
          });
        }

        const msg = await this.deliver(threadId, text, files, user, "web", pageContext(b.page));
        this.markRead(threadId, "web", msg.id);
        return json(200, { ok: true, id: msg.id });
      }

      // Marking read without opening the thread — the bell's "mark all read".
      if (req.method === "POST" && path === "/api/read") {
        const b = await this.readJson(req).catch(() => ({}) as Record<string, unknown>);
        const threadId = String(b.threadId ?? "").trim() || this.cfg.threadId;
        const t = this.thread(threadId);
        const lastId = Number(b.lastId ?? 0) || (t.messages[t.messages.length - 1]?.id ?? 0);
        this.markRead(threadId, "web", lastId);
        return json(200, { ok: true, readId: this.cursors(threadId).web });
      }

      if (req.method === "POST" && path === "/api/reset") {
        const b = await this.readJson(req).catch(() => ({}) as Record<string, unknown>);
        const threadId = String(b.threadId ?? "").trim() || this.cfg.threadId;
        ctx.resetThread("web", threadId);
        const dbId = this.thread(threadId).dbId;
        if (dbId !== null) {
          const { error } = await this.db.from("thread_messages").delete().eq("thread_id", dbId);
          if (error) return json(500, { error: `transcript delete failed: ${error.message}` });
          // ids restart at 1 — a stale cursor would hide the new transcript,
          // and the preview trigger only ever moves forward.
          const { error: e2 } = await this.db
            .from("threads")
            .update({
              web_read_id: 0, portal_read_id: 0, pending_since: null,
              last_seq: null, last_at: null, last_role: null, last_sender: null, last_text: null,
            })
            .eq("id", dbId);
          if (e2) return json(500, { error: `threads reset failed: ${e2.message}` });
        }
        this.threads.set(threadId, { dbId: null, messages: [], nextId: 1, pendingSince: null });
        this.read.delete(threadId);
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

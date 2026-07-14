/**
 * agent-messaging — inter- and intra-agent messaging.
 *
 * Lets one agent drop a message onto another agent's thread (INTER-agent, e.g.
 * agent A → agent B's thread) or onto a different thread of its own
 * (INTRA-agent, e.g. thread A → thread B of the same agent). Each enabled
 * agent gets:
 *   - an HTTP inbox at  /webhook/<agent>/agent-messaging/api/send  (this handler)
 *   - the seeded `scripts/agent-msg/send` CLI, which POSTs to the TARGET
 *     agent's inbox above.
 *
 * Why HTTP and not a shared bus: a plugin's `ctx.notify` only wakes its OWN
 * agent. So to reach agent X we POST to X's webhook; X's own plugin instance
 * receives it and notifies X on the target thread. Same path serves the
 * intra-agent case — the sender just POSTs to its own agent's webhook with a
 * different thread id.
 *
 * Delivery: `ctx.notify(..., threadIdOverride = target thread)` lands the
 * message on that exact thread — e.g. daisy's "admin"
 * thread, etc. By default it STEERS (the receiving agent acts on it); `silent`
 * logs it for awareness without prompting action.
 *
 * ponytail: routing is just (target agent, target thread) — one event kind,
 *   one CLI, no separate message bus. To go live this contract is unchanged;
 *   only the transport (an internal queue vs. localhost HTTP) would move.
 */
export default class AgentMessagingPlugin {
  manifest = {
    displayName: "Agent Messaging",
    description:
      "Inter-/intra-agent messaging. Receives agent-to-agent notes at /webhook/<agent>/agent-messaging/api/send and wakes the target agent on the target thread.",
    configSchema: { type: "object", properties: {}, additionalProperties: false },
    secretsSchema: { type: "object", properties: {}, additionalProperties: false },
  };

  /** @type {any} */ ctx = null;

  async start(ctx) {
    this.ctx = ctx;
    ctx.log.info(
      "agent-messaging started — inbox at /webhook/" + ctx.agentId + "/agent-messaging/api/send",
    );
  }
  async stop() { this.ctx = null; }

  async handleHttpRequest(req, res) {
    const url = new URL(req.url || "/", "http://local");
    const json = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    const readBody = async () => { let s = ""; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("agent-messaging plugin — POST api/send {from_agent, from_thread_id, thread_id, message, subject?, silent?}");
      }
      if (req.method === "POST" && url.pathname === "/api/send") {
        const b = await readBody();
        const thread = String(b.thread_id ?? b.thread ?? "").trim();
        const message = String(b.message ?? "").trim();
        if (!thread || !message) return json(400, { error: "thread_id and message required" });
        const from = String(b.from_agent ?? b.from ?? "").trim() || "another agent";
        const fromThread = String(b.from_thread_id ?? "").trim();
        const silent = b.silent === true;
        const subject = b.subject ? String(b.subject) : "";
        const header = `[AGENT MESSAGE] from ${from}`
          + (fromThread ? ` (their thread ${fromThread})` : "")
          + (subject ? ` — ${subject}` : "")
          + ` (on thread ${thread}). Internal note from another agent — NOT a customer message; never forward it to a customer.`
          + (fromThread
            ? ` To respond, reply to the sender: \`bash scripts/agent-msg/send --to-agent ${from} --thread-id ${fromThread} --from-agent ${this.ctx.agentId} --from-thread-id ${thread} --message "…"\`.`
            : "");
        this.ctx.notify("agent_message", {
          text: `${header}\n\n${message}`,
          channelId: "agent",
          threadIdOverride: thread,
          ...(silent ? { isSilent: true, doNotSteer: true } : {}),
          metadata: {
            EventType: "agent_message", from, to: this.ctx.agentId, thread,
            ...(fromThread ? { fromThread } : {}),
            ...(subject ? { subject } : {}),
          },
        });
        return json(200, { ok: true, to: this.ctx.agentId, thread, silent });
      }
      json(404, { error: "not found" });
    } catch (e) {
      if (!res.headersSent) json(500, { error: String(e) });
    }
  }
}

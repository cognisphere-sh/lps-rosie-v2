import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * supplier-events — the app tells an agent something happened with a supplier.
 *
 * The web app POSTs here (`app/lib/notify-agent.ts`) and the plugin wakes the
 * agent with the event. Enabled on **daisy** — she owns every supplier
 * conversation, the portal included. Three event kinds:
 *
 * - `availability_submitted` / `supplier_message` — a supplier acted in their
 *   portal on an availability request.
 * - `instruction` — Chris (or whoever is signed in) wrote to her from a
 *   supplier's chat view in the admin app.
 *
 * Everything an event is *about* lives in the database (availability_requests,
 * availability_request_items, supplier_messages — migrations 0062/0063), so
 * the notification carries identifiers plus, for messages and instructions,
 * the text itself.
 *
 * Threads: **one supplier = one thread**, `supplier-<id>` — every event about
 * a supplier lands there, availability requests included (per-request task
 * threads existed for a few hours on 2026-08-19 before Bhoumik settled on a
 * single conversation per supplier).
 *
 * Auth: the caller is the app, not an in-harness process, so the boot-time
 * COGNISPHERE_WEBHOOK_SECRET is not usable here. A dedicated shared secret
 * (SUPPLIER_EVENTS_APP_SECRET, one value shared by every enabled agent) is
 * wired into both each agent's secrets bucket and app/.env.local by
 * scripts/app/secrets.sh — the same split the artifacts secret uses.
 *
 * Duck-typed against the harness's Plugin interface (core/types.ts) — user
 * plugins don't import from the harness package.
 */

interface SupplierEventBody {
  type?: string;
  supplierId?: number;
  supplierName?: string;
  availabilityRequestId?: number | null;
  jobRequestId?: number | null;
  /** The message body — supplier_message and instruction events. */
  message?: string;
  /** Who wrote the instruction — instruction events. */
  from?: string;
}

const EVENT_TYPES = new Set(["availability_submitted", "supplier_message", "instruction"]);

export default class SupplierEventsPlugin {
  manifest = {
    displayName: "Supplier Events",
    description:
      "Wakes the agent on supplier activity — portal submissions/messages and chat-view instructions. POST /webhook/<agent>/supplier-events/notify from the app.",
    configSchema: { type: "object", properties: {}, additionalProperties: false },
    secretsSchema: {
      type: "object",
      properties: {
        SUPPLIER_EVENTS_APP_SECRET: {
          type: "string",
          description:
            "Shared secret the app presents as X-App-Secret. Wired by scripts/app/secrets.sh into secrets.json and app/.env.local.",
        },
      },
      required: ["SUPPLIER_EVENTS_APP_SECRET"],
    },
  };

  private ctx?: {
    agentId: string;
    secrets: Record<string, string>;
    notify: (name: string, payload: Record<string, unknown>) => void;
    log: { info: (obj: unknown, msg?: string) => void };
  };

  async start(ctx: NonNullable<SupplierEventsPlugin["ctx"]>): Promise<void> {
    this.ctx = ctx;
    ctx.log.info(
      { agent: ctx.agentId },
      "supplier-events started — inbox at /webhook/" + ctx.agentId + "/supplier-events/notify",
    );
  }

  async stop(): Promise<void> {
    this.ctx = undefined;
  }

  async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const ctx = this.ctx;
    const json = (code: number, obj: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (!ctx) return json(503, { error: "plugin not started" });

    const url = new URL(req.url || "/", "http://local");
    if (req.method !== "POST" || url.pathname !== "/notify") {
      return json(404, { error: "POST /notify" });
    }
    if (req.headers["x-app-secret"] !== ctx.secrets.SUPPLIER_EVENTS_APP_SECRET) {
      return json(401, { error: "missing or invalid X-App-Secret" });
    }

    let body: SupplierEventBody;
    try {
      let s = "";
      for await (const c of req) s += c;
      body = s ? (JSON.parse(s) as SupplierEventBody) : {};
    } catch {
      return json(400, { error: "invalid JSON" });
    }

    const type = String(body.type ?? "");
    if (!EVENT_TYPES.has(type)) {
      return json(400, { error: `type must be one of: ${[...EVENT_TYPES].join(", ")}` });
    }
    if (!Number.isInteger(body.supplierId) || !body.supplierName) {
      return json(400, { error: "supplierId and supplierName are required" });
    }
    const message = String(body.message ?? "").trim();
    if ((type === "supplier_message" || type === "instruction") && !message) {
      return json(400, { error: "message is required for this event type" });
    }
    const from = String(body.from ?? "").trim();
    if (type === "instruction" && !from) {
      return json(400, { error: "from is required for instruction events" });
    }

    const ar = body.availabilityRequestId;
    const jr = body.jobRequestId;
    const about = jr != null ? ` (job request JR-${jr})` : "";
    const text =
      type === "availability_submitted"
        ? `${body.supplierName} saved their answers on availability request AR-${ar}${about}.`
        : type === "supplier_message"
          ? `${body.supplierName} wrote${ar != null ? ` on availability request AR-${ar}` : ""}${about}:\n\n${message}`
          : `Instruction from ${from} on the ${body.supplierName} thread${about}:\n\n${message}`;

    // One supplier = one thread — the override pins the exact id, so the
    // app's events, rosie's asks and Chris's instructions all share it.
    const mainThread = `supplier-${body.supplierId}`;

    ctx.notify(type, {
      text,
      channelId: mainThread,
      threadIdOverride: mainThread,
      metadata: {
        EventType: type,
        SupplierId: body.supplierId,
        SupplierName: body.supplierName,
        ...(ar != null ? { AvailabilityRequestId: ar } : {}),
        ...(jr != null ? { JobRequestId: jr } : {}),
        ...(from ? { From: from } : {}),
      },
    });
    return json(200, { ok: true });
  }
}

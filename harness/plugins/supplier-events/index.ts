import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * supplier-events — the app tells an agent something happened with a supplier.
 *
 * The web app POSTs here (`app/lib/notify-supplier-events.ts`) and the plugin
 * wakes the agent. Enabled on **rosie** — she owns order-side supplier
 * coordination, the portal included. One event kind (recreated lean
 * 2026-08-23; the earlier daisy incarnation's `supplier_message` /
 * `instruction` kinds died with the portal chat and `supplier_messages`):
 *
 * - `availability_submitted` — a supplier pressed Save on an availability
 *   request in their portal.
 *
 * Everything the event is *about* lives in the database
 * (availability_requests, availability_request_items), so the notification
 * carries identifiers only.
 *
 * Threads: **one supplier = one thread** — the app passes the supplier's
 * `suppliers.rosie_thread_id` as `threadId`; a supplier whose column is still
 * NULL falls back to the agent's `router` thread, whose skill mints the id.
 *
 * Auth: the caller is the app, not an in-harness process, so the boot-time
 * COGNISPHERE_WEBHOOK_SECRET is not usable here. A dedicated shared secret
 * (SUPPLIER_EVENTS_APP_SECRET) is wired into both the agent's secrets bucket
 * and app/.env.local by scripts/app/secrets.sh — the same split the artifacts
 * secret uses.
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
  /** The supplier's `rosie_thread_id`; null → the router thread. */
  threadId?: string | null;
}

export default class SupplierEventsPlugin {
  manifest = {
    displayName: "Supplier Events",
    description:
      "Wakes the agent when a supplier saves an availability request in their portal. POST /webhook/<agent>/supplier-events/notify from the app.",
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

    if (String(body.type ?? "") !== "availability_submitted") {
      return json(400, { error: "type must be availability_submitted" });
    }
    if (!Number.isInteger(body.supplierId) || !body.supplierName) {
      return json(400, { error: "supplierId and supplierName are required" });
    }
    if (body.availabilityRequestId == null) {
      return json(400, { error: "availabilityRequestId is required" });
    }

    const ar = body.availabilityRequestId;
    const jr = body.jobRequestId;
    const about = jr != null ? ` (job request JR-${jr})` : "";
    const text = `${body.supplierName} saved their answers on availability request AR-${ar}${about}.`;

    // One supplier = one thread (suppliers.rosie_thread_id); a supplier with
    // no thread id yet wakes the router thread, which mints and records one.
    const thread = String(body.threadId ?? "").trim() || "router";

    ctx.notify("availability_submitted", {
      text,
      channelId: thread,
      threadIdOverride: thread,
      metadata: {
        EventType: "availability_submitted",
        SupplierId: body.supplierId,
        SupplierName: body.supplierName,
        AvailabilityRequestId: ar,
        ...(jr != null ? { JobRequestId: jr } : {}),
      },
    });
    return json(200, { ok: true });
  }
}

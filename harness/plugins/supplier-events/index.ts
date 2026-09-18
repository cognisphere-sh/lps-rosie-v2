import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * supplier-events — the app tells an agent something happened with a supplier.
 *
 * The web app POSTs here (`app/lib/notify-supplier-events.ts`) and the plugin
 * wakes the agent. Enabled on **rosie** — she owns order-side supplier
 * coordination, including partner portals and public availability links:
 *
 * - `availability_updated` — a supplier saved answers without submitting.
 * - `availability_submitted` — a supplier explicitly submitted their answers.
 *
 * Everything the event is *about* lives in the database
 * (availability_requests, availability_request_items), so the notification
 * carries identifiers only.
 *
 * Threads: **one supplier = one thread** — the app passes the supplier's
 * `suppliers.rosie_thread_id` as `threadId`; a supplier whose column is still
 * NULL falls back to the agent's `main` thread, whose routing skill mints the id.
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
  orderId?: number | null;
  orderItemId?: number | null;
  status?: string;
  changes?: { itemId?: number; status?: string; note?: string }[];
  /** The supplier's `rosie_thread_id`; null → the main thread. */
  threadId?: string | null;
}

export default class SupplierEventsPlugin {
  manifest = {
    displayName: "Supplier Events",
    description:
      "Wakes the supplier thread when answers are saved or submitted through a portal or public link. POST /webhook/<agent>/supplier-events/notify from the app.",
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

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(400, { error: "event must be an object" });
    }
    if (body.type !== "availability_submitted" && body.type !== "availability_updated" && body.type !== "order_status_updated" && body.type !== "order_status_saved") {
      return json(400, { error: "unsupported event type" });
    }
    if (!Number.isSafeInteger(body.supplierId) || Number(body.supplierId) <= 0 ||
        typeof body.supplierName !== "string" || !body.supplierName.trim()) {
      return json(400, { error: "supplierId and supplierName are required" });
    }
    const availability = body.type === "availability_submitted" || body.type === "availability_updated";
    if (availability && (!Number.isSafeInteger(body.availabilityRequestId) || Number(body.availabilityRequestId) <= 0)) {
      return json(400, { error: "availabilityRequestId must be a positive integer" });
    }
    if (availability && body.jobRequestId != null && (!Number.isSafeInteger(body.jobRequestId) || body.jobRequestId <= 0)) {
      return json(400, { error: "jobRequestId must be a positive integer or null" });
    }
    if (!availability && (!Number.isSafeInteger(body.orderId) || Number(body.orderId) <= 0
      || !Number.isSafeInteger(body.orderItemId) || Number(body.orderItemId) <= 0 || typeof body.status !== "string" || !body.status.trim())) {
      if (body.type !== "order_status_saved" || !Array.isArray(body.changes) || !body.changes.length || body.changes.some((change) => !Number.isSafeInteger(change.itemId) || Number(change.itemId) <= 0 || typeof change.status !== "string" || !change.status.trim() || typeof change.note !== "string")) return json(400, { error: "order status changes are required" });
    }
    if (body.threadId != null && typeof body.threadId !== "string") {
      return json(400, { error: "threadId must be a string or null" });
    }

    const ar = body.availabilityRequestId;
    const jr = body.jobRequestId;
    const about = jr != null ? ` (job request JR-${jr})` : "";
    const action = body.type === "availability_submitted" ? "submitted their answers" : "saved answer changes without submitting";
    const text = availability
      ? `${body.supplierName.trim()} ${action} on availability request AR-${ar}${about}.`
      : body.type === "order_status_saved" ? `${body.supplierName.trim()} saved ${body.changes!.length} order status change${body.changes!.length === 1 ? '' : 's'} on order O-${body.orderId}.`
      : `${body.supplierName.trim()} saved ${body.status!.trim()} for line ${body.orderItemId} on order O-${body.orderId}.`;

    // One supplier = one thread (suppliers.rosie_thread_id); a supplier with
    // no thread id yet wakes main, which mints and records one before relaying.
    const thread = String(body.threadId ?? "").trim() || "main";

    ctx.notify(body.type, {
      text,
      channelId: thread,
      threadIdOverride: thread,
      metadata: {
        EventType: body.type,
        SupplierId: body.supplierId,
        SupplierName: body.supplierName,
        ...(availability ? { AvailabilityRequestId: ar, ...(jr != null ? { JobRequestId: jr } : {}) } : {}),
        ...(!availability ? { OrderId: body.orderId, ...(body.type === "order_status_saved" ? { OrderStatusChanges: body.changes } : { OrderItemId: body.orderItemId, OrderItemStatus: body.status!.trim() }) } : {}),
      },
    });
    return json(200, { ok: true });
  }
}

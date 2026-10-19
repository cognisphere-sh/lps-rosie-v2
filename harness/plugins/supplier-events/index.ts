import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * supplier-events — the app tells an agent something happened with a supplier.
 *
 * The web app POSTs here (`app/lib/notify-supplier-events.ts`) and the plugin
 * wakes the agent. Enabled on **rosie** — she owns order-side supplier
 * coordination, including partner portals and public availability links:
 *
 * - `availability_updated` — a supplier saved answers without submitting.
 *   Accepted and acknowledged, but never delivered: saves don't wake Rosie.
 * - `availability_submitted` — a supplier explicitly submitted their answers.
 * - `order_updated` — confirmation, ready status, fulfillment date or supplier notes.
 * - `order_status_updated` / `order_status_saved` — order-line status changes.
 *
 * Everything the event is *about* lives in the database
 * (availability_requests, candidates), so the notification
 * carries identifiers only.
 *
 * Threads: **one job = one thread** — the app passes the AR's or order's job
 * thread (`jr-<job_request_id>`) as `threadId`, since that thread owns all of
 * the job's supplier work; an event without one falls back to `main`.
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
  orderChanges?: { field: string; previous: string | null; value: string | null }[];
  changes?: { itemId?: number; status?: string; note?: string }[];
  /** The job's thread, `jr-<id>`; null → the main thread. */
  threadId?: string | null;
}

export default class SupplierEventsPlugin {
  manifest = {
    displayName: "Supplier Events",
    description:
      "Wakes the job's thread when a supplier submits answers or changes an order through a portal or public link. POST /webhook/<agent>/supplier-events/notify from the app.",
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
    if (body.type !== "availability_submitted" && body.type !== "availability_updated" && body.type !== "order_status_updated" && body.type !== "order_status_saved" && body.type !== "order_updated") {
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
    if (!availability && (!Number.isSafeInteger(body.orderId) || Number(body.orderId) <= 0)) {
      return json(400, { error: "orderId must be a positive integer" });
    }
    if (body.type === "order_updated") {
      if (!Array.isArray(body.orderChanges) || !body.orderChanges.length || body.orderChanges.length > 3 || body.orderChanges.some((change) =>
        !change || !["status", "fulfillmentDate", "noteForSupplier", "noteFromSupplier"].includes(change.field) ||
        !(change.previous === null || typeof change.previous === "string") ||
        !(change.value === null || typeof change.value === "string") ||
        (change.field === "status" && !["processing", "order_ready"].includes(change.value ?? "")))) {
        return json(400, { error: "orderChanges are required" });
      }
    } else if (body.type === "order_status_saved") {
      if (!Array.isArray(body.changes) || !body.changes.length || body.changes.some((change) => !change || !Number.isSafeInteger(change.itemId) || Number(change.itemId) <= 0 || typeof change.status !== "string" || !change.status.trim() || typeof change.note !== "string")) {
        return json(400, { error: "order status changes are required" });
      }
    } else if (body.type === "order_status_updated" && (!Number.isSafeInteger(body.orderItemId) || Number(body.orderItemId) <= 0 || typeof body.status !== "string" || !body.status.trim())) {
      return json(400, { error: "order item and status are required" });
    }
    if (body.threadId != null && typeof body.threadId !== "string") {
      return json(400, { error: "threadId must be a string or null" });
    }
    // Saves without submitting don't wake Rosie; only submission does.
    if (body.type === "availability_updated") return json(200, { ok: true, delivered: false });

    const ar = body.availabilityRequestId;
    const jr = body.jobRequestId;
    const about = jr != null ? ` (job request JR-${jr})` : "";
    const action = "submitted their answers";
    const savedStatus = body.orderChanges?.find((change) => change.field === "status")?.value;
    const orderAction = savedStatus === "order_ready" ? "marked ready" : savedStatus === "processing" ? "confirmed" : "updated";
    const orderSummary = body.orderChanges?.map((change) =>
      `${change.field}: ${JSON.stringify(change.previous)} → ${JSON.stringify(change.value)}`,
    ).join("; ");
    const text = availability
      ? `${body.supplierName.trim()} ${action} on availability request AR-${ar}${about}.`
      : body.type === "order_updated" ? `${body.supplierName.trim()} ${orderAction} order O-${body.orderId}. Changes: ${orderSummary}`
      : body.type === "order_status_saved" ? `${body.supplierName.trim()} saved ${body.changes!.length} order status change${body.changes!.length === 1 ? '' : 's'} on order O-${body.orderId}.`
      : `${body.supplierName.trim()} saved ${body.status!.trim()} for line ${body.orderItemId} on order O-${body.orderId}.`;

    // The app names the AR's or order's job thread (`jr-<id>`), which owns
    // all of that job's supplier work; without one the event wakes main.
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
        ...(!availability ? { OrderId: body.orderId, ...(body.type === "order_updated" ? { OrderChanges: body.orderChanges } : body.type === "order_status_saved" ? { OrderStatusChanges: body.changes } : { OrderItemId: body.orderItemId, OrderItemStatus: body.status!.trim() }) } : {}),
      },
    });
    return json(200, { ok: true });
  }
}

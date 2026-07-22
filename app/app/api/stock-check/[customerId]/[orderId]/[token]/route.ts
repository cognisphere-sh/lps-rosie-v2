// Public endpoint for the shared stock-check form. Lives under app/api/ so it
// is a Next route handler (a filesystem route) and therefore wins over the
// next.config `/api/:path*` proxy — only /api/stock-check/* runs here;
// everything else still proxies to the harness.
//
// The visiting grower has no harness session, so this handler talks to the
// harness server-side with a service login (HARNESS_USER / HARNESS_PASS) and
// caches the session cookie in module scope, re-logging-in on 401.
//
// On submit it does NOT write job.json directly: it saves the responses and
// pings the agent, which reconciles them into the order (confirming any
// conflicts with the operator) and updates the inventory notes.

import { NextResponse } from "next/server";
import type { Job } from "@/lib/types";
import {
  stockCheckPath,
  ITEM_TO_WS as JOB_TO_STATUS,
  type StockCheckRequest,
  type StockCheckResponse,
} from "@/lib/stock-check";

const HARNESS = process.env.HARNESS_URL ?? "http://127.0.0.1:7331";
const AGENT = "rosie";

let cookie: string | null = null;

async function login(): Promise<string> {
  const username = process.env.HARNESS_USER;
  const password = process.env.HARNESS_PASS;
  if (!username || !password) {
    throw new Error("HARNESS_USER / HARNESS_PASS not set");
  }
  const r = await fetch(`${HARNESS}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`harness login failed: ${r.status}`);
  const setCookie = r.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/pi_sid=[^;]+/);
  if (!m) throw new Error("harness login returned no session cookie");
  return m[0];
}

async function hfetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  if (!cookie) cookie = await login();
  const r = await fetch(`${HARNESS}${path}`, {
    ...init,
    headers: { ...init.headers, cookie },
    cache: "no-store",
  });
  if (r.status === 401 && retry) {
    cookie = null;
    return hfetch(path, init, false);
  }
  return r;
}

async function readJson<T>(wsPath: string): Promise<T> {
  const r = await hfetch(`/api/agents/${AGENT}/fs/file?path=${encodeURIComponent(wsPath)}`);
  if (!r.ok) throw new Error(`read ${wsPath}: ${r.status}`);
  return JSON.parse(((await r.json()) as { content: string }).content) as T;
}

async function writeJson(wsPath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  const r = await hfetch(`/api/agents/${AGENT}/fs/file?path=${encodeURIComponent(wsPath)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) throw new Error(`write ${wsPath}: ${r.status}`);
}

// Wake the agent that a stock-check response landed: just the order and the
// saved file path — the agent reads the file and reconciles per its SOP. Routed
// to the customer's thread and marked with a <stock-check-response> block the
// SOP recognizes. Best-effort: the responses are already saved, so a failed
// ping doesn't fail the grower's submit.
async function notifyAgent(req: StockCheckRequest, savedPath: string): Promise<void> {
  const project = req.items[0]?.projectName ?? req.orderId;
  const text = `<stock-check-response>
Stock check response received for order "${project}" (${req.customerId}/${req.orderId}).
Submitted by: ${req.growerName || "unknown"}
Saved file: ${savedPath}
</stock-check-response>

Read the saved file and reconcile it into the order per your stock-check SOP — confirm anything ambiguous or conflicting with me before applying, and update the inventory notes.`;

  const r = await hfetch(`/admin/${AGENT}/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, threadId: req.customerId, channelId: req.customerId }),
  });
  if (!r.ok) throw new Error(`notify agent: ${r.status}`);
}

// Reject path-traversal segments before they reach the workspace path.
const ok = (s: string) => /^[A-Za-z0-9_-]+$/.test(s);

// Overlay the current job.json values onto each request item so the grower sees
// the row's real-time status/price/notes, not the snapshot from when the link
// was made. Best-effort: a missing job/item just keeps the snapshot.
async function withLiveItems(req: StockCheckRequest): Promise<StockCheckRequest> {
  const job = await readJson<Job>(
    `workspace/customers/${req.customerId}/jobs/${req.orderId}/job.json`,
  ).catch(() => null);
  if (!job) return req;
  const items = req.items.map((i) => {
    const live = job.items.find((it) => it.id === i.itemId);
    if (!live) return i;
    return {
      ...i,
      plantName: live.plant_name,
      size: live.size,
      qty: live.quantity,
      unitPrice: live.price,
      status: JOB_TO_STATUS[live.status] ?? i.status,
      quoteNotes: live.customer_facing_notes ?? "",
      internalNotes: live.internal_notes ?? "",
    };
  });
  return { ...req, items };
}

type Ctx = { params: Promise<{ customerId: string; orderId: string; token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { customerId, orderId, token } = await params;
  if (![customerId, orderId, token].every(ok))
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  try {
    const req = await readJson<StockCheckRequest>(
      stockCheckPath(customerId, orderId, token),
    );
    return NextResponse.json(await withLiveItems(req));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Read the open request and merge in the submitted responses/grower. Returns
// the request + workspace path, or a NextResponse error to return as-is.
async function loadForSave(
  customerId: string,
  orderId: string,
  token: string,
  req: Request,
): Promise<
  | { request: StockCheckRequest; path: string }
  | { error: NextResponse }
> {
  if (![customerId, orderId, token].every(ok))
    return { error: NextResponse.json({ error: "bad path" }, { status: 400 }) };

  const body = (await req.json().catch(() => null)) as {
    growerName?: string;
    responses?: StockCheckResponse[];
  } | null;
  if (!body || !Array.isArray(body.responses)) {
    return {
      error: NextResponse.json({ error: "expected { responses }" }, { status: 400 }),
    };
  }

  const path = stockCheckPath(customerId, orderId, token);
  let request: StockCheckRequest;
  try {
    request = await readJson<StockCheckRequest>(path);
  } catch {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  if (request.status === "submitted") {
    return { error: NextResponse.json({ error: "already submitted" }, { status: 409 }) };
  }

  // Keep only responses for lines that are actually on this request.
  const known = new Set(request.items.map((i) => i.itemId));
  request.responses = body.responses.filter((r) => known.has(r.itemId));
  request.growerName = body.growerName?.trim();
  return { request, path };
}

// PATCH = partial save. Persists in-progress responses so the grower can leave
// and resume; stays "open" and does NOT notify the agent.
export async function PATCH(req: Request, { params }: Ctx) {
  const { customerId, orderId, token } = await params;
  const loaded = await loadForSave(customerId, orderId, token, req);
  if ("error" in loaded) return loaded.error;
  try {
    await writeJson(loaded.path, loaded.request);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "write failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

// POST = submit. Marks the request submitted and pings the agent (which reads
// the saved file and reconciles it). The full responses are saved here too, so
// the final state wins regardless of the last partial save.
export async function POST(req: Request, { params }: Ctx) {
  const { customerId, orderId, token } = await params;
  const loaded = await loadForSave(customerId, orderId, token, req);
  if ("error" in loaded) return loaded.error;

  const { request, path } = loaded;
  request.status = "submitted";
  request.submittedAt = new Date().toISOString();

  try {
    await writeJson(path, request);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "write failed" },
      { status: 500 },
    );
  }

  // The agent owns reconciliation into the order + inventory. Best-effort.
  try {
    await notifyAgent(request, path);
  } catch (e) {
    console.error("stock-check: agent notify failed", e);
  }

  return NextResponse.json({ ok: true });
}

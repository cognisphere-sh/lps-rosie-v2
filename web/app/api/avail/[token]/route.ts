// Public endpoint for the shared availability form. Lives under app/api/ so it
// is a Next route handler (a filesystem route) and therefore wins over the
// next.config `/api/:path*` proxy — only /api/avail/* runs here; everything
// else still proxies to the harness.
//
// The visiting grower has no harness session, so this handler talks to the
// harness server-side with a service login (HARNESS_USER / HARNESS_PASS) and
// caches the session cookie in module scope, re-logging-in on 401.

import { NextResponse } from "next/server";
import type { Job } from "@/lib/types";
import {
  availRequestPath,
  ITEM_FROM_WS as STATUS_TO_JOB,
  ITEM_TO_WS as JOB_TO_STATUS,
  type AvailRequest,
  type AvailResponse,
} from "@/lib/availability";

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

// Reject path-traversal tokens before they reach the workspace path.
const isToken = (t: string) => /^[A-Za-z0-9_-]+$/.test(t);

// STATUS_TO_JOB (WsItemStatus → job.json string) and its inverse JOB_TO_STATUS
// are the shared ITEM_FROM_WS / ITEM_TO_WS maps imported above.

// Overlay the current job.json values onto each request item so the grower sees
// the row's real-time status/price/notes, not the snapshot from when the link
// was made. Best-effort: a missing job/item just keeps the snapshot.
async function withLiveItems(req: AvailRequest): Promise<AvailRequest> {
  // Cache the in-flight promise (not the resolved value) so multiple items in
  // the same job share one read instead of each firing its own.
  const jobCache = new Map<string, Promise<Job | null>>();
  const items = await Promise.all(
    req.items.map(async (i) => {
      const key = `${i.customerId}/${i.orderId}`;
      if (!jobCache.has(key)) {
        jobCache.set(
          key,
          readJson<Job>(
            `workspace/customers/${i.customerId}/jobs/${i.orderId}/job.json`,
          ).catch(() => null),
        );
      }
      const live = (await jobCache.get(key))?.items.find((it) => it.id === i.itemId);
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
    }),
  );
  return { ...req, items };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isToken(token)) return NextResponse.json({ error: "bad token" }, { status: 400 });
  try {
    const req = await readJson<AvailRequest>(availRequestPath(token));
    return NextResponse.json(await withLiveItems(req));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isToken(token)) return NextResponse.json({ error: "bad token" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    growerName?: string;
    responses?: AvailResponse[];
  } | null;
  if (!body || !Array.isArray(body.responses)) {
    return NextResponse.json({ error: "expected { responses }" }, { status: 400 });
  }

  let request: AvailRequest;
  try {
    request = await readJson<AvailRequest>(availRequestPath(token));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (request.status === "submitted") {
    return NextResponse.json({ error: "already submitted" }, { status: 409 });
  }

  const refByItem = new Map(request.items.map((i) => [i.itemId, i]));
  // Group responses by the job they belong to so each job.json is read/written once.
  const groups = new Map<string, { customerId: string; orderId: string; resps: AvailResponse[] }>();
  for (const resp of body.responses) {
    const ref = refByItem.get(resp.itemId);
    if (!ref) continue;
    const key = `${ref.customerId}/${ref.orderId}`;
    let g = groups.get(key);
    if (!g) {
      g = { customerId: ref.customerId, orderId: ref.orderId, resps: [] };
      groups.set(key, g);
    }
    g.resps.push(resp);
  }

  const grower = body.growerName?.trim();
  try {
    for (const g of groups.values()) {
      const path = `workspace/customers/${g.customerId}/jobs/${g.orderId}/job.json`;
      const job = await readJson<Job>(path);
      for (const resp of g.resps) {
        const item = job.items.find((it) => it.id === resp.itemId);
        if (!item) continue;
        // The team edits the same fields the orders table exposes.
        item.status = STATUS_TO_JOB[resp.status] ?? item.status;
        item.plant_name = resp.plantName;
        item.size = resp.size;
        item.quantity = resp.qty;
        item.price = resp.unitPrice;
        item.customer_facing_notes = resp.quoteNotes ?? "";
        item.internal_notes = resp.internalNotes ?? "";
      }
      job.updated_at = new Date().toISOString();
      await writeJson(path, job);
    }

    request.status = "submitted";
    request.responses = body.responses;
    request.growerName = grower;
    request.submittedAt = new Date().toISOString();
    await writeJson(availRequestPath(token), request);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "write failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

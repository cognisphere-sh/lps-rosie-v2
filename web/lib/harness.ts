// Thin typed client for the cognisphere harness HTTP API.
// All paths are same-origin (Next rewrites proxy /api + /admin to the harness),
// so the harness auth cookie rides along automatically. Paths are relative to
// the agent dir, i.e. they start with "workspace/...".

export const AGENT = "rosie";

const base = `/api/agents/${AGENT}/fs`;

export async function readText(path: string): Promise<string> {
  const r = await fetch(`${base}/file?path=${encodeURIComponent(path)}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`read ${path}: ${r.status}`);
  return ((await r.json()) as { content: string }).content;
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readText(path)) as T;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  const r = await fetch(`${base}/file?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) throw new Error(`write ${path}: ${r.status}`);
}

// Remove a workspace file or directory (recursive). Used to discard a sent-out
// availability request.
export async function deletePath(path: string): Promise<void> {
  const r = await fetch(`${base}/path?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(`delete ${path}: ${r.status}`);
}

export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}

export async function tree(path: string): Promise<TreeEntry[]> {
  const r = await fetch(`${base}/tree?path=${encodeURIComponent(path)}`, {
    cache: "no-store",
  });
  if (!r.ok) {
    if (r.status === 404) return []; // dir doesn't exist yet
    throw new Error(`tree ${path}: ${r.status}`);
  }
  return ((await r.json()) as { entries: TreeEntry[] }).entries;
}

// Send a message to Rosie on the operator channel — this is both the chat
// "send" and the way to wake her after a direct data edit. Every call triggers
// an agent turn, so don't fire it on every inline edit (those just write files).
// `customerId` is sent as BOTH the threadId (one thread per customer; the
// harness honors it as a threadIdOverride ahead of the agent's thread strategy)
// AND the channelId, so the notification/event is tagged with the customer.
export async function sendToRosie(
  text: string,
  customerId?: string,
): Promise<void> {
  const body: { text: string; threadId?: string; channelId?: string } = { text };
  if (customerId) {
    body.threadId = customerId;
    body.channelId = customerId;
  }
  const r = await fetch(`/admin/${AGENT}/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`send: ${r.status}`);
}

// Upload a file into the agent workspace (default uploads/). Returns the stored
// path, which rawUrl() can serve back inline for <img> previews.
export async function uploadFile(
  file: File,
  dir = "uploads",
): Promise<{ path: string; name: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(
    `/api/agents/${AGENT}/fs/upload?dir=${encodeURIComponent(dir)}`,
    { method: "POST", body: form },
  );
  if (!r.ok) throw new Error(`upload ${file.name}: ${r.status}`);
  return (await r.json()) as { path: string; name: string; size: number };
}

// Same-origin URL serving a workspace file's raw bytes inline (for <img>/links).
export function rawUrl(path: string): string {
  return `/api/agents/${AGENT}/fs/raw?path=${encodeURIComponent(path)}`;
}

export interface ThreadInfo {
  threadId: string;
  activeSessionId: string | null;
  sessions: { sessionId: string; modified: number; size: number }[];
}

export async function listThreads(): Promise<ThreadInfo[]> {
  const r = await fetch(`/api/agents/${AGENT}/sessions`, { cache: "no-store" });
  if (!r.ok) throw new Error(`sessions: ${r.status}`);
  return ((await r.json()) as { threads: ThreadInfo[] }).threads;
}

export interface SessionEntry {
  type: string; // "message" | "session" | "model_change" | …
  id?: string;
  timestamp?: string;
  message?: {
    role: string; // "user" | "assistant" | "toolResult"
    content?: { type: string; text?: string }[];
  };
}

// How many events are still queued or being processed — i.e. Rosie has work in
// flight. 0 means idle. Drives the "working…" loading state in the UI.
export async function countActiveEvents(): Promise<number> {
  const r = await fetch(
    `/api/agents/${AGENT}/events?status=queued,in_flight&limit=1`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`events: ${r.status}`);
  return ((await r.json()) as { total: number }).total;
}

export type EventStatus =
  | "queued"
  | "in_flight"
  | "done"
  | "failed"
  | "cancelled";

export interface AgentEvent {
  id: number;
  status: EventStatus;
  text: string;
  updatedAt: number;
}

// The most recent event regardless of status (events default-sort newest-first
// by updated_at). Drives the live event-status badge in the chat header.
export async function latestEvent(): Promise<AgentEvent | null> {
  const r = await fetch(`/api/agents/${AGENT}/events?limit=1`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`events: ${r.status}`);
  const { events } = (await r.json()) as { events: AgentEvent[] };
  return events[0] ?? null;
}

// Raw session jsonl records; the caller filters to the message records it wants.
export async function readSession(
  threadId: string,
  sessionId: string,
): Promise<SessionEntry[]> {
  const r = await fetch(
    `/api/agents/${AGENT}/sessions/${encodeURIComponent(threadId)}/${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`session: ${r.status}`);
  return ((await r.json()) as { entries: SessionEntry[] }).entries;
}

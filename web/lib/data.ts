"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  countActiveEvents,
  latestEvent,
  listThreads,
  readJson,
  readSession,
  sendToRosie,
  tree,
  writeJson,
} from "./harness";
import type { CustomerWithJobs, Customer, InventoryEntry, Job } from "./types";

const POLL_MS = 4000;

// Generic: run an async loader on mount and re-run every POLL_MS. Returns the
// last good value plus a manual refresh(). Errors are surfaced but don't wipe
// the last good data.
function usePolled<T>(load: () => Promise<T>, intervalMs = POLL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}

// True while Rosie has any event queued or in flight. Polled a bit faster than
// the data views so the "working…" state feels responsive after a send/edit.
export function useAgentBusy() {
  const { data } = usePolled(countActiveEvents, 2000);
  return (data ?? 0) > 0;
}

// The most recent event's status, for the chat-header badge. null until loaded
// or if Rosie has no events yet.
export function useLatestEvent() {
  const { data } = usePolled(latestEvent, 2000);
  return data;
}

export interface InventoryRow {
  category: string; // filename, e.g. "shrub.json"
  idx: number; // position within that category file
  entry: InventoryEntry;
}

const INV_DIR = "workspace/inventory";

async function loadInventory(): Promise<InventoryRow[]> {
  const files = (await tree(INV_DIR)).filter(
    (e) => !e.isDir && e.name.endsWith(".json"),
  );
  const rows: InventoryRow[] = [];
  await Promise.all(
    files.map(async (f) => {
      const entries = await readJson<InventoryEntry[]>(`${INV_DIR}/${f.name}`);
      entries.forEach((entry, idx) =>
        rows.push({ category: f.name, idx, entry }),
      );
    }),
  );
  rows.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.entry.plant_name.localeCompare(b.entry.plant_name),
  );
  return rows;
}

export function useInventory() {
  const { data, error, refresh } = usePolled(loadInventory);

  // Re-read the one category file, patch the row at idx, write it back.
  // ponytail: position-indexed writeback + last-write-wins; re-read first so a
  // concurrent edit to another row in the same file isn't clobbered. Switch to
  // a stable per-entry id only if Rosie starts reordering entries in place.
  const save = useCallback(
    async (category: string, idx: number, patch: Partial<InventoryEntry>) => {
      const path = `${INV_DIR}/${category}`;
      const entries = await readJson<InventoryEntry[]>(path);
      entries[idx] = { ...entries[idx], ...patch };
      await writeJson(path, entries);
      await refresh();
    },
    [refresh],
  );

  return { rows: data, error, save, refresh };
}

const CUST_DIR = "workspace/customers";

async function loadCustomers(): Promise<CustomerWithJobs[]> {
  const dirs = (await tree(CUST_DIR)).filter((e) => e.isDir);
  const out = await Promise.all(
    dirs.map(async (d) => {
      const slug = d.name;
      let customer: Customer;
      try {
        customer = await readJson<Customer>(
          `${CUST_DIR}/${slug}/customer.json`,
        );
      } catch {
        // e.g. customers/unknown/ has no profile yet
        customer = {
          slug,
          name: slug,
          poc_name: "",
          phones: [],
          emails: [],
          address: "",
          notes: "",
          created_at: "",
        };
      }
      const jobDirs = (await tree(`${CUST_DIR}/${slug}/jobs`)).filter(
        (e) => e.isDir,
      );
      const jobs = (
        await Promise.all(
          jobDirs.map(async (j) => {
            try {
              const job = await readJson<Job>(
                `${CUST_DIR}/${slug}/jobs/${j.name}/job.json`,
              );
              return { dir: j.name, job };
            } catch {
              return null;
            }
          }),
        )
      ).filter((x): x is { dir: string; job: Job } => x !== null);
      return { ...customer, jobs };
    }),
  );
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function useCustomers() {
  const { data, error, refresh } = usePolled(loadCustomers);

  // Patch one item inside a job.json (availability/price/status review).
  const saveJobItem = useCallback(
    async (
      slug: string,
      jobDir: string,
      itemId: string,
      patch: Partial<Job["items"][number]>,
    ) => {
      const path = `${CUST_DIR}/${slug}/jobs/${jobDir}/job.json`;
      const job = await readJson<Job>(path);
      job.items = job.items.map((it) =>
        it.id === itemId ? { ...it, ...patch } : it,
      );
      await writeJson(path, job);
      await refresh();
    },
    [refresh],
  );

  return { customers: data, error, saveJobItem, refresh };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: string;
}

// Strip the harness-metadata block the admin plugin prepends to operator
// messages so the bubble shows just what was said.
function cleanText(raw: string): string {
  return raw
    .replace(/<harness-metadata>[\s\S]*?<\/harness-metadata>\s*/g, "")
    .trim();
}

async function loadChat(): Promise<ChatMessage[]> {
  const threads = await listThreads();
  if (threads.length === 0) return [];
  // Rosie is single-thread; threads come back newest-first. Open its canonical
  // active session (fall back to the newest on-disk session file).
  const t = threads[0];
  const sid = t.activeSessionId ?? t.sessions[0]?.sessionId;
  if (!sid) return [];

  const entries = await readSession(t.threadId, sid);
  const out: ChatMessage[] = [];
  for (const e of entries) {
    if (e.type !== "message" || !e.message) continue;
    const role = e.message.role;
    if (role !== "user" && role !== "assistant") continue; // skip toolResult
    const text = cleanText(
      (e.message.content ?? [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text as string)
        .join("\n"),
    );
    if (!text) continue; // assistant turns that were only thinking/tool calls
    out.push({ id: e.id ?? `${out.length}`, role, text, ts: e.timestamp ?? "" });
  }
  return out;
}

export function useChat() {
  const { data, error, refresh } = usePolled(loadChat);
  const send = useCallback(
    async (text: string) => {
      await sendToRosie(text);
      await refresh();
    },
    [refresh],
  );
  return { messages: data, error, send, refresh };
}

"use client";

// Bridges the polished mock's view-model (Ws* shapes) to Rosie's real workspace
// files. Load = map real file JSON -> Ws*; persist = read-modify-write the file
// by id so untouched fields (metadata, tax, attachments…)
// are preserved. The mock component stays verbatim; only its data source swaps.

import { useCallback, useEffect, useState } from "react";
import { deletePath, readJson, tree, writeJson } from "./harness";
import { ITEM_FROM_WS, ITEM_TO_WS } from "./availability";
import type { Customer, InventoryEntry, Job, JobItem } from "./types";
import type {
  WsCustomer,
  WsInventoryItem,
  WsOrder,
  WsProjectStatus,
} from "@/components/supplier/supplier-workspace-data";

// ── status maps (real job.json values ⇄ mock Ws values) ───────────────────
// ITEM_TO_WS / ITEM_FROM_WS live in ./availability (shared with the server route).
const PROJ_TO_WS: Record<string, WsProjectStatus> = {
  pending: "confirmation_pending",
  quote_sent: "quote_delivered",
  order_confirmed: "order_confirmed",
  closed_won: "closed_won",
  closed_lost: "closed_lost",
  cancelled: "archived",
};
const PROJ_FROM_WS: Record<WsProjectStatus, string> = {
  confirmation_pending: "pending",
  quote_delivered: "quote_sent",
  order_confirmed: "order_confirmed",
  closed_won: "closed_won",
  closed_lost: "closed_lost",
  archived: "cancelled",
};

const INV_DIR = "workspace/inventory";
const CUST_DIR = "workspace/customers";

// ── load: real → Ws ────────────────────────────────────────────────────────
async function loadWsInventory(): Promise<WsInventoryItem[]> {
  const files = (await tree(INV_DIR)).filter(
    (e) => !e.isDir && e.name.endsWith(".json"),
  );
  const out: WsInventoryItem[] = [];
  await Promise.all(
    files.map(async (f) => {
      const arr = await readJson<InventoryEntry[]>(`${INV_DIR}/${f.name}`);
      const section = f.name.replace(/\.json$/, "");
      arr.forEach((e, idx) =>
        out.push({
          id: `${section}:${idx}`,
          section,
          name: e.plant_name,
          commonNames: e.common_names?.length
            ? e.common_names.join(", ")
            : undefined,
          size: e.size,
          price: e.unit_price,
          qty: null, // real inventory has no on-hand qty field
          notes: e.comment || undefined,
          lastUpdatedAt: "",
          attachments: [],
        }),
      );
    }),
  );
  out.sort(
    (a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name),
  );
  return out;
}

function jobToWs(slug: string, dir: string, job: Job): WsOrder {
  return {
    id: dir,
    customerId: slug,
    projectName: job.job_name,
    status: PROJ_TO_WS[job.status] ?? "confirmation_pending",
    createdOn: job.created_at,
    lastUpdatedOn: job.updated_at || job.created_at,
    notes: job.customer_comments || undefined,
    items: job.items.map((it) => ({
      id: it.id,
      qty: it.quantity,
      size: it.size,
      name: it.plant_name,
      customerNotes: it.customer_comments || undefined,
      unitPrice: it.price,
      internalNotes: it.internal_notes || undefined,
      quoteNotes: it.customer_facing_notes || undefined,
      status: ITEM_TO_WS[it.status] ?? "confirmation_pending",
      attachments: [],
      pendingInput:
        it.status === "pending" ? "Confirm availability & price" : undefined,
      lastUpdatedOn: "",
    })),
  };
}

async function loadWsCustomersOrders(): Promise<{
  customers: WsCustomer[];
  orders: WsOrder[];
}> {
  const dirs = (await tree(CUST_DIR)).filter((e) => e.isDir);
  const customers: WsCustomer[] = [];
  const orders: WsOrder[] = [];
  await Promise.all(
    dirs.map(async (d) => {
      const slug = d.name;
      let c: Customer | null = null;
      try {
        c = await readJson<Customer>(`${CUST_DIR}/${slug}/customer.json`);
      } catch {
        // e.g. customers/unknown/ has no profile yet
      }
      customers.push(
        c
          ? {
              id: slug,
              name: c.name,
              pocName: c.poc_name,
              phones: c.phones,
              emails: c.emails,
              address: c.address,
              notes: c.notes,
              createdOn: c.created_at,
            }
          : {
              id: slug,
              name: slug,
              pocName: "",
              phones: [],
              emails: [],
              address: "",
              notes: "",
              createdOn: "",
            },
      );
      const jobDirs = (await tree(`${CUST_DIR}/${slug}/jobs`)).filter(
        (e) => e.isDir,
      );
      await Promise.all(
        jobDirs.map(async (j) => {
          try {
            const job = await readJson<Job>(
              `${CUST_DIR}/${slug}/jobs/${j.name}/job.json`,
            );
            orders.push(jobToWs(slug, j.name, job));
          } catch {
            // skip unreadable job
          }
        }),
      );
    }),
  );
  customers.sort((a, b) => a.name.localeCompare(b.name));
  orders.sort((a, b) => (b.createdOn || "").localeCompare(a.createdOn || ""));
  return { customers, orders };
}

// ── persist: Ws → real (read-modify-write by id) ───────────────────────────
function wsItemToJobItem(w: WsOrder["items"][number]): JobItem {
  return {
    id: w.id,
    plant_name: w.name,
    customer_comments: w.customerNotes ?? "",
    size: w.size,
    quantity: w.qty,
    price: w.unitPrice,
    status: ITEM_FROM_WS[w.status] ?? "pending",
    customer_facing_notes: w.quoteNotes ?? "",
    internal_notes: w.internalNotes ?? "",
  };
}

export async function persistWsOrder(o: WsOrder): Promise<void> {
  const path = `${CUST_DIR}/${o.customerId}/jobs/${o.id}/job.json`;
  const job = await readJson<Job>(path);
  job.status = PROJ_FROM_WS[o.status] ?? job.status;
  job.customer_comments = o.notes ?? "";
  const byId = new Map(o.items.map((i) => [i.id, i]));
  job.items = job.items.map((it) => {
    const w = byId.get(it.id);
    if (!w) return it;
    return {
      ...it,
      quantity: w.qty,
      size: w.size,
      plant_name: w.name,
      customer_comments: w.customerNotes ?? "",
      price: w.unitPrice,
      internal_notes: w.internalNotes ?? "",
      customer_facing_notes: w.quoteNotes ?? "",
      status: ITEM_FROM_WS[w.status] ?? it.status,
    };
  });
  // Rows the mock added that aren't in the file yet.
  for (const w of o.items) {
    if (!job.items.find((it) => it.id === w.id)) job.items.push(wsItemToJobItem(w));
  }
  job.updated_at = new Date().toISOString();
  await writeJson(path, job);
}

export async function persistWsInventoryItem(w: WsInventoryItem): Promise<void> {
  const [section, idxStr] = w.id.split(":");
  const idx = Number(idxStr);
  const path = `${INV_DIR}/${section}.json`;
  const arr = await readJson<InventoryEntry[]>(path);
  if (!arr[idx]) return;
  arr[idx] = {
    ...arr[idx],
    plant_name: w.name,
    size: w.size,
    unit_price: w.price,
    common_names: w.commonNames
      ? w.commonNames.split(",").map((s) => s.trim()).filter(Boolean)
      : arr[idx].common_names,
    comment: w.notes ?? "",
  };
  await writeJson(path, arr);
}

// ── add / delete rows (write the file, caller reloads to resync ids) ───────
// Inventory ids are positional (`section:idx`), so deletes splice the array
// and adds append — ids are recomputed on the next load.
export async function addWsInventoryRow(section: string): Promise<void> {
  const path = `${INV_DIR}/${section}.json`;
  let arr: InventoryEntry[] = [];
  try {
    arr = await readJson<InventoryEntry[]>(path);
  } catch {
    // new section file
  }
  arr.push({
    plant_name: "",
    size: "",
    unit_price: null,
    common_names: [],
    comment: "",
    attachments: [],
  });
  await writeJson(path, arr);
}

export async function deleteWsInventoryItems(
  items: WsInventoryItem[],
): Promise<void> {
  // Group by section; splice descending so earlier indices stay valid.
  const bySection = new Map<string, number[]>();
  for (const w of items) {
    const [section, idxStr] = w.id.split(":");
    const idx = Number(idxStr);
    if (!Number.isInteger(idx)) continue;
    const list = bySection.get(section) ?? [];
    list.push(idx);
    bySection.set(section, list);
  }
  await Promise.all(
    [...bySection].map(async ([section, idxs]) => {
      const path = `${INV_DIR}/${section}.json`;
      const arr = await readJson<InventoryEntry[]>(path);
      for (const idx of idxs.sort((a, b) => b - a)) {
        if (idx >= 0 && idx < arr.length) arr.splice(idx, 1);
      }
      await writeJson(path, arr);
    }),
  );
}

export async function addWsOrderItem(
  customerId: string,
  orderId: string,
): Promise<void> {
  const path = `${CUST_DIR}/${customerId}/jobs/${orderId}/job.json`;
  const job = await readJson<Job>(path);
  job.items.unshift({
    id: crypto.randomUUID().slice(0, 8),
    plant_name: "",
    customer_comments: "",
    size: "",
    quantity: 1,
    price: null,
    status: "pending",
    customer_facing_notes: "",
    internal_notes: "",
  });
  job.updated_at = new Date().toISOString();
  await writeJson(path, job);
}

export async function deleteWsOrderItems(
  items: { order: WsOrder; itemId: string }[],
): Promise<void> {
  const byOrder = new Map<
    string,
    { customerId: string; orderId: string; ids: Set<string> }
  >();
  for (const { order, itemId } of items) {
    const key = `${order.customerId}/${order.id}`;
    let e = byOrder.get(key);
    if (!e) {
      e = { customerId: order.customerId, orderId: order.id, ids: new Set() };
      byOrder.set(key, e);
    }
    e.ids.add(itemId);
  }
  await Promise.all(
    [...byOrder.values()].map(async ({ customerId, orderId, ids }) => {
      const path = `${CUST_DIR}/${customerId}/jobs/${orderId}/job.json`;
      const job = await readJson<Job>(path);
      job.items = job.items.filter((it) => !ids.has(it.id));
      job.updated_at = new Date().toISOString();
      await writeJson(path, job);
    }),
  );
}

// Delete a whole order: removes its job dir (job.json + any attachments).
export async function deleteWsOrder(order: WsOrder): Promise<void> {
  await deletePath(`${CUST_DIR}/${order.customerId}/jobs/${order.id}`);
}

export async function persistWsCustomer(w: WsCustomer): Promise<void> {
  const path = `${CUST_DIR}/${w.id}/customer.json`;
  const c = await readJson<Customer>(path);
  await writeJson(path, {
    ...c,
    name: w.name,
    poc_name: w.pocName,
    phones: w.phones,
    emails: w.emails,
    address: w.address,
    notes: w.notes,
    created_at: w.createdOn,
  });
}

// ── hook: load the whole workspace once; reload on demand ───────────────────
export interface WsData {
  customers: WsCustomer[];
  orders: WsOrder[];
  inventory: WsInventoryItem[];
}

export function useWorkspace() {
  const [data, setData] = useState<WsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [inventory, co] = await Promise.all([
        loadWsInventory(),
        loadWsCustomersOrders(),
      ]);
      setData({ inventory, customers: co.customers, orders: co.orders });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}

// Shared shapes for the "availability request" flow: the supplier selects order
// lines (possibly across several jobs), generates a request file, and shares a
// link. The internal team opens the link, reviews availability + pricing in the
// same table as the orders view, and submits — the route handler writes the
// edited fields back into each job.json item.
//
// Pure types/consts only, so both the client view and the server route can
// import it.

import type { WsItemStatus } from "@/components/supplier/supplier-workspace-data";

export interface AvailRequestItem {
  customerId: string;
  /** Job dir under workspace/customers/<customerId>/jobs/. */
  orderId: string;
  itemId: string;
  projectName: string;
  customerName: string;
  // Snapshot of the order line — prefills the editable table.
  plantName: string;
  size: string;
  qty: number;
  unitPrice: number | null;
  status: WsItemStatus;
  quoteNotes: string;
  internalNotes: string;
}

// What the team edited per line; mirrors the editable order-table fields.
export interface AvailResponse {
  itemId: string;
  plantName: string;
  size: string;
  qty: number;
  unitPrice: number | null;
  status: WsItemStatus;
  quoteNotes: string;
  internalNotes: string;
}

export interface AvailRequest {
  token: string;
  createdAt: string;
  supplier: string;
  status: "open" | "submitted";
  items: AvailRequestItem[];
  responses?: AvailResponse[];
  growerName?: string;
  submittedAt?: string;
}

// Item status maps: job.json string ⇄ WsItemStatus (UI). Pure data, shared by
// the client ws-adapter and the server-side availability route so the mapping
// lives in exactly one place. Keep in lockstep with ITEM_STATUS_META.
export const ITEM_FROM_WS: Record<WsItemStatus, string> = {
  confirmation_pending: "pending",
  available: "available",
  unavailable: "unavailable",
  can_order: "can_order",
  diff_size_qty: "diff",
  price_missing: "price_missing",
  ordered: "ordered",
};
export const ITEM_TO_WS: Record<string, WsItemStatus> = {
  pending: "confirmation_pending",
  available: "available",
  unavailable: "unavailable",
  can_order: "can_order",
  diff: "diff_size_qty",
  price_missing: "price_missing",
  ordered: "ordered",
};

export const availRequestsDir = "workspace/availability-requests";

export const availRequestPath = (token: string) =>
  `${availRequestsDir}/${token}.json`;

// Statuses offered in the availability popup (the four that matter for a check).
// Picking diff_size_qty / can_order opens the detail popup; available /
// unavailable apply immediately.
export const AVAIL_STATUS_OPTIONS: WsItemStatus[] = [
  "available",
  "can_order",
  "diff_size_qty",
  "unavailable",
];

// Customer-facing notes for a "diff" line. A diff can change qty, size, and/or
// the plant; each becomes one "Requested: <original>, Alternate: <new>" line the
// customer sees. Re-confirming must not stack duplicates, so any prior such line
// is stripped before the fresh ones are appended.
// ponytail: on a second diff the "original" is the already-changed value, not
// the very first request. Acceptable; parse-the-prior-note if that ever matters.
const DIFF_LINE = /^Requested: .*, Alternate: .*$/gm;

type Diff = { from: string; to: string };

export function withDiffNotes(
  existing: string,
  diffs: { qty?: Diff; size?: Diff; plant?: Diff },
): string {
  const base = (existing || "").replace(DIFF_LINE, "").replace(/\n{2,}/g, "\n").trim();
  const lines = [diffs.qty, diffs.size, diffs.plant]
    .filter((d): d is Diff => !!d)
    .map((d) => `Requested: ${d.from}, Alternate: ${d.to}`);
  return [base, ...lines].filter(Boolean).join("\n");
}

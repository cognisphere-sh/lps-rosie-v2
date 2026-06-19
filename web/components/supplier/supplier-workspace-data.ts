// View-model types for the supplier workspace. The live data is loaded from
// Rosie's real workspace files via lib/ws-adapter.ts (Customer/Job/Inventory
// JSON -> the Ws* shapes below); useChat() supplies the conversation feed.
//
// Brokerage privacy: the brokerage ("Rosie Plant Brokerage") appears as a
// customer of this supplier, but its downstream landscapers are never named
// here — projects arrive under the brokerage's own references.

// ─── Customers ──────────────────────────────────────────────────────────────

export interface WsCustomer {
  /** Folder name under workspace/customers/. */
  id: string
  name: string
  pocName: string
  phones: string[]
  emails: string[]
  address: string
  notes: string
  createdOn: string
}

export const customerProfilePath = (c: Pick<WsCustomer, "id">) =>
  `workspace/customers/${c.id}/profile.md`

// ─── Orders ─────────────────────────────────────────────────────────────────

export type WsItemStatus =
  | "confirmation_pending"
  | "available"
  | "unavailable"
  | "can_order"
  | "diff_size_qty"
  | "price_missing"
  | "ordered"

export type WsProjectStatus =
  | "confirmation_pending"
  | "quote_delivered"
  | "order_confirmed"
  | "closed_won"
  | "closed_lost"
  | "archived"

export interface WsAttachment {
  /** Path under workspace/attachments/. */
  path: string
  lastUpdatedAt: string
  description: string
}

export interface WsOrderItem {
  id: string
  qty: number
  size: string
  name: string
  /** What the customer said about this line (verbatim-ish). */
  customerNotes?: string
  unitPrice: number | null
  /** Agent / supplier bookkeeping — never shown to the customer. */
  internalNotes?: string
  /** Note that goes out to the customer on the quote line. */
  quoteNotes?: string
  status: WsItemStatus
  attachments: WsAttachment[]
  /** Set when the agent is blocked on the supplier for this row. */
  pendingInput?: string
  lastUpdatedOn: string
}

export interface WsOrder {
  /** Folder name under workspace/customers/[customerId]/orders/. */
  id: string
  customerId: string
  projectName: string
  status: WsProjectStatus
  createdOn: string
  lastUpdatedOn: string
  notes?: string
  items: WsOrderItem[]
}

export const orderStatePath = (o: Pick<WsOrder, "id" | "customerId">) =>
  `workspace/customers/${o.customerId}/orders/${o.id}/state.json`

export const ITEM_STATUS_META: Record<
  WsItemStatus,
  { label: string; tone: "warn" | "success" | "danger" | "info" | "neutral" }
> = {
  confirmation_pending: { label: "Pending", tone: "warn" },
  available: { label: "Available", tone: "success" },
  unavailable: { label: "Unavailable", tone: "danger" },
  can_order: { label: "Can Order", tone: "info" },
  diff_size_qty: { label: "Diff (Size/Qty/Plant)", tone: "neutral" },
  price_missing: { label: "Price Missing", tone: "danger" },
  ordered: { label: "Ordered", tone: "info" },
}

// Item-status palette: Pending grey, Available green, Diff orange, Can Order
// yellow, Ordered blue, Unavailable & Price Missing red. `badge` colors the
// status pill / card count chips; `strip` colors the row's left edge.
export const ITEM_STATUS_COLOR: Record<
  WsItemStatus,
  { badge: string; strip: string }
> = {
  confirmation_pending: {
    badge: "bg-secondary text-secondary-foreground border-transparent",
    strip: "border-l-zinc-400 dark:border-l-zinc-500",
  },
  available: {
    badge:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    strip: "border-l-green-500",
  },
  diff_size_qty: {
    badge:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
    strip: "border-l-orange-500",
  },
  can_order: {
    badge:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    strip: "border-l-yellow-500",
  },
  ordered: {
    badge:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    strip: "border-l-blue-500",
  },
  unavailable: {
    badge:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    strip: "border-l-red-500",
  },
  price_missing: {
    badge:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    strip: "border-l-red-500",
  },
}

// An unavailable line carries no price and contributes nothing to a subtotal.
// This rule lives here so the table cells, project subtotals, and the quote
// email all agree on what counts as billable.
export const isUnavailable = (i: Pick<WsOrderItem, "status">) =>
  i.status === "unavailable"

export const lineTotal = (
  i: Pick<WsOrderItem, "status" | "unitPrice" | "qty">,
) => (isUnavailable(i) ? 0 : (i.unitPrice ?? 0) * i.qty)

export const PROJECT_STATUS_META: Record<
  WsProjectStatus,
  { label: string; tone: "warn" | "info" | "success" | "danger" | "muted" }
> = {
  confirmation_pending: { label: "Pending", tone: "warn" },
  quote_delivered: { label: "Quote Delivered", tone: "info" },
  order_confirmed: { label: "Order Confirmed", tone: "success" },
  closed_won: { label: "Closed Won", tone: "success" },
  closed_lost: { label: "Closed Lost", tone: "danger" },
  archived: { label: "Archived", tone: "muted" },
}

// ─── Availability & pricing (workspace/availability-pricing/) ───────────────

export interface WsInventoryItem {
  id: string
  /** One section = one file: workspace/availability-pricing/[section].md */
  section: string
  name: string
  commonNames?: string
  variety?: string
  size: string
  price: number | null
  height?: string
  width?: string
  caliper?: string
  qty: number | null
  notes?: string
  lastUpdatedAt: string
  attachments: WsAttachment[]
}

export const sectionFilePath = (section: string) =>
  `workspace/availability-pricing/${section.toLowerCase().replace(/\s+/g, "-")}.md`

// ─── Conversation ────────────────────────────────────────────────────────────

export interface WsChatMessage {
  id: string
  sender: "agent" | "supplier"
  source: "web" | "sms" | "email"
  body: string
  timestamp: string
  /** Workspace files the agent touched — rendered as path chips. */
  files?: string[]
  attachments?: { kind: "image" | "pdf"; label: string }[]
}

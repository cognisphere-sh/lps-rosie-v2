import {
    Check,
    CircleDollarSign,
    Clock,
    MoreHorizontal,
    Ruler,
    Truck,
    X,
    type LucideIcon,
} from "lucide-react"

// ============================================================================
// Status enums
// ============================================================================

// Raw status chosen by a supplier on an availability request.
export type AvailabilityStatusValue =
    | "Available"
    | "Unavailable"
    | "Can Order"
    | "Arriving Soon"
    | "Available (different size / partial quantity)"

// Status derived for a demand item on the internal Ops state page.
export type DemandStatus =
    | "available"
    | "partial"
    | "missing_price"
    | "can_order"
    | "arriving_soon"
    | "unavailable"
    | "pending"

export const AVAILABILITY_STATUSES: readonly AvailabilityStatusValue[] = [
    "Available",
    "Available (different size / partial quantity)",
    "Can Order",
    "Arriving Soon",
    "Unavailable",
] as const

export const DEMAND_STATUSES: readonly DemandStatus[] = [
    "available",
    "partial",
    "missing_price",
    "can_order",
    "arriving_soon",
    "unavailable",
    "pending",
] as const

// ============================================================================
// Visual metadata (icons + Tailwind tokens + plain-text glyphs)
// ============================================================================

export interface StatusVisual {
    label: string
    shortLabel: string
    icon: LucideIcon
    text: string
    border: string
    badge: string
    badgeLight: string
    rowBg: string
    chipIdle: string
    chipActive: string
    glyph: string
    glyphColor: string
}

const VISUAL: Record<string, StatusVisual> = {
    available: {
        label: "Available",
        shortLabel: "Available",
        icon: Check,
        text: "text-green-600",
        border: "border-l-green-500",
        badge: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
        badgeLight: "text-green-600 border-green-200 bg-green-50",
        rowBg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900",
        chipIdle: "border-transparent hover:bg-green-500/5",
        chipActive: "bg-green-500/10 border-green-500/40 ring-1 ring-green-500/30",
        glyph: "✓",
        glyphColor: "#16a34a",
    },
    partial: {
        label: "Diff Size/Qty",
        shortLabel: "Diff Size/Qty",
        icon: Ruler,
        text: "text-amber-600",
        border: "border-l-amber-500",
        badge: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
        badgeLight: "text-amber-600 border-amber-200 bg-amber-50",
        rowBg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
        chipIdle: "border-transparent hover:bg-amber-500/5",
        chipActive: "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30",
        glyph: "◐",
        glyphColor: "#d97706",
    },
    can_order: {
        label: "Can Order",
        shortLabel: "Can Order",
        icon: Truck,
        text: "text-blue-600",
        border: "border-l-blue-500",
        badge: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        badgeLight: "text-blue-600 border-blue-200 bg-blue-50",
        rowBg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900",
        chipIdle: "border-transparent hover:bg-blue-500/5",
        chipActive: "bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30",
        glyph: "→",
        glyphColor: "#2563eb",
    },
    arriving_soon: {
        label: "Arriving Soon",
        shortLabel: "Arriving Soon",
        icon: Clock,
        text: "text-cyan-600",
        border: "border-l-cyan-500",
        badge: "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800",
        badgeLight: "text-cyan-600 border-cyan-200 bg-cyan-50",
        rowBg: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900",
        chipIdle: "border-transparent hover:bg-cyan-500/5",
        chipActive: "bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30",
        glyph: "⏳",
        glyphColor: "#0891b2",
    },
    unavailable: {
        label: "Unavailable",
        shortLabel: "Unavailable",
        icon: X,
        text: "text-red-600",
        border: "border-l-red-500",
        badge: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
        badgeLight: "text-red-600 border-red-200 bg-red-50",
        rowBg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900",
        chipIdle: "border-transparent hover:bg-red-500/5",
        chipActive: "bg-red-500/10 border-red-500/40 ring-1 ring-red-500/30",
        glyph: "✗",
        glyphColor: "#dc2626",
    },
    missing_price: {
        label: "Missing Price",
        shortLabel: "Missing Price",
        icon: CircleDollarSign,
        text: "text-purple-600",
        border: "border-l-purple-500",
        badge: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
        badgeLight: "text-purple-600 border-purple-200 bg-purple-50",
        rowBg: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900",
        chipIdle: "border-transparent hover:bg-purple-500/5",
        chipActive: "bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30",
        glyph: "✗",
        glyphColor: "#dc2626",
    },
    pending: {
        label: "Pending",
        shortLabel: "Pending",
        icon: MoreHorizontal,
        text: "text-muted-foreground",
        border: "border-l-muted-foreground/40",
        badge: "bg-secondary text-secondary-foreground",
        badgeLight: "text-blue-600 border-blue-200 bg-blue-50",
        rowBg: "bg-muted/40 border-border",
        chipIdle: "border-transparent hover:bg-muted",
        chipActive: "bg-muted border-muted-foreground/40 ring-1 ring-muted-foreground/20",
        glyph: "•",
        glyphColor: "#71717a",
    },
}

// ============================================================================
// Public lookups
// ============================================================================

export const DEMAND_STATUS_META: Record<DemandStatus, StatusVisual> = {
    available: VISUAL.available,
    partial: VISUAL.partial,
    missing_price: VISUAL.missing_price,
    can_order: VISUAL.can_order,
    arriving_soon: VISUAL.arriving_soon,
    unavailable: VISUAL.unavailable,
    pending: VISUAL.pending,
}

export const AVAILABILITY_STATUS_META: Record<AvailabilityStatusValue, StatusVisual> = {
    "Available": VISUAL.available,
    "Available (different size / partial quantity)": VISUAL.partial,
    "Can Order": VISUAL.can_order,
    "Arriving Soon": VISUAL.arriving_soon,
    "Unavailable": VISUAL.unavailable,
}

// ============================================================================
// "Arriving Soon" helpers
//
// We piggy-back on the existing free-text notes column (supplier_notes on
// availability items, quote_notes on demand items) to keep this change
// schema-free. The note carries a "Arriving Soon: <date>" prefix; the regex
// is used to detect the status from notes when deriving DemandStatus.
// ============================================================================

export const ARRIVING_SOON_RE = /arriving\s*soon/i
export const ARRIVING_SOON_PREFIX = "Arriving Soon:"

// Map a supplier-submitted availability status to the internal demand status.
export function availabilityToDemandStatus(
    status: AvailabilityStatusValue | null | undefined,
): DemandStatus | null {
    if (!status) return null
    switch (status) {
        case "Available": return "available"
        case "Available (different size / partial quantity)": return "partial"
        case "Can Order": return "can_order"
        case "Arriving Soon": return "arriving_soon"
        case "Unavailable": return "unavailable"
        default: return null
    }
}

export function formatArrivalNote(dateISO: string, extra?: string): string {
    const formatted = formatArrivalDate(dateISO)
    const head = `${ARRIVING_SOON_PREFIX} ${formatted}`
    const tail = (extra ?? "").trim()
    return tail ? `${head} — ${tail}` : head
}

export function formatArrivalDate(dateISO: string): string {
    // Accept YYYY-MM-DD or full ISO. Render as "MMM D, YYYY" (locale-stable).
    if (!dateISO) return ""
    const d = new Date(dateISO.length === 10 ? `${dateISO}T00:00:00` : dateISO)
    if (Number.isNaN(d.getTime())) return dateISO
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// Extract the YYYY-MM-DD date that was stamped into an "Arriving Soon" note,
// so the dialog can re-open with the previous date pre-filled.
export function parseArrivalDateFromNote(note: string | null | undefined): string | null {
    if (!note) return null
    const m = note.match(/Arriving Soon:\s*([A-Za-z]{3} \d{1,2}, \d{4})/)
    if (!m) return null
    const d = new Date(m[1])
    if (Number.isNaN(d.getTime())) return null
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
}

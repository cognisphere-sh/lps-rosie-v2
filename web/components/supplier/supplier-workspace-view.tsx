"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  ImageIcon,
  Leaf,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  MessageSquareText,
  Package,
  Paperclip,
  Search,
  Send,
  Settings,
  Share2,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEMAND_STATUS_META } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SortButton } from "@/components/ui/data-table/sort-button";
import { EditableCell } from "@/components/ui/data-table/editable-cell";
import { SUPPLIER } from "./supplier";
import {
  ITEM_STATUS_META,
  PROJECT_STATUS_META,
  customerProfilePath,
  orderStatePath,
  sectionFilePath,
  type WsChatMessage,
  type WsCustomer,
  type WsInventoryItem,
  type WsItemStatus,
  type WsOrder,
  type WsOrderItem,
  type WsProjectStatus,
} from "./supplier-workspace-data";
import { formatCurrency, formatDate, formatRelative } from "./ui";
import type { Dispatch, SetStateAction } from "react";
import { useChat, useLatestEvent } from "@/lib/data";
import { rawUrl, uploadFile } from "@/lib/harness";
import type { EventStatus } from "@/lib/harness";
import {
  useWorkspace,
  persistWsCustomer,
  persistWsInventoryItem,
  persistWsOrder,
} from "@/lib/ws-adapter";
import { useTheme } from "@/components/theme-provider";
import { useRouter } from "next/navigation";

// Wrap a React state setter so any entity whose JSON changed is written back to
// its workspace file. Seeding uses the raw setter, so loads never write.
function persistingSetter<T>(
  setRaw: Dispatch<SetStateAction<T[]>>,
  persist: (x: T) => Promise<void>,
  key: (x: T) => string,
): Dispatch<SetStateAction<T[]>> {
  return (update) => {
    setRaw((prev) => {
      const next =
        typeof update === "function"
          ? (update as (p: T[]) => T[])(prev)
          : update;
      const prevByKey = new Map(prev.map((x) => [key(x), x]));
      for (const x of next) {
        const before = prevByKey.get(key(x));
        if (!before || JSON.stringify(before) !== JSON.stringify(x)) {
          persist(x).catch((e) =>
            toast.error(`Save failed: ${e?.message ?? e}`),
          );
        }
      }
      return next;
    });
  };
}

// ─── View routing ───────────────────────────────────────────────────────────

type Tab = "customers" | "orders" | "inventory";

type View =
  | { kind: "customers" }
  | { kind: "orders" }
  | { kind: "inventory" }
  | { kind: "customer"; id: string }
  | { kind: "order"; id: string };

const TAB_OF_VIEW: Record<View["kind"], Tab> = {
  customers: "customers",
  orders: "orders",
  inventory: "inventory",
  customer: "customers",
  order: "orders",
};

// ─── Root ───────────────────────────────────────────────────────────────────

export function SupplierWorkspaceView() {
  const [view, setView] = useState<View>({ kind: "orders" });

  // Live data from Rosie's workspace files (loaded once; edits write through).
  const ws = useWorkspace();
  const [customers, setCustomersRaw] = useState<WsCustomer[]>([]);
  const [orders, setOrdersRaw] = useState<WsOrder[]>([]);
  const [inventory, setInventoryRaw] = useState<WsInventoryItem[]>([]);
  useEffect(() => {
    if (!ws.data) return;
    setCustomersRaw(ws.data.customers);
    setOrdersRaw(ws.data.orders);
    setInventoryRaw(ws.data.inventory);
  }, [ws.data]);

  const setCustomers = useMemo(
    () => persistingSetter(setCustomersRaw, persistWsCustomer, (c) => c.id),
    [],
  );
  const setOrders = useMemo(
    () =>
      persistingSetter(
        setOrdersRaw,
        persistWsOrder,
        (o) => `${o.customerId}/${o.id}`,
      ),
    [],
  );
  const setInventory = useMemo(
    () =>
      persistingSetter(setInventoryRaw, persistWsInventoryItem, (i) => i.id),
    [],
  );

  const activeTab = TAB_OF_VIEW[view.kind];

  const customersById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const pendingInputCount = useMemo(
    () =>
      orders.reduce(
        (n, o) => n + o.items.filter((i) => i.pendingInput).length,
        0,
      ),
    [orders],
  );

  // ── Mutators ── every edit "writes the backing workspace file": stamps the
  // row fresh and, on order items, clears the pending-input flag (an inline
  // edit answers the agent's open question the same way a chat reply does).

  const updateCustomer = useCallback(
    (id: string, patch: Partial<WsCustomer>) => {
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const updateOrder = useCallback((id: string, patch: Partial<WsOrder>) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, ...patch, lastUpdatedOn: new Date().toISOString() }
          : o,
      ),
    );
  }, []);

  const updateOrderItem = useCallback(
    (orderId: string, itemId: string, patch: Partial<WsOrderItem>) => {
      const now = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                lastUpdatedOn: now,
                items: o.items.map((i) =>
                  i.id === itemId
                    ? {
                        ...i,
                        ...patch,
                        lastUpdatedOn: now,
                        pendingInput: undefined,
                      }
                    : i,
                ),
              }
            : o,
        ),
      );
    },
    [],
  );

  const updateInventory = useCallback(
    (id: string, patch: Partial<WsInventoryItem>) => {
      setInventory((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, ...patch, lastUpdatedAt: new Date().toISOString() }
            : i,
        ),
      );
    },
    [],
  );

  // ── Lookup of the currently-open detail records ──

  const detailCustomer =
    view.kind === "customer" ? customersById.get(view.id) : undefined;
  const detailOrder =
    view.kind === "order" ? orders.find((o) => o.id === view.id) : undefined;

  // ── Chat (mirrors the production chat-container layout) ──

  const isMobile = useIsMobile();
  const [chatOpen, setChatOpen] = useState(false);
  const chat = useMockChat();
  const unread = chatOpen
    ? 0
    : Math.max(0, chat.messages.length - chat.seenCount);
  const toggleChat = () => {
    chat.markSeen();
    setChatOpen((prev) => !prev);
  };

  return (
    <div className="flex w-full flex-col">
      {/* Mobile tab strip — the sidebar is hidden below md. */}
      <div className="sticky top-[57px] z-20 flex items-center gap-1 border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:hidden">
        {(
          [
            { tab: "customers", label: "Customers" },
            { tab: "orders", label: "All Orders" },
            { tab: "inventory", label: "Inventory" },
          ] as const
        ).map((t) => (
          <button
            key={t.tab}
            onClick={() => setView({ kind: t.tab })}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === t.tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
            {t.tab === "orders" && pendingInputCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white tabular-nums">
                {pendingInputCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative flex h-[calc(100dvh-57px)] w-full overflow-hidden">
        <div
          className={cn(
            "h-full min-w-0 flex-1 overflow-hidden transition-[width] duration-300",
          )}
        >
          <div className="grid h-full min-h-0 w-full grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)]">
            {/* Sidebar */}
            <aside className="hidden min-h-0 border-r border-border bg-sidebar md:flex md:flex-col">
              <WorkspaceSidebar
                activeTab={activeTab}
                onSelect={(tab) => setView({ kind: tab })}
                customersCount={customers.length}
                pendingInputCount={pendingInputCount}
                sectionsCount={new Set(inventory.map((i) => i.section)).size}
              />
            </aside>

            {/* Main pane */}
            <section className="flex min-h-0 flex-col overflow-hidden">
              {view.kind === "customers" && (
                <CustomersPanel
                  customers={customers}
                  orders={orders}
                  onUpdate={updateCustomer}
                  onOpenCustomer={(id) => setView({ kind: "customer", id })}
                />
              )}
              {view.kind === "orders" && (
                <OrdersPanel
                  orders={orders}
                  customersById={customersById}
                  onUpdateItem={updateOrderItem}
                  onUpdateOrder={updateOrder}
                  onOpenCustomer={(id) => setView({ kind: "customer", id })}
                  onOpenOrder={(id) => setView({ kind: "order", id })}
                />
              )}
              {view.kind === "inventory" && (
                <InventoryPanel
                  inventory={inventory}
                  onUpdate={updateInventory}
                />
              )}
              {view.kind === "customer" &&
                (detailCustomer ? (
                  <CustomerDetail
                    customer={detailCustomer}
                    orders={orders.filter(
                      (o) => o.customerId === detailCustomer.id,
                    )}
                    onBack={() => setView({ kind: "customers" })}
                    onUpdate={(patch) =>
                      updateCustomer(detailCustomer.id, patch)
                    }
                    onUpdateItem={updateOrderItem}
                    onUpdateOrder={updateOrder}
                    onOpenCustomer={(id) => setView({ kind: "customer", id })}
                    onOpenOrder={(id) => setView({ kind: "order", id })}
                  />
                ) : (
                  <MissingRecord
                    onBack={() => setView({ kind: "customers" })}
                  />
                ))}
              {view.kind === "order" &&
                (detailOrder ? (
                  <OrderDetail
                    order={detailOrder}
                    customer={customersById.get(detailOrder.customerId)}
                    onBack={() => setView({ kind: "orders" })}
                    onUpdateOrder={(patch) =>
                      updateOrder(detailOrder.id, patch)
                    }
                    onUpdateItem={(itemId, patch) =>
                      updateOrderItem(detailOrder.id, itemId, patch)
                    }
                    onOpenCustomer={(id) => setView({ kind: "customer", id })}
                  />
                ) : (
                  <MissingRecord onBack={() => setView({ kind: "orders" })} />
                ))}
            </section>
          </div>
        </div>

        {/* One persistent chat session — desktop: slide-in right column,
            mobile: floating overlay. Same shell as the production app. */}
        {!isMobile && (
          <div
            className={cn(
              "h-full min-w-0 shrink-0 overflow-hidden transition-[width] duration-300",
              chatOpen ? "w-[30%] border-l border-border" : "w-0",
            )}
          >
            <ChatColumn
              open={chatOpen}
              messages={chat.messages}
              onSend={chat.send}
            />
          </div>
        )}
        {isMobile && chatOpen && (
          <div className="fixed bottom-24 left-4 right-4 z-50 h-[70dvh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <ChatColumn
              open={chatOpen}
              messages={chat.messages}
              onSend={chat.send}
            />
          </div>
        )}

        <Button
          size="icon"
          className={cn(
            "fixed bottom-6 z-50 h-14 w-14 rounded-full shadow-lg",
            !isMobile && chatOpen ? "right-[30%]" : "right-6",
          )}
          onClick={toggleChat}
          aria-label={chatOpen ? "Close chat" : "Open chat with Rosie"}
        >
          {chatOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
              {unread}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function MissingRecord({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
      <p>That record is no longer in the workspace.</p>
      <Button size="sm" variant="outline" onClick={onBack}>
        Back to list
      </Button>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function WorkspaceSidebar({
  activeTab,
  onSelect,
  customersCount,
  pendingInputCount,
  sectionsCount,
}: {
  activeTab: Tab;
  onSelect: (t: Tab) => void;
  customersCount: number;
  pendingInputCount: number;
  sectionsCount: number;
}) {
  return (
    <>
      <nav className="space-y-1 p-3">
        <SidebarNavButton
          icon={Users}
          label="Customers"
          sub="Profiles & order history"
          active={activeTab === "customers"}
          onClick={() => onSelect("customers")}
          badge={customersCount}
          badgeTone="primary"
        />
        <SidebarNavButton
          icon={ClipboardList}
          label="All Orders"
          sub="Every line item, live"
          active={activeTab === "orders"}
          onClick={() => onSelect("orders")}
          badge={pendingInputCount}
          badgeTone="warn"
        />
        <SidebarNavButton
          icon={Package}
          label="Inventory / Price List"
          sub="Availability & pricing files"
          active={activeTab === "inventory"}
          onClick={() => onSelect("inventory")}
          badge={sectionsCount}
          badgeTone="primary"
        />
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-2">
        <SidebarFooter />
      </div>
    </>
  );
}

function SidebarFooter() {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const isDark = resolvedTheme === "dark";

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort; still send the user to login
    }
    router.push("/login");
  };

  return (
    <div className="space-y-0.5">
      <SidebarFooterButton
        icon={isDark ? Sun : Moon}
        label={isDark ? "Light" : "Dark"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      />
      <SidebarFooterButton
        icon={Settings}
        label="Settings"
        onClick={() => toast("Settings coming soon")}
      />
      <SidebarFooterButton icon={LogOut} label="Sign Out" onClick={signOut} />
    </div>
  );
}

function SidebarFooterButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function SidebarNavButton({
  icon: Icon,
  label,
  sub,
  active,
  onClick,
  badge,
  badgeTone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  badgeTone?: "warn" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/60",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          active
            ? "bg-background/60 text-foreground"
            : "bg-secondary/60 text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            badgeTone === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-amber-500 text-white",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Generic sortable / filterable table ────────────────────────────────────

interface WsColumn<T> {
  key: string;
  label: string;
  width: string;
  align?: "left" | "right";
  /** Comparable for sort + matchable string for filters/search. */
  getValue: (row: T) => string | number | null;
  render: (row: T) => React.ReactNode;
  noFilter?: boolean;
  noSort?: boolean;
}

function WorkspaceTable<T extends { id: string }>({
  columns,
  rows,
  searchPlaceholder,
  emptyText,
  rowClassName,
  rowStrip,
  extraControls,
  bandKey,
  extraSearch,
  groupBy,
}: {
  columns: WsColumn<T>[];
  rows: T[];
  searchPlaceholder: string;
  emptyText: string;
  rowClassName?: (row: T) => string;
  /** Colored left-edge strip per row (e.g. status). Applied to the first cell. */
  rowStrip?: (row: T) => string;
  /** Panel-specific quick filters rendered in the control strip. */
  extraControls?: React.ReactNode;
  /**
   * Groups adjacent rows that share a key (e.g. the parent order) with an
   * alternating background, so group boundaries read at a glance. Banding is
   * computed over the rows as displayed — it follows sort/filter changes.
   * Ignored when `groupBy` is set (groups band automatically).
   */
  bandKey?: (row: T) => string;
  /** Extra text matched by the global search (e.g. group-card content). */
  extraSearch?: (row: T) => string;
  /**
   * Renders rows in groups, each opened by a spanning header row. Group order
   * follows the rows as sorted/filtered (a group sorts by its top row);
   * `renderHeader` receives the group's first row plus the collapse state —
   * groups collapse/expand via the toggle it's handed.
   */
  groupBy?: {
    keyOf: (row: T) => string;
    renderHeader: (
      row: T,
      collapsed: boolean,
      onToggle: () => void,
    ) => React.ReactNode;
  };
}) {
  const [globalSearch, setGlobalSearch] = useState("");
  const [sort, setSort] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const visibleRows = useMemo(() => {
    let out = rows;

    if (globalSearch.trim()) {
      const q = globalSearch.trim().toLowerCase();
      out = out.filter(
        (row) =>
          columns.some((col) => {
            const v = col.getValue(row);
            return v != null && String(v).toLowerCase().includes(q);
          }) ||
          (extraSearch != null && extraSearch(row).toLowerCase().includes(q)),
      );
    }

    const active = Object.entries(filters).filter(([, v]) => v && v.trim());
    if (active.length > 0) {
      out = out.filter((row) =>
        active.every(([key, q]) => {
          const col = columns.find((c) => c.key === key);
          if (!col) return true;
          const v = col.getValue(row);
          if (v == null) return false;
          return String(v).toLowerCase().includes(q.trim().toLowerCase());
        }),
      );
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) => {
          const av = col.getValue(a);
          const bv = col.getValue(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv));
          return sort.direction === "asc" ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [rows, columns, globalSearch, filters, sort, extraSearch]);

  // Partition the displayed rows into contiguous groups, preserving the
  // sorted order of first appearance.
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, T[]>();
    for (const row of visibleRows) {
      const key = groupBy.keyOf(row);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return [...map.values()];
  }, [visibleRows, groupBy]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  // Order cards start collapsed: collapse every group once, the first time
  // groups exist (data loads async). New groups after that stay expanded.
  const didInitCollapse = useRef(false);
  useEffect(() => {
    if (!groupBy || didInitCollapse.current || !groups || groups.length === 0)
      return;
    didInitCollapse.current = true;
    setCollapsedGroups(new Set(groups.map((g) => groupBy.keyOf(g[0]))));
  }, [groupBy, groups]);
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allCollapsed =
    groups != null &&
    groups.length > 0 &&
    groups.every((g) => collapsedGroups.has(groupBy!.keyOf(g[0])));
  const toggleAllGroups = () => {
    if (!groups || !groupBy) return;
    setCollapsedGroups(
      allCollapsed
        ? new Set()
        : new Set(groups.map((g) => groupBy.keyOf(g[0]))),
    );
  };

  // Alternating band per group of adjacent rows sharing bandKey.
  const rowBands = useMemo(() => {
    if (!bandKey) return null;
    const bands = new Map<string, boolean>();
    let band = false;
    let prevKey: string | null = null;
    for (const row of visibleRows) {
      const key = bandKey(row);
      if (prevKey !== null && key !== prevKey) band = !band;
      prevKey = key;
      bands.set(row.id, band);
    }
    return bands;
  }, [visibleRows, bandKey]);

  const cycleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const hasControls =
    Object.values(filters).some((v) => v && v.trim()) || sort != null;

  return (
    <>
      {/* Search + control strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/30 px-4 py-2 sm:px-6">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-9 pr-9 text-xs"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {extraControls}
        {groupBy && groups != null && groups.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={toggleAllGroups}
          >
            {allCollapsed ? (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Expand all
              </>
            ) : (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Collapse all
              </>
            )}
          </Button>
        )}
        {hasControls && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFilters({});
              setSort(null);
            }}
          >
            <X className="h-3 w-3" />
            Clear sort &amp; filters
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          Showing {visibleRows.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed caption-bottom text-left text-sm">
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} className={col.width} />
            ))}
          </colgroup>
          {/* Grouped tables (order cards) show column headers below each card
              on expand, not a global header. */}
          {!groupBy && (
          <thead className="sticky top-0 z-10 bg-muted shadow-sm">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "border-b p-2 align-top font-medium text-muted-foreground",
                      col.width,
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="min-w-0 truncate text-[11px] uppercase tracking-wider"
                          title={col.label}
                        >
                          {col.label}
                        </span>
                        {!col.noSort && (
                          <SortButton
                            isActive={isSorted}
                            direction={isSorted ? sort!.direction : null}
                            onClick={() => cycleSort(col.key)}
                          />
                        )}
                      </div>
                      {!col.noFilter && (
                        <Input
                          placeholder="Filter…"
                          className="h-7 px-2 text-xs"
                          value={filters[col.key] ?? ""}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [col.key]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          )}
          <tbody className="divide-y">
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </td>
              </tr>
            ) : groups ? (
              groups.map((groupRows, gi) => {
                const key = groupBy!.keyOf(groupRows[0]);
                const isCollapsed = collapsedGroups.has(key);
                return (
                  <Fragment key={key}>
                    <tr className="border-t border-border">
                      <td colSpan={columns.length} className="p-0">
                        {groupBy!.renderHeader(groupRows[0], isCollapsed, () =>
                          toggleGroup(key),
                        )}
                      </td>
                    </tr>
                    {!isCollapsed && (
                      <>
                        <tr className="bg-muted/60">
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={cn(
                                "border-y border-border px-2 py-1.5 align-middle text-[11px] uppercase tracking-wider text-muted-foreground",
                                col.align === "right" && "text-right",
                              )}
                            >
                              <span className="block truncate" title={col.label}>
                                {col.label}
                              </span>
                            </td>
                          ))}
                        </tr>
                        {groupRows.map((row) =>
                          renderRow(
                            row,
                            gi % 2 === 1,
                            columns,
                            rowClassName,
                            rowStrip,
                          ),
                        )}
                      </>
                    )}
                  </Fragment>
                );
              })
            ) : (
              visibleRows.map((row) =>
                renderRow(
                  row,
                  rowBands?.get(row.id) ?? false,
                  columns,
                  rowClassName,
                  rowStrip,
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderRow<T extends { id: string }>(
  row: T,
  banded: boolean,
  columns: WsColumn<T>[],
  rowClassName?: (row: T) => string,
  rowStrip?: (row: T) => string,
) {
  const strip = rowStrip?.(row);
  return (
    <tr
      key={row.id}
      className={cn(
        "align-middle transition-colors hover:bg-muted/40",
        banded && "bg-muted/50 dark:bg-card",
        rowClassName?.(row),
      )}
    >
      {columns.map((col, i) => (
        <td
          key={col.key}
          className={cn(
            "relative p-2 text-sm",
            col.align === "right" && "text-right",
            i === 0 && strip && cn("border-l-4", strip),
          )}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
}

// ─── Shared cells ───────────────────────────────────────────────────────────

const editPromise =
  (fn: (value: string | number) => void) => (value: string | number) => {
    fn(value);
    return Promise.resolve();
  };

const asNumber = (raw: string | number): number | null => {
  if (raw === "" || raw == null) return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
};

const asText = (raw: string | number): string | undefined => {
  const t = String(raw).trim();
  return t === "" ? undefined : t;
};

/**
 * Inline-editable cell for long free text. Unlike EditableCell (single line,
 * truncated), the display wraps — so notes columns can stay narrow without
 * hiding content. Click to edit in a textarea; Enter saves, Esc cancels.
 */
function NotesCell({
  value,
  onUpdate,
}: {
  value: string;
  onUpdate: (v: string | number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    if (draft !== value) onUpdate(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex w-full min-w-[170px] max-w-[200px] flex-col gap-1">
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="min-h-16 px-2 py-1 text-xs leading-snug"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") cancel();
          }}
        />
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-green-100 hover:text-green-600"
            onClick={save}
            aria-label="Save note"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-red-100 hover:text-red-600"
            onClick={cancel}
            aria-label="Cancel edit"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  const display = (
    <button
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="block min-h-[28px] w-full max-w-[200px] cursor-text truncate rounded px-2 py-1 text-left text-xs leading-snug hover:bg-muted"
    >
      {value === "" ? (
        <span className="text-xs italic text-muted-foreground">empty</span>
      ) : (
        value
      )}
    </button>
  );

  if (value === "") return display;

  // Truncated display — full text surfaces in a tooltip on hover.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{display}</TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-wrap">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Inline-editable price cell — displays formatted currency (or — when
 * unpriced), edits the raw number on click. Enter saves, Esc cancels.
 */
function PriceCell({
  value,
  onUpdate,
}: {
  value: number | null;
  onUpdate: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  const save = () => {
    onUpdate(asNumber(draft));
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-7 w-full min-w-[80px] px-2 text-right text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        onBlur={save}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value == null ? "" : String(value));
        setEditing(true);
      }}
      className="block w-full cursor-text rounded px-2 py-1 text-right text-sm tabular-nums hover:bg-muted"
      title="Click to edit"
    >
      {value == null ? (
        <span className="text-xs italic text-muted-foreground">—</span>
      ) : (
        formatCurrency(value)
      )}
    </button>
  );
}

function FileChip({ path }: { path: string }) {
  return (
    <span
      title={path}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[10px] text-muted-foreground"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate">{path}</span>
    </span>
  );
}

function AttachmentsCell({
  attachments,
}: {
  attachments: { path: string; description: string }[];
}) {
  if (attachments.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }
  return (
    <div
      className="relative inline-flex h-8 w-8 overflow-hidden rounded-md border border-border"
      title={attachments.map((a) => `${a.path} — ${a.description}`).join("\n")}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-300 via-green-500 to-emerald-700 dark:from-green-700 dark:via-green-800 dark:to-emerald-950" />
      <ImageIcon className="relative m-auto h-3.5 w-3.5 text-white/85" />
      {attachments.length > 1 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-foreground/85 px-1 text-[9px] font-semibold text-background">
          ×{attachments.length}
        </span>
      )}
    </div>
  );
}

// Same palette as the production availability statuses (lib/statuses VISUAL,
// surfaced via lib/availability-status.tsx).
// Item-status palette: Pending grey, Available green, Diff orange,
// Can Order yellow, Ordered blue, Unavailable red. `badge` colors the status
// pill / card count chips; `strip` colors the row's left edge.
const ITEM_STATUS_COLOR: Record<
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
};

function ItemStatusSelect({
  status,
  onChange,
}: {
  status: WsItemStatus;
  onChange: (s: WsItemStatus) => void;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as WsItemStatus)}
      aria-label={`Item status: ${ITEM_STATUS_META[status].label}`}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ITEM_STATUS_COLOR[status].badge,
      )}
    >
      {(Object.keys(ITEM_STATUS_META) as WsItemStatus[]).map((s) => (
        <option key={s} value={s}>
          {ITEM_STATUS_META[s].label}
        </option>
      ))}
    </select>
  );
}

// Project statuses mapped onto the closest production availability colors.
const PROJECT_STATUS_SELECT_CLASS: Record<WsProjectStatus, string> = {
  confirmation_pending: DEMAND_STATUS_META.pending.badge,
  quote_delivered: DEMAND_STATUS_META.can_order.badge,
  order_confirmed: DEMAND_STATUS_META.available.badge,
  closed_won: DEMAND_STATUS_META.available.badge,
  closed_lost: DEMAND_STATUS_META.unavailable.badge,
  archived: "bg-muted text-muted-foreground border-border",
};

function ProjectStatusSelect({
  status,
  onChange,
}: {
  status: WsProjectStatus;
  onChange: (s: WsProjectStatus) => void;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as WsProjectStatus)}
      aria-label={`Project status: ${PROJECT_STATUS_META[status].label}`}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
        PROJECT_STATUS_SELECT_CLASS[status],
      )}
    >
      {(Object.keys(PROJECT_STATUS_META) as WsProjectStatus[]).map((s) => (
        <option key={s} value={s}>
          {PROJECT_STATUS_META[s].label}
        </option>
      ))}
    </select>
  );
}

function LinkButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="truncate text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

function PanelHeader({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-card/40 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight sm:text-xl">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Customers panel ────────────────────────────────────────────────────────

function CustomersPanel({
  customers,
  orders,
  onUpdate,
  onOpenCustomer,
}: {
  customers: WsCustomer[];
  orders: WsOrder[];
  onUpdate: (id: string, patch: Partial<WsCustomer>) => void;
  onOpenCustomer: (id: string) => void;
}) {
  const orderCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.customerId, (m.get(o.customerId) ?? 0) + 1);
    return m;
  }, [orders]);

  const splitList = (raw: string | number) =>
    String(raw)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const columns: WsColumn<WsCustomer>[] = [
    {
      key: "name",
      label: "Customer",
      width: "w-[220px]",
      getValue: (c) => c.name,
      render: (c) => (
        <div className="min-w-0">
          <LinkButton onClick={() => onOpenCustomer(c.id)}>{c.name}</LinkButton>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            customers/{c.id}/
          </p>
        </div>
      ),
    },
    {
      key: "pocName",
      label: "PoC",
      width: "w-[150px]",
      getValue: (c) => c.pocName,
      render: (c) => (
        <EditableCell
          initialValue={c.pocName}
          onUpdate={editPromise((v) => onUpdate(c.id, { pocName: String(v) }))}
        />
      ),
    },
    {
      key: "phones",
      label: "Phones",
      width: "w-[190px]",
      getValue: (c) => c.phones.join("; "),
      render: (c) => (
        <EditableCell
          initialValue={c.phones.join("; ")}
          onUpdate={editPromise((v) =>
            onUpdate(c.id, { phones: splitList(v) }),
          )}
        />
      ),
    },
    {
      key: "emails",
      label: "Emails",
      width: "w-[220px]",
      getValue: (c) => c.emails.join("; "),
      render: (c) => (
        <EditableCell
          initialValue={c.emails.join("; ")}
          onUpdate={editPromise((v) =>
            onUpdate(c.id, { emails: splitList(v) }),
          )}
        />
      ),
    },
    {
      key: "address",
      label: "Address",
      width: "w-[240px]",
      getValue: (c) => c.address,
      render: (c) => (
        <EditableCell
          initialValue={c.address}
          onUpdate={editPromise((v) => onUpdate(c.id, { address: String(v) }))}
        />
      ),
    },
    {
      key: "notes",
      label: "Notes",
      width: "w-[200px]",
      getValue: (c) => c.notes,
      render: (c) => (
        <NotesCell
          value={c.notes}
          onUpdate={(v) => onUpdate(c.id, { notes: String(v) })}
        />
      ),
    },
    {
      key: "orders",
      label: "Orders",
      width: "w-[80px]",
      align: "right",
      getValue: (c) => orderCount.get(c.id) ?? 0,
      render: (c) => (
        <span className="tabular-nums">{orderCount.get(c.id) ?? 0}</span>
      ),
      noFilter: true,
    },
    {
      key: "createdOn",
      label: "Since",
      width: "w-[110px]",
      getValue: (c) => new Date(c.createdOn).getTime(),
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {formatRelative(c.createdOn)}
        </span>
      ),
      noFilter: true,
    },
  ];

  return (
    <>
      <PanelHeader
        title="Customers"
        sub={`${customers.length} profiles · click a name for the full file + order history`}
      />
      <WorkspaceTable
        columns={columns}
        rows={customers}
        searchPlaceholder="Search name, contact, email, notes…"
        emptyText="No customers match your filters."
      />
    </>
  );
}

// ─── Orders panel (flattened item rows) ─────────────────────────────────────

interface OrderItemRow {
  id: string;
  item: WsOrderItem;
  order: WsOrder;
  customerName: string;
}

function orderItemColumns({
  onUpdateItem,
  scoped,
}: {
  onUpdateItem: (
    orderId: string,
    itemId: string,
    patch: Partial<WsOrderItem>,
  ) => void;
  /** True inside an order detail — adds the created column (no group cards there). */
  scoped?: boolean;
}): WsColumn<OrderItemRow>[] {
  const itemCols: WsColumn<OrderItemRow>[] = [
    {
      key: "qty",
      label: "Qty",
      width: "w-[80px]",
      align: "right",
      getValue: (r) => r.item.qty,
      render: (r) => (
        <EditableCell
          initialValue={r.item.qty}
          onUpdate={editPromise((v) =>
            onUpdateItem(r.order.id, r.item.id, {
              qty: asNumber(v) ?? r.item.qty,
            }),
          )}
        />
      ),
    },
    {
      key: "size",
      label: "Size",
      width: "w-[90px]",
      getValue: (r) => r.item.size,
      render: (r) => (
        <EditableCell
          initialValue={r.item.size}
          onUpdate={editPromise((v) =>
            onUpdateItem(r.order.id, r.item.id, { size: String(v) }),
          )}
        />
      ),
    },
    {
      key: "name",
      label: "Name",
      width: "w-[230px]",
      getValue: (r) => `${r.item.name} ${r.item.customerNotes ?? ""}`,
      render: (r) => (
        <div className="min-w-0">
          <EditableCell
            initialValue={r.item.name}
            onUpdate={editPromise((v) =>
              onUpdateItem(r.order.id, r.item.id, { name: String(v) }),
            )}
          />
          {r.item.customerNotes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="truncate px-2 text-[11px] italic leading-snug text-muted-foreground">
                  “{r.item.customerNotes}”
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs whitespace-pre-wrap">
                {r.item.customerNotes}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: "unitPrice",
      label: "Unit Price",
      width: "w-[110px]",
      align: "right",
      getValue: (r) => r.item.unitPrice,
      render: (r) => (
        <PriceCell
          value={r.item.unitPrice}
          onUpdate={(v) =>
            onUpdateItem(r.order.id, r.item.id, { unitPrice: v })
          }
        />
      ),
    },
    {
      key: "total",
      label: "Total",
      width: "w-[110px]",
      align: "right",
      getValue: (r) =>
        r.item.unitPrice == null ? null : r.item.unitPrice * r.item.qty,
      render: (r) =>
        r.item.unitPrice == null ? (
          <span className="text-[11px] text-muted-foreground/60">—</span>
        ) : (
          <span className="tabular-nums">
            {formatCurrency(r.item.unitPrice * r.item.qty)}
          </span>
        ),
      noFilter: true,
    },
    {
      key: "itemStatus",
      label: "Item Status",
      width: "w-[170px]",
      getValue: (r) => ITEM_STATUS_META[r.item.status].label,
      render: (r) => (
        <ItemStatusSelect
          status={r.item.status}
          onChange={(s) => onUpdateItem(r.order.id, r.item.id, { status: s })}
        />
      ),
    },
    {
      // Goes out on the quote line — visible to the customer.
      key: "quoteNotes",
      label: "Quote Notes (shared)",
      width: "w-[200px]",
      getValue: (r) => r.item.quoteNotes ?? "",
      render: (r) => (
        <NotesCell
          value={r.item.quoteNotes ?? ""}
          onUpdate={(v) =>
            onUpdateItem(r.order.id, r.item.id, { quoteNotes: asText(v) })
          }
        />
      ),
    },
    {
      key: "internalNotes",
      label: "Internal Notes",
      width: "w-[200px]",
      getValue: (r) => r.item.internalNotes ?? "",
      render: (r) => (
        <NotesCell
          value={r.item.internalNotes ?? ""}
          onUpdate={(v) =>
            onUpdateItem(r.order.id, r.item.id, { internalNotes: asText(v) })
          }
        />
      ),
    },
  ];

  const attachmentsCol: WsColumn<OrderItemRow> = {
    key: "attachments",
    label: "Attach.",
    width: "w-[80px]",
    getValue: (r) => r.item.attachments.length,
    render: (r) => <AttachmentsCell attachments={r.item.attachments} />,
    noFilter: true,
  };
  const createdCol: WsColumn<OrderItemRow> = {
    key: "createdOn",
    label: "Created",
    width: "w-[110px]",
    getValue: (r) => new Date(r.order.createdOn).getTime(),
    render: (r) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(r.order.createdOn)}
      </span>
    ),
    noFilter: true,
  };
  const updatedCol: WsColumn<OrderItemRow> = {
    key: "lastUpdatedOn",
    label: "Updated",
    width: "w-[110px]",
    getValue: (r) => new Date(r.item.lastUpdatedOn).getTime(),
    render: (r) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(r.item.lastUpdatedOn)}
      </span>
    ),
    noFilter: true,
  };

  if (scoped) {
    return [...itemCols, attachmentsCol, createdCol, updatedCol];
  }

  // Grouped orders table: all project info lives on the group card, so rows
  // carry only the item-level columns that map to job.json fields. Attachments
  // (always empty in job.json) and Updated (no per-item timestamp) are dropped.
  // Percentage widths so the table fits its parent — no horizontal scroll.
  const gridWidth: Record<string, string> = {
    qty: "w-[7%]",
    size: "w-[8%]",
    name: "w-[22%]",
    unitPrice: "w-[11%]",
    total: "w-[10%]",
    itemStatus: "w-[16%]",
    quoteNotes: "w-[13%]",
    internalNotes: "w-[13%]",
  };
  return itemCols.map((c) => ({ ...c, width: gridWidth[c.key] ?? c.width }));
}

/** Plain-text quote lines built from the order's items (quote notes included). */
function buildQuoteLines(order: WsOrder): string {
  const lines = order.items
    .filter((i) => i.status !== "unavailable")
    .map((i) => {
      const unit = i.unitPrice != null ? formatCurrency(i.unitPrice) : "TBD";
      const lineTotal =
        i.unitPrice != null ? formatCurrency(i.unitPrice * i.qty) : "TBD";
      const note = i.quoteNotes ? ` — ${i.quoteNotes}` : "";
      return `• ${i.qty}× ${i.size} ${i.name} @ ${unit} = ${lineTotal}${note}`;
    });
  const total = order.items.reduce(
    (sum, i) => sum + (i.unitPrice ?? 0) * i.qty,
    0,
  );
  return [...lines, "", `Total: ${formatCurrency(total)}`].join("\n");
}

/**
 * Per-order actions — same compact outline-icon-button strip as the
 * production state panel. All mock: templates are built from the order's
 * state.json and copied to the clipboard.
 */
function OrderActions({
  order,
  customerName,
}: {
  order: WsOrder;
  customerName: string;
}) {
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied to clipboard`);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const actions = [
    {
      title: "Share Form",
      icon: Share2,
      onClick: () =>
        copy(
          `https://rosie-supplier.example/orders/${order.id}/form`,
          "Order form link",
        ),
    },
    {
      title: "Generate Email Quote",
      icon: Mail,
      onClick: () =>
        copy(
          `Hi ${customerName},\n\nHere's your quote for ${order.projectName}:\n\n${buildQuoteLines(order)}\n\nReply here to confirm and we'll schedule it.\n\n— ${SUPPLIER.name}`,
          "Email quote",
        ),
    },
    {
      title: "Generate PDF Quote",
      icon: FileText,
      onClick: () =>
        toast.success(
          `PDF quote generated — saved to ${orderStatePath(order).replace("state.json", "quote.pdf")}`,
        ),
    },
    {
      title: "Generate Text Quote",
      icon: MessageSquareText,
      onClick: () =>
        copy(
          `Quote — ${order.projectName}\n${buildQuoteLines(order)}`,
          "Text quote",
        ),
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {actions.map((a) => (
        <Button
          key={a.title}
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title={a.title}
          aria-label={a.title}
          onClick={a.onClick}
        >
          <a.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}

/** Card rendered on the group boundary — all project-level info in one place. */
function ProjectGroupCard({
  order,
  customerName,
  collapsed,
  onToggle,
  onOpenOrder,
  onOpenCustomer,
  onUpdateOrder,
}: {
  order: WsOrder;
  customerName: string;
  collapsed: boolean;
  onToggle: () => void;
  onOpenOrder: (id: string) => void;
  onOpenCustomer: (id: string) => void;
  onUpdateOrder: (orderId: string, patch: Partial<WsOrder>) => void;
}) {
  const total = order.items.reduce(
    (sum, i) => sum + (i.unitPrice ?? 0) * i.qty,
    0,
  );
  // All six statuses, always — rendered as a fixed 3×2 tag block.
  const statusCounts = (Object.keys(ITEM_STATUS_META) as WsItemStatus[]).map(
    (s) => ({
      status: s,
      count: order.items.filter((i) => i.status === s).length,
    }),
  );

  return (
    <div className="mx-2 my-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm sm:mx-3">
      <button
        onClick={onToggle}
        aria-label={
          collapsed ? "Expand project items" : "Collapse project items"
        }
        aria-expanded={!collapsed}
        className="-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <LinkButton onClick={() => onOpenOrder(order.id)}>
          {order.projectName}
        </LinkButton>
        <span className="text-[11px] text-muted-foreground">
          (
          <button
            onClick={() => onOpenCustomer(order.customerId)}
            className="underline-offset-2 hover:underline"
          >
            {customerName}
          </button>
          )
        </span>
      </div>
      <ProjectStatusSelect
        status={order.status}
        onChange={(s) => onUpdateOrder(order.id, { status: s })}
      />
      <span className="text-lg font-bold tabular-nums text-foreground">
        {formatCurrency(total)}
      </span>
      <span className="-ml-2 text-[11px] text-muted-foreground">
        {order.items.length} item{order.items.length === 1 ? "" : "s"}
      </span>
      <div className="ml-auto mr-1 text-right text-[11px] leading-snug text-muted-foreground">
        <p>
          created {formatDate(order.createdOn)} (
          {formatRelative(order.createdOn)})
        </p>
        <p>
          updated {formatDate(order.lastUpdatedOn)} (
          {formatRelative(order.lastUpdatedOn)})
        </p>
      </div>

      {/* Second row: 3×2 status-count block on the left, actions on the
          right. Zero counts render dimmed. */}
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-3 gap-1">
          {statusCounts.map(({ status, count }) => (
            <span
              key={status}
              title={`${count} ${ITEM_STATUS_META[status].label}`}
              className={cn(
                "inline-flex min-w-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium leading-none",
                count > 0
                  ? ITEM_STATUS_COLOR[status].badge
                  : "border-border bg-muted/40 text-muted-foreground opacity-60",
              )}
            >
              <span className="tabular-nums">{count}</span>
              <span className="truncate">{ITEM_STATUS_META[status].label}</span>
            </span>
          ))}
        </div>
        <OrderActions order={order} customerName={customerName} />
      </div>
      {order.notes && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="w-full truncate border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Notes:</span>{" "}
              {order.notes}
            </p>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-wrap">
            {order.notes}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function OrdersPanel({
  orders,
  customersById,
  onUpdateItem,
  onUpdateOrder,
  onOpenCustomer,
  onOpenOrder,
}: {
  orders: WsOrder[];
  customersById: Map<string, WsCustomer>;
  onUpdateItem: (
    orderId: string,
    itemId: string,
    patch: Partial<WsOrderItem>,
  ) => void;
  onUpdateOrder: (orderId: string, patch: Partial<WsOrder>) => void;
  onOpenCustomer: (id: string) => void;
  onOpenOrder: (id: string) => void;
}) {
  const itemCount = orders.reduce((n, o) => n + o.items.length, 0);
  const pendingCount = orders.reduce(
    (n, o) => n + o.items.filter((i) => i.pendingInput).length,
    0,
  );
  const customerNameOf = useCallback(
    (id: string) => customersById.get(id)?.name ?? id,
    [customersById],
  );

  return (
    <>
      <PanelHeader
        title="All Orders"
        sub={
          <>
            {itemCount} line items across {orders.length} orders ·{" "}
            {pendingCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {pendingCount} pending your input
              </span>
            ) : (
              "nothing pending your input"
            )}
          </>
        }
      />
      <OrdersTable
        orders={orders}
        customerNameOf={customerNameOf}
        onUpdateItem={onUpdateItem}
        onUpdateOrder={onUpdateOrder}
        onOpenCustomer={onOpenCustomer}
        onOpenOrder={onOpenOrder}
      />
    </>
  );
}

/**
 * The grouped orders table (quick filters + project cards + item rows).
 * Shared between the All Orders tab and the customer detail's orders section.
 */
function OrdersTable({
  orders,
  customerNameOf,
  onUpdateItem,
  onUpdateOrder,
  onOpenCustomer,
  onOpenOrder,
}: {
  orders: WsOrder[];
  customerNameOf: (id: string) => string;
  onUpdateItem: (
    orderId: string,
    itemId: string,
    patch: Partial<WsOrderItem>,
  ) => void;
  onUpdateOrder: (orderId: string, patch: Partial<WsOrder>) => void;
  onOpenCustomer: (id: string) => void;
  onOpenOrder: (id: string) => void;
}) {
  const [itemStatusFilter, setItemStatusFilter] = useState<
    WsItemStatus | "all"
  >("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState<
    WsProjectStatus | "all"
  >("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const rows: OrderItemRow[] = useMemo(
    () =>
      orders.flatMap((order) =>
        order.items.map((item) => ({
          id: `${order.id}:${item.id}`,
          item,
          order,
          customerName: customerNameOf(order.customerId),
        })),
      ),
    [orders, customerNameOf],
  );

  const quickFiltered = useMemo(() => {
    // Date inputs are local-midnight; widen "to" to end of that day.
    const from = createdFrom ? new Date(createdFrom).getTime() : null;
    const to = createdTo
      ? new Date(createdTo).getTime() + 24 * 60 * 60_000 - 1
      : null;
    return rows.filter((r) => {
      if (itemStatusFilter !== "all" && r.item.status !== itemStatusFilter)
        return false;
      if (
        projectStatusFilter !== "all" &&
        r.order.status !== projectStatusFilter
      )
        return false;
      const created = new Date(r.order.createdOn).getTime();
      if (from != null && created < from) return false;
      if (to != null && created > to) return false;
      return true;
    });
  }, [rows, itemStatusFilter, projectStatusFilter, createdFrom, createdTo]);

  const hasQuickFilters =
    itemStatusFilter !== "all" ||
    projectStatusFilter !== "all" ||
    createdFrom !== "" ||
    createdTo !== "";

  const columns = useMemo(
    () => orderItemColumns({ onUpdateItem }),
    [onUpdateItem],
  );

  return (
    <>
      <WorkspaceTable
        columns={columns}
        rows={quickFiltered}
        searchPlaceholder="Search plant, customer, project, notes…"
        emptyText="No order items match your filters."
        rowStrip={(r) => ITEM_STATUS_COLOR[r.item.status].strip}
        extraSearch={(r) =>
          `${r.order.projectName} ${r.customerName} ${PROJECT_STATUS_META[r.order.status].label}`
        }
        groupBy={{
          keyOf: (r) => r.order.id,
          renderHeader: (r, collapsed, onToggle) => (
            <ProjectGroupCard
              order={r.order}
              customerName={r.customerName}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpenOrder={onOpenOrder}
              onOpenCustomer={onOpenCustomer}
              onUpdateOrder={onUpdateOrder}
            />
          ),
        }}
        extraControls={
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={projectStatusFilter}
              onChange={(e) =>
                setProjectStatusFilter(
                  e.target.value as WsProjectStatus | "all",
                )
              }
              aria-label="Quick filter: project status"
              className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Project status: All</option>
              {(Object.keys(PROJECT_STATUS_META) as WsProjectStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_META[s].label}
                  </option>
                ),
              )}
            </select>
            <select
              value={itemStatusFilter}
              onChange={(e) =>
                setItemStatusFilter(e.target.value as WsItemStatus | "all")
              }
              aria-label="Quick filter: item status"
              className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Item status: All</option>
              {(Object.keys(ITEM_STATUS_META) as WsItemStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ITEM_STATUS_META[s].label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Created
              <Input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                aria-label="Created from"
                className="h-8 w-[135px] px-2 text-xs"
              />
              –
              <Input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                aria-label="Created to"
                className="h-8 w-[135px] px-2 text-xs"
              />
            </label>
            {hasQuickFilters && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setItemStatusFilter("all");
                  setProjectStatusFilter("all");
                  setCreatedFrom("");
                  setCreatedTo("");
                }}
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        }
      />
    </>
  );
}

// ─── Inventory / Price List panel ───────────────────────────────────────────

function InventoryPanel({
  inventory,
  onUpdate,
}: {
  inventory: WsInventoryItem[];
  onUpdate: (id: string, patch: Partial<WsInventoryItem>) => void;
}) {
  const sections = useMemo(
    () => [...new Set(inventory.map((i) => i.section))],
    [inventory],
  );

  const columns: WsColumn<WsInventoryItem>[] = [
    {
      key: "section",
      label: "Section",
      width: "w-[150px]",
      getValue: (i) => i.section,
      render: (i) => (
        <div className="min-w-0">
          <EditableCell
            initialValue={i.section}
            onUpdate={editPromise((v) =>
              onUpdate(i.id, { section: String(v) }),
            )}
          />
          <p className="truncate px-2 font-mono text-[10px] text-muted-foreground">
            {sectionFilePath(i.section).replace(
              "workspace/availability-pricing/",
              "",
            )}
          </p>
        </div>
      ),
    },
    {
      key: "name",
      label: "Name",
      width: "w-[150px]",
      getValue: (i) => i.name,
      render: (i) => (
        <EditableCell
          initialValue={i.name}
          onUpdate={editPromise((v) => onUpdate(i.id, { name: String(v) }))}
        />
      ),
    },
    {
      key: "commonNames",
      label: "Common Names",
      width: "w-[190px]",
      getValue: (i) => i.commonNames ?? "",
      render: (i) => (
        <EditableCell
          initialValue={i.commonNames ?? ""}
          onUpdate={editPromise((v) =>
            onUpdate(i.id, { commonNames: asText(v) }),
          )}
        />
      ),
    },
    {
      key: "size",
      label: "Size",
      width: "w-[64px]",
      getValue: (i) => i.size,
      render: (i) => (
        <EditableCell
          initialValue={i.size}
          onUpdate={editPromise((v) => onUpdate(i.id, { size: String(v) }))}
        />
      ),
    },
    {
      key: "price",
      label: "Price",
      width: "w-[110px]",
      align: "right",
      getValue: (i) => i.price,
      render: (i) => (
        <PriceCell
          value={i.price}
          onUpdate={(v) => onUpdate(i.id, { price: v })}
        />
      ),
    },
    {
      key: "notes",
      label: "Notes",
      width: "w-[420px]",
      getValue: (i) => i.notes ?? "",
      render: (i) => (
        <NotesCell
          value={i.notes ?? ""}
          onUpdate={(v) => onUpdate(i.id, { notes: asText(v) })}
        />
      ),
    },
    {
      key: "attachments",
      label: "Attach.",
      width: "w-[80px]",
      getValue: (i) => i.attachments.length,
      render: (i) => <AttachmentsCell attachments={i.attachments} />,
      noFilter: true,
    },
  ];

  return (
    <>
      <PanelHeader
        title="Inventory / Price List"
        sub={
          <>
            {inventory.length} rows across {sections.length} section files (
            {sections.join(", ")}) · dynamic data, not a source of truth —
            it&rsquo;s what the agent currently believes is available
          </>
        }
      />
      <WorkspaceTable
        columns={columns}
        rows={inventory}
        searchPlaceholder="Search name, common name, notes…"
        emptyText="No rows match your filters."
      />
    </>
  );
}

// ─── Customer detail ────────────────────────────────────────────────────────

function CustomerDetail({
  customer,
  orders,
  onBack,
  onUpdate,
  onUpdateItem,
  onUpdateOrder,
  onOpenCustomer,
  onOpenOrder,
}: {
  customer: WsCustomer;
  orders: WsOrder[];
  onBack: () => void;
  onUpdate: (patch: Partial<WsCustomer>) => void;
  onUpdateItem: (
    orderId: string,
    itemId: string,
    patch: Partial<WsOrderItem>,
  ) => void;
  onUpdateOrder: (orderId: string, patch: Partial<WsOrder>) => void;
  onOpenCustomer: (id: string) => void;
  onOpenOrder: (id: string) => void;
}) {
  const customerNameOf = useCallback(() => customer.name, [customer.name]);
  const [tab, setTab] = useState<"details" | "orders">("details");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header — name, back nav, and the Details / Orders tab strip. */}
      <div className="border-b border-border bg-card/40 px-4 pt-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
            All customers
          </Button>
          <FileChip
            path={
              tab === "details"
                ? customerProfilePath(customer)
                : `workspace/customers/${customer.id}/orders/`
            }
          />
        </div>
        <div className="mt-1">
          <h2 className="text-lg font-semibold leading-tight sm:text-xl">
            {customer.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customer since {formatRelative(customer.createdOn)} ·{" "}
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="mt-3 flex gap-1">
          {(
            [
              { id: "details", label: "Details" },
              { id: "orders", label: `Orders (${orders.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "details" ? (
        /* profile.md */
        <ScrollArea className="min-h-0 flex-1">
          <div className="max-w-3xl p-4 sm:p-6">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <ProfileField
                  label="PoC name"
                  value={customer.pocName}
                  onUpdate={(v) => onUpdate({ pocName: String(v) })}
                />
                <ProfileField
                  label="Phone numbers"
                  value={customer.phones.join("; ")}
                  onUpdate={(v) =>
                    onUpdate({
                      phones: String(v)
                        .split(/[;,]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <ProfileField
                  label="Emails"
                  value={customer.emails.join("; ")}
                  onUpdate={(v) =>
                    onUpdate({
                      emails: String(v)
                        .split(/[;,]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <ProfileField
                  label="Address"
                  value={customer.address}
                  onUpdate={(v) => onUpdate({ address: String(v) })}
                />
                <div className="sm:col-span-2">
                  <ProfileField
                    label="Notes"
                    value={customer.notes}
                    onUpdate={(v) => onUpdate({ notes: String(v) })}
                  />
                </div>
              </dl>
            </div>
          </div>
        </ScrollArea>
      ) : orders.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No orders on file yet.
        </p>
      ) : (
        /* orders/ — same grouped table as the All Orders tab, scoped to
           this customer's folder. */
        <OrdersTable
          orders={orders}
          customerNameOf={customerNameOf}
          onUpdateItem={onUpdateItem}
          onUpdateOrder={onUpdateOrder}
          onOpenCustomer={onOpenCustomer}
          onOpenOrder={onOpenOrder}
        />
      )}
    </div>
  );
}

function ProfileField({
  label,
  value,
  onUpdate,
}: {
  label: string;
  value: string;
  onUpdate: (v: string | number) => void;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="relative -mx-2">
        <EditableCell initialValue={value} onUpdate={editPromise(onUpdate)} />
      </dd>
    </div>
  );
}

// ─── Order detail ───────────────────────────────────────────────────────────

function OrderDetail({
  order,
  customer,
  onBack,
  onUpdateOrder,
  onUpdateItem,
  onOpenCustomer,
}: {
  order: WsOrder;
  customer?: WsCustomer;
  onBack: () => void;
  onUpdateOrder: (patch: Partial<WsOrder>) => void;
  onUpdateItem: (itemId: string, patch: Partial<WsOrderItem>) => void;
  onOpenCustomer: (id: string) => void;
}) {
  const rows: OrderItemRow[] = order.items.map((item) => ({
    id: item.id,
    item,
    order,
    customerName: customer?.name ?? order.customerId,
  }));

  const columns = useMemo(
    () =>
      orderItemColumns({
        onUpdateItem: (_orderId, itemId, patch) => onUpdateItem(itemId, patch),
        scoped: true,
      }),
    [onUpdateItem],
  );

  const total = order.items.reduce(
    (sum, i) => sum + (i.unitPrice ?? 0) * i.qty,
    0,
  );
  const allAttachments = order.items.flatMap((i) =>
    i.attachments.map((a) => ({ ...a, itemName: i.name })),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-card/40 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
            All orders
          </Button>
          <FileChip path={orderStatePath(order)} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold leading-tight sm:text-xl">
            {order.projectName}
          </h2>
          <ProjectStatusSelect
            status={order.status}
            onChange={(s) => onUpdateOrder({ status: s })}
          />
          <OrderActions
            order={order}
            customerName={customer?.name ?? order.customerId}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <LinkButton onClick={() => onOpenCustomer(order.customerId)}>
            {customer?.name ?? order.customerId}
          </LinkButton>{" "}
          · created {formatRelative(order.createdOn)} · updated{" "}
          {formatRelative(order.lastUpdatedOn)} · {order.items.length} items ·{" "}
          {formatCurrency(total)} priced so far
        </p>
        <div className="mt-2 max-w-2xl">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Order notes
          </p>
          <div className="relative -mx-2">
            <EditableCell
              initialValue={order.notes ?? ""}
              onUpdate={editPromise((v) => onUpdateOrder({ notes: asText(v) }))}
            />
          </div>
        </div>
      </div>

      <WorkspaceTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search items on this order…"
        emptyText="No items match your filters."
        rowStrip={(r) => ITEM_STATUS_COLOR[r.item.status].strip}
      />

      {allAttachments.length > 0 && (
        <div className="border-t border-border bg-card/30 px-4 py-3 sm:px-6">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Attachments on this order
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {allAttachments.map((a) => (
              <li
                key={a.path}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
              >
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px]">{a.path}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {a.itemName} · {a.description} ·{" "}
                    {formatRelative(a.lastUpdatedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Chat — one persistent session, styled like the production app ─────────

/** Chat state lives at the view root so the toggle badge sees new messages. */
function useMockChat() {
  // Live: messages come from Rosie's session feed; send posts to the admin
  // channel and the next poll surfaces her reply (no canned responses).
  const { messages: live, send: sendLive } = useChat();
  const messages = useMemo<WsChatMessage[]>(
    () =>
      (live ?? []).map((m) => ({
        id: m.id,
        sender: m.role === "user" ? "supplier" : "agent",
        source: "web",
        body: m.text,
        timestamp: m.ts,
      })),
    [live],
  );
  const [seenCount, setSeenCount] = useState(0);

  const send = useCallback(
    (body: string) => {
      void sendLive(body);
    },
    [sendLive],
  );

  const markSeen = useCallback(() => {
    setSeenCount(messages.length);
  }, [messages.length]);

  return { messages, send, seenCount, markSeen };
}

/** Same shape as the production chat header timestamp. */
function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return date.toLocaleString(undefined, {
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

// Event-status badge: label + dot color for the latest event's state.
const EVENT_STATUS_META: Record<EventStatus, { label: string; dot: string }> = {
  queued: { label: "Queued", dot: "bg-amber-500" },
  in_flight: { label: "Working…", dot: "bg-blue-500 animate-pulse" },
  done: { label: "Done", dot: "bg-emerald-500" },
  failed: { label: "Failed", dot: "bg-red-500" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground" },
};

function EventStatusBadge() {
  const event = useLatestEvent();
  if (!event) return null;
  const meta = EVENT_STATUS_META[event.status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
      title={event.text}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/** The chat column — mirrors the production chat-container shell. */
function ChatColumn({
  open,
  messages,
  onSend,
}: {
  open: boolean;
  messages: WsChatMessage[];
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  // ponytail: attachments are composer-only preview — sendToRosie takes text
  // only, so files are listed in the body and cleared on send.
  const [attachments, setAttachments] = useState<
    { file: File; url: string | null }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Jump the Radix ScrollArea viewport to the bottom. The panel animates from
    // w-0 over 300ms, so the viewport isn't sized on the first frame — scroll
    // now (for new messages) and again after the open transition settles.
    const toBottom = () => {
      const vp = bottomRef.current?.closest<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );
      if (vp) vp.scrollTop = vp.scrollHeight;
    };
    const raf = requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 320);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [open, messages.length]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setAttachments((prev) => [
      ...prev,
      ...Array.from(list).map((file) => ({
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    ]);
  };

  const removeAttachment = (i: number) => {
    setAttachments((prev) => {
      const a = prev[i];
      if (a?.url) URL.revokeObjectURL(a.url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = draft.trim();
    if (sending || (!body && attachments.length === 0)) return;
    setSending(true);
    try {
      // Upload each attachment so it persists server-side, then reference the
      // stored paths in the message. The bubble renders "📎 <path>" lines as
      // inline image previews (or file chips) on the next poll, and Rosie can
      // open the files.
      const uploaded = await Promise.all(
        attachments.map((a) => uploadFile(a.file)),
      );
      const lines = uploaded.map((u) => `📎 ${u.path}`).join("\n");
      const text = body ? (lines ? `${body}\n${lines}` : body) : lines;
      attachments.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      setDraft("");
      setAttachments([]);
      onSend(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-wallpaper flex h-full flex-col overflow-hidden rounded-t-2xl md:rounded-none">
      {/* Header */}
      <div className="z-10 flex flex-none items-center justify-between rounded-t-2xl border-b border-border bg-background px-4 py-3 md:rounded-none">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
            <Leaf className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Rosie</h2>
            <p className="text-xs text-muted-foreground">
              One continuous session · keeps the workspace in sync
            </p>
          </div>
        </div>
        <EventStatusBadge />
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="space-y-4 overflow-x-hidden pb-4">
          {messages.map((m) => (
            <ChatBubble key={m.id} m={m} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input — mirrors the production MessageInput */}
      <div className="flex-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="group relative flex items-center gap-2 rounded-lg border border-border bg-background py-1.5 pl-1.5 pr-7 text-xs"
              >
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${a.file.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.file.name}
                      className="h-9 w-9 cursor-pointer rounded object-cover"
                    />
                  </a>
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
                <span className="max-w-[8rem] truncate font-medium">
                  {a.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${a.file.name}`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex items-end space-x-2">
          <div className="relative flex-1">
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Attach"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Update availability, prices, or ask Rosie to edit a row…"
              rows={1}
              className="min-h-[46px] w-full resize-none rounded-xl border border-input bg-background py-3 pl-10 pr-3 text-sm focus:outline-none focus-visible:border-accent focus-visible:ring-accent/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>
          <Button
            size="icon"
            disabled={sending}
            className="h-11 w-11 shrink-0 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            aria-label="Send"
            onClick={() => void send()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

// Pull "📎 <path>" attachment lines out of a message body so they render as
// inline image previews / file chips instead of raw text.
function splitAttachments(body: string): {
  text: string;
  attachments: { path: string; isImage: boolean }[];
} {
  const attachments: { path: string; isImage: boolean }[] = [];
  const textLines: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^📎\s+(.+)$/);
    if (m) {
      const path = m[1].trim();
      attachments.push({ path, isImage: IMG_EXT_RE.test(path) });
    } else {
      textLines.push(line);
    }
  }
  return { text: textLines.join("\n").trim(), attachments };
}

function AttachmentFileChip({ path }: { path: string }) {
  return (
    <a
      href={rawUrl(path)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-black/15 px-2 py-1 text-[11px]"
    >
      <Paperclip className="h-3 w-3" />
      {path.split("/").pop()}
    </a>
  );
}

// Image attachment with a graceful fallback: if the raw bytes 404 (e.g. an old
// message whose file was never uploaded), show the file chip instead of a
// broken-image glyph.
function AttachmentImage({ path }: { path: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AttachmentFileChip path={path} />;
  return (
    <a
      href={rawUrl(path)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${path}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={rawUrl(path)}
        alt={path.split("/").pop()}
        onError={() => setFailed(true)}
        className="max-h-48 max-w-[12rem] cursor-pointer rounded-lg object-cover"
      />
    </a>
  );
}

function MessageAttachments({
  items,
}: {
  items: { path: string; isImage: boolean }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a, i) =>
        a.isImage ? (
          <AttachmentImage key={i} path={a.path} />
        ) : (
          <AttachmentFileChip key={i} path={a.path} />
        ),
      )}
    </div>
  );
}

/** Bubbles styled like the production MessageBubble (user/assistant). */
function ChatBubble({ m }: { m: WsChatMessage }) {
  const fromSupplier = m.sender === "supplier";
  const timestamp = formatMessageTime(m.timestamp);
  const { text, attachments: bodyAttachments } = splitAttachments(m.body);

  const extras = (
    <>
      {m.attachments && m.attachments.length > 0 && (
        <div className="mt-2 space-y-1">
          {m.attachments.map((a, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-black/15 px-2 py-1 text-[11px]"
            >
              {a.kind === "image" ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              {a.label}
            </div>
          ))}
        </div>
      )}
    </>
  );

  // Workspace files touched by this message — rendered below the bubble.
  const fileChips = m.files && m.files.length > 0 && (
    <div
      className={cn(
        "mt-1.5 flex flex-wrap gap-1",
        fromSupplier && "justify-end",
      )}
    >
      {m.files.map((f) => (
        <FileChip key={f} path={f} />
      ))}
    </div>
  );

  if (fromSupplier) {
    return (
      <div className="flex w-full justify-end gap-3">
        <div className="flex min-w-0 max-w-[85%] flex-col items-end sm:max-w-[75%]">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              You
            </span>
            {timestamp && (
              <span className="text-xs text-muted-foreground/70">
                {timestamp}
              </span>
            )}
          </div>
          <div className="user-bubble-gradient overflow-hidden rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-primary-foreground shadow-sm">
            {text && (
              <p className="whitespace-pre-wrap text-sm leading-snug">{text}</p>
            )}
            <MessageAttachments items={bodyAttachments} />
            {extras}
          </div>
          {fileChips}
        </div>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-accent text-accent-foreground">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 max-w-[90%] flex-col sm:max-w-[75%]">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Rosie
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground/70">
              {timestamp}
            </span>
          )}
        </div>
        <div className="ai-bubble-gradient w-fit rounded-2xl rounded-tl-sm border border-border/40 bg-card px-4 py-2 text-foreground shadow-sm dark:border-accent/20">
          {text && (
            <p className="whitespace-pre-wrap text-sm leading-snug">{text}</p>
          )}
          <MessageAttachments items={bodyAttachments} />
          {extras}
        </div>
        {fileChips}
      </div>
    </div>
  );
}

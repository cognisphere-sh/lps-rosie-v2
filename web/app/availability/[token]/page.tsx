"use client";

// Internal availability-check form opened via the shared link. It reuses the
// exact orders table (same columns + the status popup) so the team reviews and
// edits price / status / notes per line, then submits all lines at once. No job
// grouping — one request may span several jobs, so it reads as one flat table.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Leaf, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WorkspaceTable,
  orderItemColumns,
  type OrderItemRow,
} from "@/components/supplier/supplier-workspace-view";
import {
  ITEM_STATUS_COLOR,
  type WsOrder,
  type WsOrderItem,
} from "@/components/supplier/supplier-workspace-data";
import {
  AVAIL_STATUS_OPTIONS,
  type AvailRequest,
  type AvailResponse,
} from "@/lib/availability";

export default function AvailabilityFormPage() {
  const { token } = useParams<{ token: string }>();
  const [req, setReq] = useState<AvailRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Editable line state, keyed by item id, seeded from the request snapshot.
  const [items, setItems] = useState<Record<string, WsOrderItem>>({});
  const [grower, setGrower] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/avail/${token}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(r.status === 404 ? "This request link is invalid or expired." : `Error ${r.status}`);
        return (await r.json()) as AvailRequest;
      })
      .then((data) => {
        setReq(data);
        setGrower(data.growerName ?? "");
        if (data.status === "submitted") setDone(true);
        setItems(
          Object.fromEntries(
            data.items.map((i) => [
              i.itemId,
              {
                id: i.itemId,
                qty: i.qty,
                size: i.size,
                name: i.plantName,
                unitPrice: i.unitPrice ?? null,
                status: i.status ?? "confirmation_pending",
                quoteNotes: i.quoteNotes || undefined,
                internalNotes: i.internalNotes || undefined,
                attachments: [],
                lastUpdatedOn: "",
              } as WsOrderItem,
            ]),
          ),
        );
      })
      .catch((e) => setError(e.message));
  }, [token]);

  // Synthesize order context per line so the shared columns can address edits.
  const orderById = useMemo(() => {
    const m = new Map<string, WsOrder>();
    for (const it of req?.items ?? []) {
      if (m.has(it.orderId)) continue;
      m.set(it.orderId, {
        id: it.orderId,
        customerId: it.customerId,
        projectName: it.projectName,
        status: "confirmation_pending",
        createdOn: "",
        lastUpdatedOn: "",
        items: [],
      });
    }
    return m;
  }, [req]);

  const rows: OrderItemRow[] = useMemo(() => {
    if (!req) return [];
    return req.items.map((i) => ({
      id: i.itemId,
      item: items[i.itemId],
      order: orderById.get(i.orderId)!,
      customerName: i.customerName,
    }));
  }, [req, items, orderById]);

  const columns = useMemo(
    () =>
      orderItemColumns({
        statusOptions: AVAIL_STATUS_OPTIONS,
        onUpdateItem: (_orderId, itemId, patch) =>
          setItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } })),
      }),
    [],
  );

  // A row is fillable only if its job line is still pending at load. Rows already
  // answered (by the agent or an earlier visit) are locked — read-only. Keyed off
  // the loaded request so editing a pending row doesn't relock it mid-session.
  const locked = useMemo(
    () =>
      new Set(
        (req?.items ?? [])
          .filter((i) => (i.status ?? "confirmation_pending") !== "confirmation_pending")
          .map((i) => i.itemId),
      ),
    [req],
  );

  const submit = async () => {
    if (!req) return;
    setSubmitting(true);
    setError(null);
    const responses: AvailResponse[] = req.items.map((i) => {
      const it = items[i.itemId];
      return {
        itemId: i.itemId,
        plantName: it.name,
        size: it.size,
        qty: it.qty,
        unitPrice: it.unitPrice,
        status: it.status,
        quoteNotes: it.quoteNotes ?? "",
        internalNotes: it.internalNotes ?? "",
      };
    });
    try {
      const r = await fetch(`/api/avail/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ growerName: grower.trim(), responses }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${r.status}`);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !req) return <Centered>{error}</Centered>;
  if (!req)
    return (
      <Centered>
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </Centered>
    );
  if (done)
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-6 w-6" />
          </span>
          <p className="text-base font-medium">Availability submitted.</p>
          <p className="text-sm text-muted-foreground">{req.supplier} has the updated lines.</p>
        </div>
      </Centered>
    );

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-none flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
          <Leaf className="h-4 w-4 text-accent-foreground" />
        </span>
        <div className="mr-auto">
          <h1 className="text-base font-semibold leading-tight">Availability check</h1>
          <p className="text-xs text-muted-foreground">
            {req.supplier} · {req.items.length} line{req.items.length === 1 ? "" : "s"}
          </p>
        </div>
        <Input
          value={grower}
          onChange={(e) => setGrower(e.target.value)}
          placeholder="Your name"
          className="h-9 w-44 text-sm"
        />
        <Button onClick={submit} disabled={submitting} className="gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit
        </Button>
      </header>

      {error && <p className="px-4 pt-3 text-sm text-red-600 sm:px-6">{error}</p>}

      <div className="flex min-h-0 flex-1 flex-col">
        <WorkspaceTable
          columns={columns}
          rows={rows}
          searchPlaceholder="Search plant, size, notes…"
          emptyText="No lines on this request."
          rowStrip={(r) => ITEM_STATUS_COLOR[r.item.status].strip}
          rowClassName={(r) => (locked.has(r.id) ? "pointer-events-none opacity-60" : "")}
        />
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
    </main>
  );
}

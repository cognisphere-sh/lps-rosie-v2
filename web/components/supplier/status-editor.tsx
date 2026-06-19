"use client";

// Status cell shared by the orders table and the availability form. Shows a
// colored status pill that opens a menu. Available / Unavailable apply at once.
// Can Order opens a popup for a customer note; Diff (Size/Qty/Plant) opens a
// popup for an alternate size, qty, and/or plant — each change is stamped as a
// customer-facing quote note and the qty/size columns are updated to match.
//
// onCommit receives a partial WsOrderItem patch so each caller persists it its
// own way (the table writes through immediately; the form updates a draft).

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ITEM_STATUS_COLOR,
  ITEM_STATUS_META,
  type WsItemStatus,
  type WsOrderItem,
} from "./supplier-workspace-data";
import { withDiffNotes } from "@/lib/availability";

const ALL_STATUSES = Object.keys(ITEM_STATUS_META) as WsItemStatus[];
const DETAIL_STATUSES = new Set<WsItemStatus>(["can_order", "diff_size_qty"]);

type EditableItem = Pick<WsOrderItem, "status" | "qty" | "size" | "name" | "quoteNotes">;

export function StatusEditor({
  item,
  onCommit,
  options = ALL_STATUSES,
}: {
  item: EditableItem;
  onCommit: (patch: Partial<WsOrderItem>) => void;
  options?: WsItemStatus[];
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [dialog, setDialog] = useState<WsItemStatus | null>(null);

  const pick = (status: WsItemStatus) => {
    setMenu(null);
    if (DETAIL_STATUSES.has(status)) setDialog(status);
    else onCommit({ status });
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenu({ x: r.left, y: r.bottom + 4 });
        }}
        className={cn(
          "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none",
          ITEM_STATUS_COLOR[item.status].badge,
        )}
      >
        <span className="truncate">{ITEM_STATUS_META[item.status].label}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>

      {menu && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenu(null)}
          />
          <div
            className="fixed z-50 w-48 rounded-md border border-border bg-popover p-1 shadow-md"
            style={{ left: menu.x, top: menu.y }}
          >
            {options.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className={cn("h-2 w-2 rounded-full border", ITEM_STATUS_COLOR[s].badge)} />
                {ITEM_STATUS_META[s].label}
              </button>
            ))}
          </div>
        </>
      )}

      {dialog &&
        (() => {
          const Dialog = dialog === "can_order" ? CanOrderDialog : DiffDialog;
          return (
            <Dialog
              item={item}
              onCancel={() => setDialog(null)}
              onConfirm={(patch) => {
                onCommit({ status: dialog, ...patch });
                setDialog(null);
              }}
            />
          );
        })()}
    </>
  );
}

// Can Order: just a customer-facing note (e.g. an ETA the customer should see).
function CanOrderDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: EditableItem;
  onConfirm: (patch: Partial<WsOrderItem>) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(item.quoteNotes ?? "");
  return (
    <Shell
      title="Mark as Can Order"
      desc="Add a note for the customer (e.g. lead time)."
      onConfirm={() => onConfirm({ quoteNotes: notes.trim() })}
      onCancel={onCancel}
    >
      <Field label="Customer notes">
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. can order, ~2 weeks lead time…"
          className="text-sm"
        />
      </Field>
    </Shell>
  );
}

// Diff (Size / Qty / Plant): the grower can change the size, the qty, and/or the
// plant. Each change updates the matching column and adds a customer-facing quote
// note "Requested: <original>, Alternate: <new>". The plant field defaults to the
// requested plant; changing it updates the name column too.
function DiffDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: EditableItem;
  onConfirm: (patch: Partial<WsOrderItem>) => void;
  onCancel: () => void;
}) {
  const [size, setSize] = useState(item.size);
  const [qty, setQty] = useState(String(item.qty));
  const [plant, setPlant] = useState(item.name);

  const confirm = () => {
    const qtyNum = Number(qty);
    const qtyChanged = qty.trim() !== "" && Number.isFinite(qtyNum) && qtyNum !== item.qty;
    const sizeChanged = size.trim() !== "" && size.trim() !== item.size;
    const plantChanged = plant.trim() !== "" && plant.trim() !== item.name;

    const patch: Partial<WsOrderItem> = {
      quoteNotes: withDiffNotes(item.quoteNotes ?? "", {
        qty: qtyChanged ? { from: String(item.qty), to: String(qtyNum) } : undefined,
        size: sizeChanged ? { from: item.size, to: size.trim() } : undefined,
        plant: plantChanged ? { from: item.name, to: plant.trim() } : undefined,
      }),
    };
    if (qtyChanged) patch.qty = qtyNum;
    if (sizeChanged) patch.size = size.trim();
    if (plantChanged) patch.name = plant.trim();
    onConfirm(patch);
  };

  return (
    <Shell
      title="Different size / qty / plant"
      desc="Change what's available; each change is noted for the customer."
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <Field label="Plant">
        <Input value={plant} onChange={(e) => setPlant(e.target.value)} className="text-sm" />
      </Field>
      <Field label="Size">
        <Input value={size} onChange={(e) => setSize(e.target.value)} className="text-sm" />
      </Field>
      <Field label="Quantity">
        <Input
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="text-sm"
        />
      </Field>
    </Shell>
  );
}

function Shell({
  title,
  desc,
  children,
  onConfirm,
  onCancel,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        <div className="mt-4 space-y-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

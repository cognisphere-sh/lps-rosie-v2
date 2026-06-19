// Builds the customer-facing quote as inline-styled HTML that pastes cleanly
// into Gmail, and copies it to the clipboard. Ported from lps-rosie's
// template-builders (email variant 1) and trimmed to the Ws* item shape — the
// explicit white backgrounds keep Gmail's dark-mode compose from painting its
// own card behind each pasted block.

import {
  isUnavailable,
  lineTotal,
  type WsItemStatus,
  type WsOrderItem,
} from "@/components/supplier/supplier-workspace-data";

interface Glyph {
  symbol: string;
  label: string;
  color: string;
}

const STATUS_GLYPH: Record<WsItemStatus, Glyph> = {
  available: { symbol: "✓", label: "Available", color: "#16a34a" },
  can_order: { symbol: "↻", label: "Can Order", color: "#0284c7" },
  diff_size_qty: { symbol: "△", label: "Different Size/Qty", color: "#ea580c" },
  ordered: { symbol: "✓", label: "Ordered", color: "#2563eb" },
  confirmation_pending: { symbol: "…", label: "Pending", color: "#6b7280" },
  unavailable: { symbol: "✗", label: "Unavailable", color: "#dc2626" },
};

const formatPrice = (n: number) => `$${n.toFixed(2)}`;

const CELL = "background-color:#ffffff;color:#333333;";
const HEAD = "background-color:#f4f4f4;color:#333333;";
const WRAP = "word-wrap:break-word;overflow-wrap:break-word;white-space:normal;";

function rowHtml(item: WsOrderItem): { html: string; total: number } {
  const g = STATUS_GLYPH[item.status];
  const unavailable = isUnavailable(item);
  const price = unavailable ? 0 : item.unitPrice ?? 0;
  const qty = unavailable ? 0 : item.qty;
  const total = lineTotal(item);
  const dash = "—";
  const badge = `<span style="font-size:11px;font-weight:600;color:${g.color};">${g.symbol} ${g.label}</span>`;
  const cell = `${CELL}border:1px solid #ccc;padding:6px 10px;`;
  const html = `<tr style="${CELL}">
      <td style="${cell}text-align:center;${WRAP}">${badge}</td>
      <td style="${cell}text-align:right;">${unavailable ? dash : qty}</td>
      <td style="${cell}${WRAP}">${item.size}</td>
      <td style="${cell}${WRAP}">${item.name}</td>
      <td style="${cell}text-align:right;">${unavailable ? dash : formatPrice(price)}</td>
      <td style="${cell}text-align:right;">${unavailable ? dash : formatPrice(total)}</td>
      <td style="${cell}${WRAP}">${item.quoteNotes || dash}</td>
    </tr>`;
  return { html, total };
}

export function buildQuoteEmailHtml(items: WsOrderItem[], customerName: string): string {
  let subtotal = 0;
  const rows = items
    .map((it) => {
      const r = rowHtml(it);
      subtotal += r.total;
      return r.html;
    })
    .join("\n");

  const th = `${HEAD}border:1px solid #999;padding:6px 10px;font-weight:bold;`;
  const table = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:625px;margin:16px 0;${CELL}">
  <thead>
    <tr style="${HEAD}">
      <th style="${th}text-align:center;">Status</th>
      <th style="${th}text-align:right;">Qty</th>
      <th style="${th}text-align:left;">Size</th>
      <th style="${th}text-align:left;">Name</th>
      <th style="${th}text-align:right;">Unit Price (USD)</th>
      <th style="${th}text-align:right;">Total Price (USD)</th>
      <th style="${th}text-align:left;">Comments</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
  <tfoot>
    <tr style="font-weight:bold;${CELL}">
      <td colspan="5" style="${CELL}border:1px solid #999;padding:6px 10px;text-align:right;">Subtotal</td>
      <td style="${CELL}border:1px solid #999;padding:6px 10px;text-align:right;">${formatPrice(subtotal)}</td>
      <td style="${CELL}border:1px solid #999;padding:6px 10px;"></td>
    </tr>
  </tfoot>
</table>`;

  const greeting = customerName ? `Hello ${customerName},` : "Hello,";
  const p = "margin:0 0 12px 0;color:#333333;background-color:#ffffff;padding:2px 4px;";
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333333;background-color:#ffffff;padding:8px;">
<p style="${p}">${greeting}</p>
<p style="${p}">Thank you for your inquiry. Please find the pricing and availability for your requested plant list below:</p>
${table}
<p style="${p}">Please review the details above and let me know if you would like to proceed with the order or if you need any adjustments.</p>
<p style="${p}">Best regards,</p>
</div>`;
}

export async function copyQuoteToClipboard(
  items: WsOrderItem[],
  customerName: string,
): Promise<void> {
  const html = buildQuoteEmailHtml(items, customerName);
  // The one consumer is paste-into-Gmail, which takes the HTML; the plain blob
  // is just so a bare text editor gets the raw markup rather than nothing.
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html], { type: "text/plain" }),
    }),
  ]);
}

'use client'

// The printable availability request — what the portal's Print button puts on
// paper (or in a PDF, through the browser's print dialog), laid out as the
// availability-request PDF LPS already sends by email: a title and request
// number, one bordered row per line with a status checklist, then an
// Additional Comments box and a Submitted by line, with the quotation
// disclaimer in the footer. The **AR number** heads it and repeats in the
// table's footer on every page: the portal never shows it on screen, but a
// filled sheet comes back as an upload, and the number is how the agent knows
// which request the answers belong to.
//
// It is a portal onto <body>, shown only under `@media print` (see
// `globals.css`): the app's own frame is a fixed, overflow-hidden box that a
// print would clip, so the sheet stands beside it rather than inside it.

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { availabilityRecordName, AR_ANSWER_OPTIONS, type ARDetail } from '@/lib/availability'
import { money, num } from '@/lib/format'

export function ARPrintSheet({
  request,
  name,
  displayText = (t) => t,
}: {
  request: ARDetail
  /** The request's name as the portal prints it. */
  name: string
  /** The portal's redaction over LPS's notes. */
  displayText?: (text: string) => string
}) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => setNode(document.body), [])
  if (!node) return null
  const ref = availabilityRecordName(request)
  const border = '1.5px solid #999'
  const cell = (extra: CSSProperties = {}): CSSProperties => ({ border, padding: '4px 6px', verticalAlign: 'top', ...extra })
  return createPortal(
    <div id="ar-print-sheet" className="hidden print:block" aria-hidden>
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <h1 className="m-0 text-[18px] font-bold text-black">Availability Request</h1>
          <p className="m-0 text-[12px] font-semibold text-neutral-700">Request #: {ref}</p>
        </div>
        <p className="m-0 text-right text-[11px] text-neutral-700">{name}</p>
      </div>
      <table className="w-full border-collapse text-[10px] text-black" style={{ border: '2px solid #999' }}>
        <thead>
          <tr className="bg-neutral-100 text-left">
            {['Qty', 'Size', 'Name', 'Status', 'Avail. Qty', 'Price', 'Notes'].map((h) => (
              <th key={h} className="font-bold" style={cell({ padding: '3px 6px' })}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr key={item.id} style={{ breakInside: 'avoid' }}>
              <td className="text-right tabular-nums" style={cell({ width: 34 })}>{num(item.demandedQuantity)}</td>
              <td style={cell({ width: 44 })}>{item.size ?? ''}</td>
              <td style={cell()}>
                <span className="block font-bold">{item.name}</span>
                {/* Our note about the line, under the plant it is about — as on screen. */}
                {item.noteForSupplier && <span className="block whitespace-pre-wrap text-[8.5px] text-neutral-700">{displayText(item.noteForSupplier)}</span>}
              </td>
              <td style={cell({ width: 176, padding: '3px 6px' })}>
                {/* Full status labels, including Pending, stay readable on paper. */}
                <span className="grid grid-cols-1 gap-y-px">
                  {AR_ANSWER_OPTIONS.map(({ value: status, label }) => (
                    <span key={status} className="flex items-center gap-1 whitespace-nowrap leading-[14px]">
                      <span
                        className="inline-block size-2 flex-none"
                        style={{ border: '1px solid #333', background: (item.status ?? '') === status ? '#333' : 'transparent' }}
                      />
                      {label}
                    </span>
                  ))}
                </span>
              </td>
              <td className="text-right tabular-nums" style={cell({ width: 44 })}>{num(item.availableQuantity)}</td>
              <td className="text-right tabular-nums" style={cell({ width: 54 })}>{money(item.unitPrice)}</td>
              <td className="whitespace-pre-wrap" style={cell({ width: 96 })}>{item.noteFromSupplier ?? ''}</td>
            </tr>
          ))}
        </tbody>
        {/* A footer row repeats on every printed page, so a page on its own
            still says which request it is — the AR number is what the
            agent reads back when the filled sheet is uploaded. */}
        <tfoot>
          <tr>
            <td colSpan={7} className="text-[8.5px] text-neutral-600" style={cell({ padding: '2px 6px' })}>
              {ref} · {name}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mb-0 mt-3 text-[10px] font-bold">Additional Comments</p>
      <div className="min-h-14 whitespace-pre-wrap text-[10px]" style={{ border, padding: 6 }}>{displayText(request.noteForSupplier ?? '')}</div>
      <p className="mt-3 flex items-center gap-3 text-[10px] font-bold">
        Submitted by:
        <span className="flex-1" style={{ borderBottom: '1px solid #333' }} />
      </p>
      <p className="mt-4 text-[8.5px] text-neutral-500" style={{ borderTop: '1px solid #ccc', paddingTop: 4 }}>
        {ref} — This quotation is subject to plant availability at the time of order. Please contact us to confirm
        availability, lead times, and final pricing.
      </p>
    </div>,
    node,
  )
}

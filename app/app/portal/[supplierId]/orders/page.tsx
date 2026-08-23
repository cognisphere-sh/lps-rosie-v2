'use client'

// The Orders tab — drawn, and drawn empty on purpose: there are no order
// tables yet (migration 0055 defers them; a closed_won job request is the hook
// they will be created from). The tab exists so the portal's shape is the
// final one; filling it is the order-tables work, not a portal change.

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { PortalFrame } from '@/components/workspace/portal'

export default function PortalOrdersPage() {
  const params = useParams<{ supplierId: string }>()
  const supplierId = Number.parseInt(params.supplierId, 10)
  const [supplierName, setSupplierName] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    void (async () => {
      const res = await fetch(`/api/portal/${supplierId}`)
      if (res.ok) {
        const body = (await res.json()) as { supplier: { name: string } }
        setSupplierName(body.supplier.name)
      }
    })().catch(() => {})
  }, [supplierId])

  return (
    <PortalFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="orders"
    >
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        No orders yet — confirmed orders will appear here.
      </p>
    </PortalFrame>
  )
}

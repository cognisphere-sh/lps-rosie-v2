'use client'

// The portal's Settings page. It holds one thing — your password — because
// that is the only portal setting a supplier owns: everything else about their
// account (the username, which company it sees, whether it exists at all) is
// ours, and lives on the supplier page's Portal access tab. The rail entry was
// drawn and disabled until this landed.

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ChangePasswordForm } from '@/components/change-password-form'
import { PartnerFrame, type PartnerAlert } from '@/components/workspace/partner'
import { redactPartnerRequestRefs } from '@/lib/partner-display'

export default function PartnerSettingsPage() {
  const params = useParams<{ id: string }>()
  const supplierId = Number.parseInt(params.id, 10)
  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  // The header bell is on every portal page, so this one loads the same
  // unanswered-request list the Requests tab shows.
  const [alerts, setAlerts] = useState<PartnerAlert[]>([])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    void (async () => {
      const res = await fetch(`/api/partner/${supplierId}`)
      if (res.ok) {
        const body = (await res.json()) as {
          supplier: { name: string }
          requests: { id: number; status: string; jobName: string | null; createdAt: string }[]
        }
        setSupplierName(body.supplier.name)
        setAlerts(
          body.requests
            .filter((request) => request.status === 'new')
            .map((request) => ({
              id: request.id,
              label: request.jobName ? redactPartnerRequestRefs(request.jobName) : 'Availability request',
              at: Date.parse(request.createdAt),
            })),
        )
      }
    })().catch(() => {})
  }, [supplierId])

  // Whose password this is. `/api/auth/me` is the only thing that knows the
  // handle they typed — the portal payload is about the company, not the login.
  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (res.ok) setUsername(((await res.json()) as { user: string | null }).user)
    })().catch(() => {})
  }, [])

  return (
    <PartnerFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="settings"
      title="Settings"
      alerts={alerts}
      onOpenAlert={() => { window.location.href = `/partner/${supplierId}` }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 pb-5 md:p-4">
        <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-bold text-foreground">Password</span>
            <span className="text-[12px] text-muted-foreground">
              {username ? `Signed in as ${username}. ` : ''}
              Changing it here signs in with the new one from now on; anyone else at{' '}
              {supplierName ?? 'your company'} keeps their own login.
            </span>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </PartnerFrame>
  )
}

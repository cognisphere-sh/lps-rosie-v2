'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ARDetail } from '@/lib/availability'
import { AvailabilityRequestView } from './availability-request-view'
import { Printer } from 'lucide-react'

export function PublicAvailability({ token }: { token: string }) {
  const [request, setRequest] = useState<ARDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const tail = useRef<Promise<void>>(Promise.resolve())
  const endpoint = `/api/public/availability/${token}`
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.request) { setRequest(null); throw new Error(body.error || 'Could not load this request. Try again in a moment.') }
    setRequest(body.request)
  }, [endpoint])
  useEffect(() => {
    const refresh = () => { void load().catch(e => setError(e.message)) }
    refresh()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [load])
  function write(body: object) {
    const previous = 'submit' in body ? tail.current : tail.current.catch(() => {})
    const operation = previous.then(async () => {
      setError('')
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not save that change. Try again in a moment.')
      await load()
    })
    tail.current = operation
    return operation
  }
  return <main id="public-availability" className="mx-auto flex h-dvh max-w-[1600px] flex-col overflow-hidden bg-background">
    <header className="grid flex-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 pb-3 pt-[max(12px,env(safe-area-inset-top))] pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] min-[900px]:flex min-[900px]:gap-3 md:px-4 print:hidden">
      <span className="font-serif text-[18px] font-bold leading-tight tracking-[-0.01em]">Local Plant Supply</span>
      {request && <>
        <span className="col-start-1 row-start-2 text-[11px] text-muted-foreground">{request.items.length} {request.items.length === 1 ? 'line' : 'lines'} · {request.items.length - request.answeredCount} pending</span>
        <button type="button" aria-label="Print" title="Print" onClick={() => window.print()}
          className="col-start-2 row-span-2 row-start-1 ml-auto flex size-11 items-center justify-center rounded-lg border border-border bg-card hover:bg-lps-tint"><Printer className="size-4" /></button>
      </>}
    </header>
    <AvailabilityRequestView request={request} loading={!request && !error} error={error} saving={busy}
      onPatch={async (itemId, changes) => {
        try { await write({ itemId, changes }) } catch (e) { setError((e as Error).message) }
      }}
      onSubmit={async (supplierNote) => {
        setBusy(true)
        try { await write({ submit: true, supplierNote }); return true } catch (e) { setError((e as Error).message); return false } finally { setBusy(false) }
      }} />
  </main>
}

import Link from 'next/link'
import { cn } from '@/lib/utils'

export function PartnerHistoryTabs({ supplierId, selected }: { supplierId: number; selected: 'orders' | 'requests' }) {
  return <nav aria-label="Order/Request History" className="flex gap-2">
    {(['orders', 'requests'] as const).map((tab) => <Link key={tab} href={`/partner/${supplierId}/${tab === 'orders' ? 'closed-orders' : 'closed'}`} aria-current={selected === tab ? 'page' : undefined} className={cn('min-h-11 rounded-lg border border-border px-5 py-3 text-[13px] font-semibold', selected === tab ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>{tab === 'orders' ? 'Orders' : 'Requests'}</Link>)}
  </nav>
}

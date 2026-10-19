import Link from 'next/link'
import { cn } from '@/lib/utils'

export function PartnerHistoryTabs({ supplierId, selected }: { supplierId: number; selected: 'orders' | 'requests' }) {
  return <nav aria-label="Order/Request History" data-vt-tabs className="flex gap-2">
    {(['orders', 'requests'] as const).map((tab) => <Link key={tab} href={`/partner/${supplierId}/${tab === 'orders' ? 'closed-orders' : 'closed'}`} aria-current={selected === tab ? 'page' : undefined} style={selected === tab ? { viewTransitionName: 'lps-history-tab' } : undefined} className={cn('min-h-11 rounded-lg border border-border px-5 py-3 text-[13px] font-semibold transition-colors duration-150 ease-lps', selected === tab ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>{tab === 'orders' ? 'Orders' : 'Requests'}</Link>)}
  </nav>
}

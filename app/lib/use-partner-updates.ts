'use client'

import { useJobUpdates } from '@/lib/use-job-updates'

/** Supplier data is always re-read through the authorized portal APIs. */
export function usePartnerUpdates(supplierId: number, refresh: () => void | Promise<unknown>): void {
  useJobUpdates(refresh, Number.isInteger(supplierId), `/api/partner/${supplierId}/events`)
}

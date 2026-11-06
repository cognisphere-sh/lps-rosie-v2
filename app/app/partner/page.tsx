import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveUser } from '@/lib/session'

export default async function PartnerPage() {
  const user = await resolveUser((await cookies()).toString())
  if (user?.role === 'partner' && user.supplierId !== null) redirect(`/partner/${user.supplierId}`)
  if (user?.role === 'admin') redirect('/suppliers')
  redirect('/login?next=/partner')
}

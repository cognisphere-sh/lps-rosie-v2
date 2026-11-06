import { Suspense } from 'react'
import type { Metadata } from 'next'

import { AuthFrame } from '@/components/auth-frame'
import { LoginForm } from '@/components/login-form'
import { loginPortalName, loginPortalMetadata } from '@/lib/portal-branding-server'

type Props = { searchParams: Promise<{ next?: string | string[] }> }

async function portalNameFor({ searchParams }: Props) {
  const { next } = await searchParams
  return loginPortalName(typeof next === 'string' ? next : null)
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { next } = await props.searchParams
  return await loginPortalMetadata(typeof next === 'string' ? next : null) ?? { title: 'Local Plant Supply' }
}

export default async function LoginPage(props: Props) {
  const portalName = await portalNameFor(props)
  return (
    <Suspense fallback={<AuthFrame signInLogo portalName={portalName}>{null}</AuthFrame>}>
      <LoginForm portalName={portalName} />
    </Suspense>
  )
}

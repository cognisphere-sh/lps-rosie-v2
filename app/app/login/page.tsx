'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Leaf } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Sign-in for both populations: the internal team and LPS Partner suppliers.
 * One form — where you land afterwards is decided server-side from the role
 * (`/api/auth/login`), so nothing here has to know which you are.
 */
function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Credentials live in Supabase Auth (app/lib/auth.ts). `/api/auth/login` is
  // this app's own route — it verifies them and sets the signed `app_sid`
  // cookie — not the harness passthrough it was until 2026-08-30.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = (await res.json().catch(() => ({}))) as { next?: string; error?: string }
      if (res.ok) {
        // The deep link that triggered the sign-in wins, but only if it is a
        // path on this app — an absolute URL here would be an open redirect.
        const next = params.get('next')
        router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : body.next ?? '/')
        router.refresh()
      } else if (res.status === 401) {
        setError('Invalid username or password.')
        setBusy(false)
      } else {
        // A 502 is the sign-in service being down, not a bad password — saying
        // so saves someone hunting for a typo that isn't there.
        setError(body.error ?? 'Could not sign you in. Try again in a moment.')
        setBusy(false)
      }
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-accent">
            <Leaf className="size-5 text-accent-foreground" />
          </span>
          <CardTitle className="font-serif text-xl">Local Plant Supply</CardTitle>
          <CardDescription>
            Sign in to browse suppliers and availability, or to answer availability
            requests as an LPS Partner.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                suppressHydrationWarning
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                suppressHydrationWarning
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={busy || !username || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

// `useSearchParams` needs a Suspense boundary to keep the page statically
// renderable; the fallback is the card's own frame, so nothing jumps.
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center p-6" />}>
      <LoginForm />
    </Suspense>
  )
}

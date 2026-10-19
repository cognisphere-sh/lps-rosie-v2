'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AuthFrame } from '@/components/auth-frame'
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
import { loginDestination } from '@/lib/login-return'

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
        // Keep a safe job deep link, but never override a required password change.
        router.push(loginDestination(params.get('next'), body.next ?? '/'))
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
    <AuthFrame>
      <Card className="w-full max-w-sm border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="font-serif text-[30px] font-bold tracking-[-0.01em]">Sign in</CardTitle>
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
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                suppressHydrationWarning
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                suppressHydrationWarning
              />
            </div>

            {error && (
              <Alert variant="destructive" className="lps-pop">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={busy || !username || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  )
}

// `useSearchParams` needs a Suspense boundary to keep the page statically
// renderable; the fallback is the same frame, so nothing jumps.
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFrame>{null}</AuthFrame>}>
      <LoginForm />
    </Suspense>
  )
}

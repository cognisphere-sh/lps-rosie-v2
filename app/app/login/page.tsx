'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Credentials belong to the cognisphere harness (harness/.secrets/users.json);
  // /api/auth/login is proxied to it and it sets the `pi_sid` session cookie.
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
      if (res.ok) {
        router.push('/suppliers')
        router.refresh()
      } else {
        setError('Invalid username or password.')
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
          <CardDescription>Sign in to browse suppliers and availability.</CardDescription>
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

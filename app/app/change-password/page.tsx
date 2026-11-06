'use client'

import { useRouter } from 'next/navigation'

import { ChangePasswordForm } from '@/components/change-password-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Set your own password — where `proxy.ts` holds an account that is still on
 * the generated one it was handed (`app_users.must_change_password`, migration
 * 0087). Until the change goes through, this is the only page that session can
 * reach; afterwards the cookie is re-minted without the flag and the app opens
 * up.
 *
 * It is the same frame as `/login` on purpose: this is the second half of a
 * first sign-in, not a settings errand. Nothing routes here by hand — the
 * gate does — but visiting it with an ordinary session is harmless and simply
 * changes your password.
 */
export default function ChangePasswordPage() {
  const router = useRouter()

  return (
    <Card className="w-full max-w-sm border-0 bg-transparent shadow-none">
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-serif text-[30px] font-bold tracking-[-0.01em]">Choose a password</CardTitle>
        <CardDescription>
          You signed in with a password we generated for you. Replace it with one
          only you know to carry on.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChangePasswordForm
          submitLabel="Save and continue"
          onDone={(next) => {
            // The cookie the reply set no longer carries the flag, so this
            // navigation is the first one the gate lets through.
            router.push(next)
            router.refresh()
          }}
        />
      </CardContent>
    </Card>
  )
}

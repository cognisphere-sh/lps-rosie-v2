import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Compact clipboard action shared by request and order cards. */
export function CopyButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" size="sm" {...props}
    className={cn('text-[12px] font-semibold text-muted-foreground', className)} />
}

import { cn } from './utils.ts'

/** Deterministic control shapes for the shared agent-chat button. */
export function agentChatButtonClass({
  labelled = false,
  quickAction = false,
  className,
}: {
  labelled?: boolean
  quickAction?: boolean
  className?: string
}) {
  return cn(
    quickAction
      ? 'flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg border border-border bg-transparent text-primary hover:bg-muted'
      : labelled
        ? 'flex min-h-11 min-w-11 flex-none cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[12px] font-semibold text-foreground shadow-xs hover:bg-accent'
        : "relative flex flex-none cursor-pointer items-center border-none bg-transparent p-0 opacity-75 hover:opacity-100 pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']",
    'disabled:cursor-wait disabled:opacity-50',
    className,
  )
}

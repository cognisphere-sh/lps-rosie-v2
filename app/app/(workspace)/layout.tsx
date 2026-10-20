import { WorkspaceShell } from '@/components/workspace/shell'

// The admin workspace's pages share one Shell, mounted here once: moving
// between them swaps only the page, so the rail, the agent chat and the bell
// keep their state and their connections. Each page still describes its own
// chrome with `<Shell>` (components/workspace/shell.tsx).
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>
}

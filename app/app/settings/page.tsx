import { SettingsView } from '@/components/workspace/settings'
import { Shell } from '@/components/workspace/shell'

export default function SettingsPage() {
  return (
    <Shell page="settings" title="Settings" subtitle="Harness, agents and appearance">
      <SettingsView />
    </Shell>
  )
}

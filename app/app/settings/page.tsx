import { SettingsView } from '@/components/workspace/settings'
import { Shell } from '@/components/workspace/shell'

export default function SettingsPage() {
  return (
    <Shell page="settings" title="Settings" hideHeaderOnMobile>
      <SettingsView />
    </Shell>
  )
}

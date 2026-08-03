import { ChatAppearanceSettings } from '@/components/workspace/chat-appearance-settings'
import { Shell } from '@/components/workspace/shell'

export default function SettingsPage() {
  return (
    <Shell page="settings" title="Settings" subtitle="Appearance and preferences">
      <ChatAppearanceSettings />
    </Shell>
  )
}

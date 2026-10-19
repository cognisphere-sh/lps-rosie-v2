import { HomeLink, LostRow } from '@/components/workspace/lost-row'

export default function NotFound() {
  return (
    <LostRow
      title="Nothing growing at this address"
      body="This page doesn’t exist — the link may be out of date, or the record it pointed to was deleted. If someone sent it to you, ask them for a fresh one."
    >
      <HomeLink primary />
    </LostRow>
  )
}

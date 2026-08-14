# Gmail label IDs (Daisy's gws label taxonomy)

Reference IDs only — *which* label to apply and how is the
`availability-drop-intake` skill.

Look these up live with `gws gmail users labels list --params '{"userId":"me"}'`
if this file goes stale — but as of 2026-07-07 these are the IDs:

| Label | ID |
| --- | --- |
| `Daisy` | `Label_12` |
| `Daisy/Not Availability` | `Label_14` |
| `Daisy/Catalogued` | `Label_15` (created 2026-07-07) |

Still need to create (create on first use, same pattern as `Daisy/Catalogued`):
- `Daisy/Failed`
- `Daisy/Escalated`

## Gotcha: `gws` binary location

`scripts/gws/` in the agent dir only has `format-email` — the actual `gws`
CLI is a global npm binary. Just call it directly as `gws ...` (it's on
PATH), don't look for it under `scripts/gws/`.

// The supplier this workspace belongs to. Static identity/config — the rest of
// the workspace (orders, inventory, customers, chat) is loaded live from
// Rosie's workspace files via lib/ws-adapter.ts and lib/data.ts.

export interface SupplierProfile {
  name: string
  contactName: string
  tier: string
}

export const SUPPLIER: SupplierProfile = {
  name: "Austin Plant Supply",
  contactName: "Chris",
  tier: "Wholesale nursery · Austin, TX",
}

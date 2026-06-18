// Shapes mirror the real workspace files exactly (no adapter / rename layer —
// the UI speaks the file schema directly). See:
//   workspace/inventory/<category>.json
//   workspace/customers/<slug>/customer.json
//   workspace/customers/<slug>/jobs/<job>/job.json

export interface InventoryEntry {
  plant_name: string;
  size: string;
  unit_price: number | null;
  common_names: string[];
  comment: string;
  attachments: unknown[];
}

export interface JobItem {
  id: string;
  plant_name: string;
  customer_comments: string;
  size: string;
  quantity: number;
  price: number | null;
  quantity_available: number | null;
  status: string; // pending | available | unavailable | diff | can_order
  customer_facing_notes: string;
  internal_notes: string;
}

export interface Job {
  job_name: string;
  created_at: string;
  status: string;
  customer_comments: string;
  delivery_address: string;
  tax_pct: number | null;
  metadata: Record<string, unknown>;
  items: JobItem[];
}

export interface Customer {
  slug: string;
  name: string;
  poc_name: string;
  phones: string[];
  emails: string[];
  address: string;
  notes: string;
  created_at: string;
}

export interface CustomerWithJobs extends Customer {
  jobs: { dir: string; job: Job }[];
}

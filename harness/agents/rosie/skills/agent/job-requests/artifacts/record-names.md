### Stored Order and AR names

Record names use `JR-<job id>:AR-<n>` and `JR-<job id>:Order-<n>`: for
example, `JR-42:AR-1`, `JR-42:AR-2` and `JR-42:Order-1`. AR and Order
sequences each start at 1 within a job. Read the saved `record_name` after
creation; the database assigns it when the first job allocation is linked.
Never use a global AR/order id as the per-job sequence or invent a number
from a filtered list. Do not overwrite these names, renumber on edits/deletes,
or change the job's own name. Shared records retain their first linked job's
name anchor; historical backfill uses the lowest linked job. Primary keys,
portal URLs and all allocations remain unchanged.

These are **record names only**. Supplier messages still identify affected
work by the actual job name, without JR/AR/order numbers, and include the
verified direct portal link under `supplier-coordination`.

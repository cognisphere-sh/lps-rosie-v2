/**
 * Customer helpers that both halves of the app share — no database access, so
 * a server route and a client page can each import them.
 */

/** `Riverbend Landscapes` → `riverbend-landscapes`. Rosie's own slug rule. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * The customer's rosie thread — `customers.rosie_thread_id` where it is set.
 *
 * Rosie mints the column on first contact (`customer-<slug of name>`, with
 * `-<id>` appended only on a collision with a different customer). Until she
 * does, the base rule gives the same id her `customer-coordination` skill
 * would, so the app can open the conversation before there is one to open.
 */
export const customerThreadId = (customer: { name: string; rosieThreadId: string | null }) =>
  customer.rosieThreadId ?? `customer-${slug(customer.name)}`

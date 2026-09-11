/**
 * Customer helpers that both halves of the app share — no database access, so
 * a server route and a client page can each import them.
 */

/** `customers.type` CHECK vocabulary. An unset classification is stored as NULL. */
export const CUSTOMER_TYPES = ['Homeowner/Retail', 'Landscape Professional'] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

/**
 * The customer's canonical Rosie thread, when it has been minted and stored.
 *
 * The app must not derive a slug for a missing thread: Rosie owns collision
 * handling when she first contacts the customer. Guessing here can open a
 * second conversation that is not the customer's recorded contact history.
 */
export const customerThreadId = (customer: { rosieThreadId: string | null }): string | null => {
  const threadId = customer.rosieThreadId?.trim()
  return threadId || null
}

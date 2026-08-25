const REQUEST_REF = /(?<![\p{L}\p{N}])AR(?:\s*[-‐‑‒–—―]\s*|\s*#\s*|\s+)\d+(?![\p{L}\p{N}])/giu

/** Hide an internal availability-request reference in supplier-facing copy. */
export function redactPortalRequestRefs(text: string): string {
  return text.replace(REQUEST_REF, 'availability request')
}

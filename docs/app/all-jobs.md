# All jobs (`/requests`)

All jobs is the one Jobs list. Its query, filters and page are retained in tab-scoped state. The server keeps the default order as parent `job_requests.updated_at DESC NULLS LAST`, then request `id DESC`; chat and line-item activity do not participate in that order. Created and Updated filters are rolling parent-request date windows, and the list remains server-paged.

## Mobile toolbar

The page resolves one `<900px` media query and passes that result to the toolbar and cards. SSR and unresolved hydration render a neutral, noninteractive toolbar placeholder; once resolved, exactly one branch mounts. Below 900px, the first toolbar row is a shrinking Search field beside one 44px icon-only **Filters** button. The row is non-wrapping and bounded to the page column. Expand all / Collapse all remains on the separate action row because it changes card disclosure rather than the result set. At 900px and above, only the established shared desktop toolbar and chip menus mount, including one copy of the Shell-owned actions.

Filters opens one body-portalled modal surface containing Status, Item status, Customer, Created and Updated. It edits the same state and therefore emits the same API query parameters as the desktop chips. Status starts with Sourcing, Quoted, Closed won and Closed lost selected and Archived excluded. The Filters active count is the number of filter groups that differ from that baseline; the four baseline status selections do not display as four active filters. While open, every body sibling is made inert and `aria-hidden` and body scrolling is locked, with each prior value restored exactly. Escape, pointer/touch backdrop and the explicit 44px Close control dismiss the surface; Tab and Shift+Tab stay inside. Each opening focuses Close once, while filter-state rerenders retain focus on the checkbox or radio just changed. Ordinary dismissal restores trigger focus. Crossing 899/900 unmounts the old surface/menu and its listeners and preserves selections. It transfers focus to the newly mounted Search only when the outgoing toolbar owned focus or its Filters surface was open; a connected control outside that toolbar or any other modal (Delete, availability and so on) keeps focus. Every transfer frame is cancelled or generation-invalidated by another crossing or unmount.

## Request-card actions

The chevron remains the only card expansion control. Collapsed mobile cards have no Actions control. An expanded mobile card adds one compact utility strip with the working **Delete job** action. Desktop retains its compact trash action in the card head.

Delete job opens the existing permanent-delete confirmation and uses the same `DELETE /api/requests/:id` path. Its authorization, related availability-request/answer deletion, history cleanup, result toast and focus-return behavior are unchanged. No Print, Copy or inactive utility is shown.

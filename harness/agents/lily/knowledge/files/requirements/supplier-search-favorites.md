# Open Supplier Search on favorites and recently visited suppliers

- Status: staged — parent reports Bhoumik notified via Telegram369; awaiting persistence/default-workflow contract, no build
- Route: bhoumik; dependent UI/UX to Nova after supported contract
- Raised: 2026-10-07 by Chris (via telegram)
- Updated: 2026-10-07 11:27:41 CDT

## Problem

Chris wants Supplier Search to open on a useful repeat-supplier shortlist rather than the current latest-updated directory. Favorite companies and suppliers whose details he has recently opened should be easy to return to, without losing access to the full directory.

## Evidence

- 2026-10-07 11:20:53 CDT, `telegram:-1004474937526:366`: “Can we add favorites and upon opening supplier search it shows only favorites and what has been searched in the last 30 days? Perhaps we add something in the filter button that produces the lasted updated view that is currently show at opening?”
- 2026-10-07 11:22:56 CDT, `telegram:-1004474937526:368`, answers the one recency question: “who's details page I clicked into”. This supersedes a search-query/result-history interpretation.
- Bounded local source/docs check at HEAD `2af1653`: actual surface is staff Supplier Search, with companies/farms, existing filters and full-set sort/paging. No favorites or supplier-detail visit history contract found in relevant list/profile/state/API/schema. Current opening delegates blank search to supplier-record latest-update order, not stock freshness. Source is dirty/local, not live verification. Evidence: `workspace/threads/main/tasks/supplier-search-favorites/source-check-2026-10-07.md`.

## What it should do

- Let Chris mark and unmark favorite suppliers, retaining the choice for later use.
- On opening Supplier Search, show favorites **OR** suppliers whose details page he opened in the preceding 30 days, with each company shown once. A favorite remains eligible even without a visit in that window. A supplier need not be both favorite and recently visited.
- Count intentional supplier-details openings, not search terms, query matches, list impressions, background/profile refreshes or stock updates. The 30 days describe Chris's activity, not inventory freshness.
- Offer the current **Latest updated** directory view through the existing Filters control. It remains a full-directory alternative with its existing latest supplier-record update meaning; do not rename it as recently visited or freshly stocked.
- Keep full-directory search/access, existing filter and sorting choices, company/farm identity, authentication and result counts/pagination intact. The opening shortlist must not become an undisclosed permanent restriction on future searches.

## Acceptance criteria

- After favoriting one eligible supplier, visiting a different supplier's details within 30 days, and leaving another supplier neither favorite nor recently visited, opening the shortlist includes the first two and excludes the third.
- An older favorite still appears; an unfavorited supplier visited only outside the window does not. A supplier qualifying both ways appears once.
- Unfavoriting removes only its favorite eligibility; a still-recent details visit continues to qualify it. A later intentional visit renews recent eligibility.
- Mere list display, query matches, background profile reads and availability changes do not add recent suppliers or refresh their visit time.
- Chris can choose Latest updated in Filters and reach/search other suppliers without losing saved favorites. Existing filters, grouping, complete-set counts, pagination, sorting and permission boundaries remain correct in either supported view.
- An empty shortlist is explained honestly and leaves the full directory reachable; exact fallback behavior is decided before build, not silently assumed to show all.
- Remembered shortlist state follows the Bhoumik-approved scope and retention contract; it neither leaks nor silently mixes another user's activity.

## Out of scope

- Plant Search, supplier portal, customer/job defaults or stock-freshness rules.
- Team-global activity, analytics, free-form query history, collecting every network read, new supplier classification or qualification.
- Changing inventory/source data, operational statuses, orders, pricing, outreach, supplier identity or access rights.
- Prescribing storage, architecture or a new data model. No independent Nova favorites/default implementation authorized.

## Assumptions

- Personal to Chris's signed-in account is the reasonable working scope; Chris has not approved a shared-team or cross-device persistence policy. Bhoumik owns the supported scope decision.
- Existing company-level Supplier Search remains the presentation unit. Whether opening a farm's details qualifies its parent company must be settled with the existing identity contract, without conflating farms or altering profile links.
- No new shortlist ranking is requested; preserve existing sorting choices rather than infer favorites-first versus visits-first.

## Open questions

- Bhoumik: approve the minimal remembered-favorites/recent-details/default-view workflow and its persistence scope/window boundary. Existing inspected contracts do not provide it; UI is dependent.
- Bhoumik: settle company/farm visit attribution, intentional detail-opening boundary and empty-shortlist/clear-reset/search-to-full-directory behavior. Do not treat the recency definition as unresolved or ask Chris again.

## Handoff log

- 2026-10-07 11:27:41 CDT — Parent reports successfully delivered Telegram369 staging Bhoumik's persistent favorites/recent-details/default-view contract. Per-account scope explicitly proposed, not approved. Parent also reports Nova main FYI received requirement/evidence, UI dependent and not build-authorized. No implementation route or shipment; await Bhoumik contract, no additional Chris questions.

- 2026-10-07 11:23:11 CDT — Captured366/368 once with helper; completed bounded relevant source/docs inspection and staged business requirement for parent review. No builder/Telegram handoff, code/DB changes, tests, browser or live audit. Related Supplier filter presentation requirements remain separate; this is not a new routing of their existing UI work.

# Release verification — 2026-09-25

Status: source tests, typecheck and standalone checks pass after local repairs.
Build/deployment and live source provenance remain unverified. 0104 absence is
not a demonstrated compatibility blocker. Reviewed source HEAD: `3c4adca`.

## Database evidence

At 2026-09-25 04:21:18 UTC, read-only PostgREST probes against
`xyeyiqchadfszewztnrf.supabase.co` returned:

| Table | Select (limit 0) | Result |
| --- | --- | --- |
| `availability_requests` | `record_name` | HTTP 400, PostgreSQL `42703`: column does not exist |
| `orders` | `record_name` | HTTP 400, PostgreSQL `42703`: column does not exist |
| `availability_requests` | `*` | HTTP 200 |
| `orders` | `*` | HTTP 200 |

Both repository `config` and `app/.env.local` identify this project, matching
the migration log's `lps-rosie` target. Migration 0104 cannot be confirmed as
applied: its required columns are absent. No migration was applied in this
verification. These probes establish the exposed column state, not a full
catalog audit of migration functions, triggers, constraints or backfill.

The claim that missing columns necessarily break this HEAD's app reads is
incorrect: `order-queries.ts` and `availability-queries.ts` select header `*`,
type `record_name` as optional, and map absent names to null or omit them from
name maps. The live wildcard probes succeeded. Per the corrected deployment
criterion, absent 0104 alone does not block deployment or justify applying it.
These checks do not establish complete API health.

## Order API decision

The original parser silently discarded obsolete `noteFromCustomer` input.
The working-tree fix rejects its presence with HTTP 400:
`Use noteForCustomer instead of noteFromCustomer`.
It rejects before either order-creation RPC, including when the old value is
blank/null or both fields are present. Clients must use the merged field.
Route regression coverage checks both direct and availability-backed orders
and verifies zero writes for rejected inputs. No UI behavior was changed.
This is a source-level loss risk; no live incident has been established.

## Release checks

- TypeScript check (`tsc --noEmit --incremental false`): passed.
- Table configuration and size ordering checks: passed.
- Order regression tests: all 27 passed.
- Initial app test suite: 59 of 66 test files passed; 7 failed (see below).
  Run with `node --import tsx --test --test-concurrency=1 lib/*.test.ts lib/*.test.tsx`.
  The normal `tsx` CLI could not open its IPC socket in the sandbox; using
  Node's loader directly allowed the suite to complete.
- Production build/deployment: not run; existing build artifacts preserved.
- Live build source provenance: unresolved. The local build ID
  `sDYR2OTZ1Zc85sMl-94_k` is not evidence of a source commit or deployed identity.

Initial failing test files (subsequently repaired):

- `lib/accent-palette-tokens.test.ts`
- `lib/compact-headers.test.ts`
- `lib/desktop-job-details.test.tsx`
- `lib/job-inbox.test.ts`
- `lib/mobile-availability-request-view.test.tsx`
- `lib/mobile-focused-job-header.test.tsx`
- `lib/plant-name-scroll.test.ts`

The first four also reproduced individually. They cover UI styling, header
structure, sourcing details and navigation assertions, outside this API fix.
The full runner log is `/tmp/lps-release-tests-20260925.log`; the detailed
27-test order result is `/tmp/lps-orders-tests-20260925.log`.

## Test repair follow-up

The seven failing files now pass individually. Two source regressions were
repaired: item note editors again identify their note audience and plant in
accessible names, and the shared focused Job header forwards successful name
edits to the parent refresh callback and exposes the current pencil trigger
for focus restoration. The normal All Jobs save callback remains the fallback.

Stale assertions now exercise the shared card header, the Delete menu and its
confirmation/focus lifecycle, the current customer identity display, weekday
date formatting and the fulfillment selector's keyboard position. The scrollbar
contrast test now reads the combined dark/public CSS selector correctly.
Existing contrast thresholds, note writes, delete error/duplicate-submit cases
and rename refresh checks remain covered.

The full rerun passed 65 of 66 files and exposed an intermittent assertion in
`job-live-ui.test.tsx`: it inspected the intake marker before the passive React
effect necessarily cleared it. A second full serial run with detailed logs
reproduced that race. The test now explicitly waits for the marker to clear;
all 11 tests in that file passed after the repair. No fixed delay or skipped
assertion was introduced. All other files passed in the detailed run.

Latest results across all 66 files: **442 tests passed, zero failed or skipped**.
Typechecking, table configuration, size ordering and `git diff --check` passed.
Detailed full-run log: `/tmp/lps-release-detailed-20260925.log`. Latest per-file
logs: `/tmp/lps-final-*.log`, including the repaired live UI test's rerun.

Source test failures are resolved. Build validation and deployment source
provenance remain outstanding. Database migration is warranted only by a demonstrated
incompatibility or a separately authorized feature requirement. Local API
changes in this report are uncommitted and are not present in `3c4adca` itself.

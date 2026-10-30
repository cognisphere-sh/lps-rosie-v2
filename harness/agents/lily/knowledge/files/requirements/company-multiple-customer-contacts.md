# Link a customer company and both known contacts without choosing one arbitrarily

- Status: staged — urgent Order-work blocker; Bhoumik notified (Telegram 390), no model/repair approval
- Route: bhoumik
- Raised: 2026-10-30 by Chris (via Rosie JR-142; prior explicit BOTH confirmation reported from Telegram 548, October 29)
- Updated: 2026-10-30 08:46:05 CDT

## Problem

JR-142 shows **Unassigned customer** although Chris has identified **Land Water Light** and explicitly confirmed **both Dior Goodwin and Nina Logan**, not asked Rosie to choose one. Rosie reports the Job has no customer link; both contacts exist as separate customer records, and their association to this Job survives only in private internal notes. A single-person assignment cannot truthfully express the requested company and both contacts.

Chris then states, **“i am trying to create an order and the customer information is missing.”** This is an urgent operational Order-work blocker, not merely a card-label complaint. It does not prove a specific Order API/guard failure or grant model-change permission. The company text already in the Job title does not create a company/customer association; renaming, choosing one person, fabricating a company-as-person record or promoting private notes into identity would not solve it.

## Evidence

- Feedback **Known company, both contacts, unassigned**: Rosie’s October 30 08:39:12 owner report on Chris’s JR-142 web message 9 (08:38). Job’s customer link absent; Dior Goodwin is customer 7, Nina Logan customer 13; both belong to Land Water Light. Rosie attributes explicit **BOTH** confirmation to Chris Telegram 548 on October 29. These are attributed owner-verified facts, not Lily live DB verification.
- Feedback **Unassigned prefix beside known company**: Chris web message 11/private screenshot, relayed 08:39:39; Lily inspected in place. Card literally reads `JR-142 - Unassigned customer - Land Water Light | 800 Ox eye Trail`, with Committed, Fri 10/30, Delivery, 4 items and $495.85. Preserve these existing Job/scheduling/status/commercial values; the issue is not a missing Job name.
- Nova’s final existing Order trace (08:45:36) distinguishes no canonical repair from supported **document-only** capacity. Default details follow only the linked customer, otherwise Customer=Not provided; no customer completeness create gate or actual failed RPC established. Existing arbitrary labeled Details rows can preserve truthful company and both separately labeled contacts under exact commitment and specific supplier-facing content approval; BOTH alone is insufficient. Rosie owns approval sufficiency. All rows are supplier-visible/copy/print/share; public-link holders see them if a link is separately minted. AR customer-sharing controls do not protect Order Details. Owner must inspect existing Orders first: new-create details are ignored for an existing open supplier Order. This text does not create/link company or fix Unassigned. No action authorized by the audit.
- Bounded current local schema/app/docs check: required person name, company as attribute, one optional customer association on a Job, one nested customer in Job reads; no supported company-with-multiple-contacts association found in these paths. The company/contacts for this unlinked Job cannot currently be read from a structured customer relationship. Names in the stored Job string or private notes are not that relationship.
- Feedback **Missing customer blocks Order work**: Rosie 08:41:21 relays Chris’s exact web message 13 above. Rosie already requested Nova’s fastest supported existing repair; Lily requested reuse of those findings only, not another audit or runtime action. Parent confirms delivered Bhoumik Telegram **390** urgently escalates this case; it is notification, not approval.
- Earlier `company-only-customer-intake` exposes the shared company-identity gap but explicitly did not cover multiple contacts. Its September source/naming evidence is historical; this is a distinct evidence-backed extension, not a reason to reopen item-6 classification or all CRM behavior.

## What it should do

Represent the verified customer company independently from its people, and associate **both known contacts** with this Job/customer relationship without requiring one as primary. Retain each real person's identity and history. A primary contact, if useful, is a separate optional designation, never a forced choice or default inferred from order, activity, naming or email.

Authorized internal customer/Job views should show the actual linked company and both contacts from the supported relationship. Distinguish missing association from unknown customer identity. Customer selection and subsequent reads must retain the whole supported association, not silently flatten it back to one person.

Reusing company identity, associating contacts, choosing a primary, authorizing communication, and granting customer-portal access are separate decisions. Linkage alone must not send, change recipients or roles, publish internal evidence, merge customer histories, or grant either contact access to this or other Jobs. Existing customer/Job conversations and explicit customer permissions must remain correctly scoped.

## Acceptance criteria

- Under the supported contract, JR-142 can represent Land Water Light and **both Dior Goodwin and Nina Logan**; authorized internal views show the same association after save/reopen. Neither person is arbitrarily substituted for the company or silently dropped.
- Primary may remain unset with both contacts retained. No question asking Chris to choose which of these two is required; he already said BOTH. An explicit later primary decision does not remove the other association or expand authority.
- Company-only intake remains supported by the related requirement; person-only and existing person/company customers remain valid. Multiple known contacts are distinct from an unknown contact, not a reason to invent another person or infer customer type.
- Existing customer records, per-person contact details/history, Job relationships and conversations remain intact. Shared company text alone does not auto-merge people, choose an existing company, globally reassign work or redirect conversation ownership. Ambiguity is surfaced without re-asking settled facts.
- Association does not authorize either contact to send on behalf of the other, add recipients, expose another Job, or obtain customer-portal membership/access. Existing verified routing, audience boundaries and exact-send approvals remain unchanged; implementation must preserve them explicitly.
- Internal note content is never parsed into customer identity or automatically copied into public UI, quotes, customer notes or portal data. Render named identity only from an authorized, supported structured source.
- Supported Order customer projection must preserve the actual company association and eligible known contact facts without silently selecting one person, losing both or rendering missing customer where the relationship is known. Live identity versus saved Order snapshots must follow an explicit Bhoumik-owned contract; fixing an association must not silently rewrite historical Order content or broaden supplier/customer audiences. Nothing is automatically published merely to demonstrate the fix.
- Existing JR-142 name `Land Water Light | 800 Ox eye Trail` and current authoritative status/scheduling/fulfillment/items/amounts/related work are not changed by this task or identity fix. Screenshot Delivery is observed historical display; Nova relays newer owner Pickup. This task does not resolve the difference or infer an address, recipient or role. No rename, title parsing, note parsing or implicit cleanup.
- Truly absent linkage is honestly indicated; a neutral missing-link cue cannot be represented as completion of company/multiple-contact support. Existing correctly linked customer displays and Job/Rosie routes retain their meaning.

## Independent UI proposal — not the full solution

Current source renders **Unassigned customer** when no structured company/person is available. A bounded copy-only proposal is **Customer not linked** for a known absent-link state, while retaining the exact stored Job title. It describes the missing association without claiming that no customer is known. It must not display the two people, infer a company from the title, hardcode JR-142, or add a link picker backed by an unsupported model.

This is **proposal-only, not routed or implementation-approved** in this task. The current Job presentation collapses a missing customer link and an unresolved customer read into the same nested-null value; a builder must preserve truthful semantics and not claim a confirmed absence from a fetch failure. “Customer link unavailable” or another generic cue may be needed for unresolved cases. Parent may ask Nova for a bounded existing-contract wording correction only if independently supported/approved. Existing CI836/operator composition/release **HOLD** stays in force: no build/deploy exception or unreviewed adoption of current changes. Even delivered copy would not create the requested association.

## Out of scope

- Selecting one of the two people for Rosie, creating/updating customers, linking or renaming JR-142, choosing a recipient, sending, or modifying access in this requirement task.
- General CRM/company hierarchy, bulk migration/backfill/merge, contact deduplication, automatic ownership transfer, a new agent or global naming policy.
- Customer classification/pricing policy (item 6), status/order/fulfillment changes or existing CI836/release-hold relaxation.
- Treating September atomic-Job assumptions as current rename permission, or exposing the private screenshot outside the existing internal evidence boundary.

## Assumptions and limits

- Chris's BOTH instruction and two customer identities are trusted as Rosie's attributed owner report. Lily did not independently query the DB or reread the original Telegram conversation.
- No supported company/multiple-contact relationship was found in the bounded current schema and relevant Job/customer read/display paths. This is not a complete repository/security audit, runtime/deployment proof or claim that no other system can hold contacts.
- Bhoumik owns the smallest supported relationship/routing/privacy contract and implementation choice. This requirement deliberately does not prescribe tables, migrations, a company/person discriminator or a new company-level thread policy.

## Open questions

- **Bhoumik:** Define/approve the focused company-plus-both-contacts association and Order projection/snapshot contract, and authorize its scoped implementation/verified repair before Rosie acts. No supported existing canonical repair was found. No need to ask Chris which contact: that fact is settled. A deliberately incomplete Order is not an authorized diagnostic; a separately approved, truthful document-only representation is existing capacity, not a new workflow or resolution of this staged relationship gap.

## Handoff log

- 2026-10-30 08:44:18 CDT — Staged and crosslinked to company-only identity. Parent confirms delivered Telegram390 escalates urgent missing customer information during Order work; not an actual demonstrated Order-create gate or model/repair approval. Nova’s existing Order trace reused, no supported repair found. Parent owns Bhoumik decision path and confirms its final disposition already delivered to Rosie `jr-142`; task findings delivered to Lily main. Parent additionally confirms the final document-only option and full approval/privacy conditions delivered to Rosie; no further task handoff or human question. No new audit, operational action, Nova UI build route, publication or release-hold exception.

## References

- `company-only-customer-intake.md` — related company identity prerequisite, distinct no-contact scope.
- `job-request-display-identity.md` — September naming provenance caveat; existing Jobs are not renamed by this proposal.
- `workspace/threads/main/tasks/company-only-customer-intake/current-source-2026-10-30.md` — bounded source evidence, privacy and verification limits.

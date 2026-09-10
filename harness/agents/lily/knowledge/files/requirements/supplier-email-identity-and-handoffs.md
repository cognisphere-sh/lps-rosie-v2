# Keep supplier email identity clear while Daisy and Rosie hand work off safely

- Status: staged
- Route: bhoumik
- Raised: 2026-09-03 by Chris (via telegram / Lily task handoff)
- Updated: 2026-09-03

## Problem

Chris uses `chris.r@localplantsupply.com` to build and maintain supplier relationships; Daisy has access to that established supplier-facing identity and Rosie does not. Rosie needs a reliable way to coordinate customer, wholesale, job-request and order work, but sending related supplier messages from several unfamiliar names could confuse suppliers and weaken the relationship Chris has already built.

A live sourcing need crosses the current split. For example, finding current availability of 4-inch live oaks from three suppliers begins with a Job Request but may require the supplier knowledge, established relationship and availability work Daisy holds. Today the boundaries say Rosie owns order-side supplier coordination while Daisy owns supplier lifecycle and availability ingestion, but they do not define the accountable handoff, sender identity or returned evidence for this case. Chris also distinguishes supplier management/grower buying from customer/order management and expects those workflows not to be treated as the same job.

## Evidence

- 2026-09-03 feedback log, **Supplier email identity and handoffs**: Chris said suppliers use `chris.r@localplantsupply.com`; Daisy has access and Rosie does not. He suggested a `sourcing@` identity for Rosie but worries multiple sender names will confuse suppliers.
- Same feedback: Chris used the 4-inch live-oak availability-from-three-suppliers example to propose Rosie handing supplier work to Daisy, with Daisy returning the outcome for Rosie to update the customer/job work.
- 2026-08-28 feedback log, **Supplier type changes the work**: Grower and Wholesale Supplier availability/buying processes differ materially.
- Current agent audit: Daisy’s supplier lifecycle mailbox is `chris.r@localplantsupply.com`; Rosie’s documented order-correspondence mailbox is `chris@localplantsupply.com`, is not signed in, and currently has no access to Daisy’s mailbox. Existing routing defines the ownership line by subject, not supplier party, but not this live-sourcing delegation contract.

## What it should do

Define and approve one durable communication and handoff model before changing mailbox access, addresses, credentials, or agent procedures.

- Keep supplier lifecycle communication under Daisy’s established supplier-facing identity. Lifecycle includes discovery, onboarding, account setup, availability-list relationship, paperwork and supplier-record correction.
- Give Rosie one approved, recognizable identity for customer, wholesale/job-request and order correspondence. Decide whether the proposed `sourcing@` identity replaces, aliases, or is distinct from the currently planned order mailbox; do not activate competing sender identities without that decision.
- Define the supplier-facing identity for a live Job Request availability ask when continuity with an existing supplier relationship matters. The model must say whether Rosie owns the message but Daisy sends it as the established supplier identity, or whether an approved job/order identity sends it directly; a supplier must not receive duplicate or conflicting asks.
- Make a Rosie-to-Daisy sourcing handoff explicit and bounded: it names the Job Request/order context, exact plant/size/quantity, suppliers to check (or selection rule), requested response time and whether outreach is authorized. Daisy returns supplier-specific findings with source, time, availability/price statement and any uncertainty; Rosie keeps the customer/job status and subsequent order/customer communication current.
- Preserve the existing subject-based boundary for ordinary mail, but make mixed emails/tasks split into the lifecycle and job/order portions with one accountable owner for each portion.
- Define distinct operating paths for Growers and Wholesale Suppliers where their availability and buying work truly differs. Classification alone must not silently change communications or purchasing authority.
- Require secure, role-limited credential provisioning for any mailbox an agent can use. Credentials must be supplied through an approved secret mechanism, never chat, workspace, requirements, agent messages or knowledge files. Access is limited to the agent and mail purpose approved in this model.

## Acceptance criteria

- Chris can identify which single sender identity a supplier will see for lifecycle contact and which identity applies to job/order correspondence.
- A 4-inch live-oak request to three suppliers can be handed from Rosie to Daisy with the needed scope and authorization, without Chris manually relaying context or suppliers receiving duplicate/conflicting messages.
- The handoff returns attributable, dated supplier evidence to Rosie, who can update the Job Request/customer workflow without claiming a listing is live availability.
- Daisy and Rosie can route a normal misaddressed or mixed-purpose email/task to the correct owner without either gaining broad access to the other mailbox.
- A Grower and a Wholesale Supplier follow the approved distinct process only where Bhoumik/Chris have defined an actual difference; otherwise the standard handoff and communication rules apply.
- No mailbox credential or secret is present in agent prompts, task notes, feedback/business/requirement documents, chat-derived logs, or inter-agent handoff text; each approved agent has only the mailbox access it needs.
- No new sender address, mailbox access, auto-forwarding, or external message is enabled until the approved model and secure provisioning are in place.

## Out of scope

- Creating a mailbox, alias, forwarding rule, OAuth credential or mailbox configuration.
- Sending supplier/customer email or changing an existing supplier relationship.
- A new supplier portal, public availability-request link, or broader authentication model; those remain under the staged supplier-access requirements.
- Making supplier Type alone an automatic buying rule or granting an agent purchasing authority.
- Creating supplier-specific subagents before a demonstrated workload/quality need and an approved ownership model.

## Assumptions

- Daisy’s existing dedicated supplier-company threads remain the first place for supplier-specific context; they are not automatically separate subagents.
- Rosie remains accountable for customer, Job Request and order state even when Daisy performs an approved supplier-facing sourcing task.
- `chris.r@localplantsupply.com` is the familiar supplier-lifecycle identity today. The proposed `sourcing@` address is an idea, not an approved/active identity.
- A password was exposed in Telegram during this discussion. Its value is intentionally neither reproduced nor retained here; secure credential provisioning and, if applicable, rotation/revocation are for the credential owner to handle.

## Open questions

- **Bhoumik:** Decide the approved outward identity for Rosie’s job/order correspondence: retain the planned `chris@` mailbox, use `sourcing@`, or make one an alias of the other; specify the sender display name suppliers and customers will see.
- **Bhoumik:** Define the accountable sender/owner split for live supplier availability asks attached to a Job Request, including approval gates, duplicate prevention, response correlation and what constitutes a completed Daisy handoff.
- **Chris/Bhoumik:** Define the concrete Grower-versus-Wholesale differences that justify separate sourcing/buying paths, and who can authorize a purchase.
- **Credential owner/Bhoumik:** Confirm secure provisioning, least-privilege access and any needed rotation/revocation after the credential exposure; do not communicate the secret in this requirement or agent channels.

## Handoff log

- 2026-09-03 — staged for Bhoumik as cross-agent workflow, email-identity, access and security-contract work. No mailbox, credential, skill or external-communication change made.
- 2026-09-03 — proposed ownership review only: Daisy would own any approved changes to `supplier-email-routing` and `supplier-communications`; Rosie would own any approved changes to `job-requests`, `supplier-coordination` and `message-routing`. A shared handoff contract may need coordinated skill updates after Bhoumik/Chris approve the model.

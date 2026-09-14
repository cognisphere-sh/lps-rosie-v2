# Save a known customer company before a contact person is known

- Status: staged — Bhoumik decision required; no implementation authorized
- Route: bhoumik
- Raised: 2026-09-11 by Chris (via Rosie; Nova contract-gap handoff)
- Updated: 2026-09-11T13:15:26-05:00

## Problem

Chris has repeatedly supplied **Austin Outdoor Design** as the company for JR-41, with **Wilkinson** as the job and no named contact person. Current supported intake requires a real person before creating a customer, leaving this request unlinked and its company/job facts in notes and a combined title. A known company should not require a fictitious person or another request for facts Chris already supplied.

## Evidence

- Feedback log, **Company known, contact not known**, 2026-09-11: Rosie confirms repeated company-field requests, latest reported at 13:11; at 13:14:53 the customer remained unlinked, with title exactly `Austin Outdoor Design:Wilkinson` and no named contact.
- Nova’s 13:14:40 handoff follows a read-only audit: the documented customer model is person-centric and requires a person name. No supported company-only representation was found; a technical blank-name loophole is not permission. No record was changed.
- Lily checked current schema documentation, original customer contract, Rosie intake/routing instructions and app read/edit/display code. Unknown intake is deliberately retained without a customer link; display composes separately stored facts and cannot recover this company from notes or the mixed title. This establishes a contract gap, not a display-only defect. No independent live database verification was performed.

## What it should do

Accept a customer identified by a **real company, a real person, or both**. Keep company and person separate; an absent person remains absent. At least one meaningful supplied identity is required for a customer record, while an unidentified Job Request may still be retained for later linking.

Make this supported through intake, reading, editing, customer selection and ordinary Rosie coordination-thread linkage. Reuse an existing customer only when the evidence identifies that same customer; shared company wording alone must not merge different people or choose among ambiguous records. A company-only customer must not be shown as unassigned or labelled as a person. Existing valid customers, their linked work and conversations remain intact.

Retain the existing Job-name and display rules: the Job value is the actual job/site only; a composed identity uses known components and omits absent ones. This requirement adds no parsing of old combined titles or notes, no invented contact and no automatic cleanup.

## Acceptance criteria

- **Company only:** Austin Outdoor Design can be saved, selected and linked with no contact person. Reopening shows the real company, no invented contact and no false “Unassigned customer.” With independently verified Job `Wilkinson`, the existing full identity reads `Austin Outdoor Design | Wilkinson`.
- **Person only:** A supplied real person is valid without a company; save/reopen preserves that state without inventing a company or customer type.
- **Both:** Supplied company and real person remain separate, editable facts. Existing valid person/company customers and their links/history are unchanged; no migration guesses missing facts.
- **Neither:** Empty or whitespace-only company/person cannot create a customer or erase its last meaningful identity. Intake preserves an unidentified Job and its source evidence without fabricating a customer.
- No intake/edit path fills the person with the company, a placeholder or a name inferred from an email address, notes or a combined Job title. Customer type remains optional and uninferred; this changes no pricing or status.
- Repeated verified intake reuses the same customer and conversation. Ambiguous matches stop for resolution rather than auto-merge, overwrite a different contact, or silently redirect a Job/customer conversation. A concurrent valid customer link is not overwritten.
- A company-only customer supports the normal stable customer coordination thread, labelled from its known identity, while each Job keeps its separate existing Job thread. Creating/linking does not send a message or establish a recipient; verified contact details and existing send approval remain necessary.
- Adding a subsequently verified person does not silently replace the company, change the Job name, merge another customer, or lose existing links/history. Job-name editing still changes only the actual Job component.

## Out of scope

- A multi-contact CRM, company hierarchy, bulk deduplication or historical title/notes parsing.
- Reopening item 6 (**Homeowner/Retail** versus **Landscape Professional**) or changing pricing, terms, statuses, orders, date/fulfillment or communication authorization.
- A standalone Nova UI build or using display resilience as permission for unsupported data.
- Performing JR-41’s correction in this requirement task. After the contract is supported, **Rosie** owns verified find/create/link and the separately evidenced atomic Job-name correction under authorization. The supplied company/job facts need not be requested again.

## Assumptions

- JR-41 supplies enough evidence to propose the company-only capability; it does not establish an undisclosed person, a customer-type classification or an unambiguous match to an existing customer.
- Unknown email/phone may remain absent; missing contact routes do not justify inventing one.
- This is a small extension of supported customer identity, not a redesign of customer relationships. Display compatibility belongs to its eventual delivery, not a separate UI-first workaround.

## Open questions

- **Bhoumik:** Approve and schedule the company-or-person identity contract and its consistent intake/read/edit/routing support, or keep company-only customer linking blocked? Implementation design is his to choose.

## Handoff log

- 2026-09-11T13:15:26-05:00 — Staged for Bhoumik after Nova’s audit and Rosie’s operational confirmation. Lily main will communicate the decision request and return disposition to Rosie. No Nova implementation handoff, data/code/skill change or external message from this task.

## References

- Task evidence and source pointers: `workspace/threads/main/tasks/company-only-customer-intake/notes.md`.
- Related but separate: `job-request-display-identity.md`; `customer-type-retail-landscape-workflow-pricing.md` (item-6 minimal classification already shipped).

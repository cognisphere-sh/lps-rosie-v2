# Case Study: Local Plant Supply on Cognisphere

Local Plant Supply (LPS) combines a custom operations app with four Cognisphere agents to manage supplier intelligence, plant sourcing, quotes, availability, and orders. Agents perform business tasks, retain context, and help improve the platform itself.

*Repository review: September 30, 2026. Capabilities reflect code, configuration, and documented workflows; scale figures below are historical records, not a fresh production measurement.*

## Situation

Plant suppliers use different names, cultivars, sizes, and list formats. Published prices do not establish current stock, and available plants may differ from the requested size or quantity. Quotes, supplier replies, commitments, and fulfillment dates must stay consistent across conversations.

LPS needed to address five connected business problems:

- **Fragmented supplier information:** availability and pricing arrive through emails, spreadsheets, PDFs, images, and websites, requiring repeated interpretation and data entry.
- **Slow sourcing and quoting:** staff must identify the right plant, reconcile names and sizes, find supported prices, and track alternatives across customer jobs.
- **Coordination gaps:** supplier answers, partial quantities, substitutions, and order commitments can get lost between messages and operational records.
- **Commercial and disclosure errors:** indicative prices can be mistaken for confirmed availability; internal notes and customer details require audience-specific handling.
- **Repeated operational friction:** feedback needs a durable path into procedures, requirements, and verified app improvements.

## Task

Build one workspace that turns unstructured information into catalogue and job records and supports quote-to-order work through direct editing or conversation.

Agents needed clear ownership, persistent context, and approval rules for communications, selections, and commercial commitments. The searchable supplier network supports discovery; current sales procedures default to Austin Plant Supply unless the operator names another supplier.

## Action

### Platform and key features

The app provides multi-location supplier profiles, contacts, plant search, source files, a photo catalogue, customer records, and jobs. Editable desktop tables, focused mobile views, and an installable PWA support office and field use.

Plant search supports aliases, botanical/common names, cultivars, typo tolerance, size-aware ranking, and location filters. Job lines retain original demand alongside selectable supplier candidates.

The workflow connects **Quote → Availability → Committed → Won/Lost**. Supplier orders have a separate **New → Processing → Order Ready** lifecycle. Partner suppliers can answer requests, report partial quantities or substitutions, confirm fulfillment dates, and chat through a company-scoped portal. Public token links support availability requests and order access for suppliers outside that portal. Quantity allocations let an order serve multiple customer jobs.

Embedded agent chat supports files, voice notes, structured questions, entity-specific conversations, and shared transcripts. Supplier submissions and order changes can wake Rosie through application events; live updates keep the workspace aligned with saved data.

### Agent abilities

| Agent | Responsibility and abilities |
|---|---|
| **Daisy — supplier intelligence** | Discovers and onboards suppliers; reads incoming lists; normalizes plant identities and sizes; maintains catalogue prices, aliases, source provenance, and photos; checks ingestion quality; prepares daily summaries. |
| **Rosie — sales and order coordination** | Converts messages, screenshots, and plans into job lines; finds prices; records candidates; generates quotes; coordinates approved availability requests and correspondence; interprets supplier responses; manages customer-committed orders. |
| **Lily — product and business understanding** | Captures feedback, maintains business knowledge, writes requirements and acceptance criteria, and routes improvements. UI work goes to Nova; database and business-workflow changes go to the human developer. Lily operates through Telegram. |
| **Nova — platform engineering** | Changes app code, integrations, agent tools, and deployment scripts; maintains documentation; runs technical checks and required visual release review; can deploy app changes within its assigned authority. |

### High-level technical architecture

| Layer | Implementation |
|---|---|
| **Web application** | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Radix components, and pnpm workspace tooling. |
| **Business data** | Supabase PostgreSQL, database search/RPC functions and transactional workflow operations, object storage, and Supabase Auth with app-owned signed sessions. Server routes enforce admin and supplier access. |
| **Agent runtime** | Cognisphere harness 0.12.0, configured OpenAI Codex models, persistent threads, file-backed knowledge/memory, versioned skills, CLI helpers, and queued events. All four agent configurations currently select `gpt-6.1-sol`. |
| **Integrations** | Google Workspace/Gmail, Telegram, browser chat, scheduling, agent messaging, shareable HTML artifacts, and a custom supplier-events plugin. |
| **Deployment** | Co-located app and localhost-bound harness on a Linux server, exposed through nginx and HTTPS; systemd manages services, with scripted provisioning and S3 backup support. |

Supabase holds authoritative business records. Cognisphere retains knowledge and execution history, with threads scoped to jobs, customers, and suppliers. Browser transcripts are separate from model sessions. Guarded writes, ingestion dry runs, source checks, and QA helpers support reliable execution.

### Novelty of the approach

Specialist agents share an operational app: their output becomes editable business data, and app actions can trigger follow-up work. Context follows business entities across channels; versioned skills preserve procedures and approved feedback.

An improvement loop connects Lily's requirements, Nova's approved software changes, and business agents' procedure updates. Cognisphere supplies the shared runtime, communication, memory, and plugin layer for operations and development.

## Result

Supplier lists become searchable records, customer requests become jobs with supported prices, supplier responses feed availability work, and committed purchases become tracked orders. This supports less repetitive entry, faster preparation, clearer follow-up, and consistent handling of plant identity, quantities, and approvals.

### Evidence of scale

- **Supplier footprint:** an August 23 migration records **1,395 supplier/location rows and 1,335 company threads**.
- **Catalogue footprint:** a cleanup on the same date covered **48,771 inventory rows containing notes**, establishing a catalogue in the tens of thousands; this is not a current total inventory count.
- **Operational activity:** Daisy's September 22–29 audit covered **158 threads and about 80 supplier emails**. Rosie's September 21–28 audit recorded **173 operator messages and 63 supplier portal events**.
- **Configured concurrency:** Daisy and Rosie each allow **10 concurrent slots**; Lily and Nova each allow **5**. Pagination, indexed database search, debouncing, and batched reads support bounded data access. These settings do not establish measured throughput or horizontal scaling.

The evidence establishes operational use, not quantified revenue growth, labor savings, or guaranteed turnaround times. Audits identified excessive delegation and context costs, prompting simpler routing and helper-based workflows; subsequent savings remain unmeasured.

LPS illustrates Cognisphere's ability to support a persistent agent team working alongside people from intake through fulfillment, with a controlled path for ongoing improvement.

**Evidence:** [app documentation](docs/app/README.md), [agent roles and workflows](docs/harness/README.md), [agent configurations](harness/agents/), [database schema](docs/supabase-schema.md), [migration records](docs/harness/daisy-migrations.md), and the [Daisy](docs/harness/daisy-audit-2026-09-29.md) / [Rosie](docs/harness/rosie-audit-2026-09-28.md) operational audits.

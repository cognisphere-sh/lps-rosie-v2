# job-requests — changelog

## 1.10.0

2026-08-19, from Bhoumik. **A sourcing-notes supplier line names what was
priced before the price, and says outright when it is a substitute.** New §4.1
gives the one shape every line follows:

```
<Supplier>: [Substitute: ]<the row they have> @ $<price>/unit[, <facts>]
```

`APS: $175/unit, Dwarf Sabal Minor/Silver Palmetto 15 G` made a reader work out
which half was the offer, and marked a swap — when it was one — with a trailing
`alternative` that is easy to miss at the end of ten lines. `APS: Dwarf Sabal
Minor/Silver Palmetto 15 G @ $175/unit` and `APS: Substitute: Thryallis 3 G @
$23/unit` read in the order the fact is thought, and the swap is the second
word of the line.

The catalogue row is named whenever its wording differs from the ask; when it
is word for word the ask the price alone carries it (`APS: $7/unit`). Naming it
is not restating the ask — it is *which row we priced*, which no column holds.
Nothing to price keeps its `@`-less form (`APS: no 30 G`), and so does a row
with no price on file.

`Substitute:` is the same test as the existing `external_notes` rule: the
prefix, a `Quoted for <offering>.` note and `alternative_proposed` are written
in the same task, and a catalogue that merely words the same plant differently
earns none of the three.

Every example in the skill moves to the new shape — §2's `E'…'` newline pair,
§4's sourcing sheet, §5.1's two blocks, §6's — and §5 rung 2, rung 3 and §5.2's
hand-back from daisy point at §4.1. §6's stray `30 gal` becomes `30 G` in the
same pass.


## 1.9.0

2026-08-18, from Bhoumik. Customer-facing substitution notes use `Quoted for
<offering>.`, and appear only when the offered plant or size differs from the
ask. A catalogue naming difference alone does not earn an `external_notes`
line.


## 1.8.0

2026-08-18, from Bhoumik. Normalize gallon notation in every
`job_request_items.size` value to `G` (`3 G`, never `3 gal`), including intake
and examples. This makes the job-request table agree with the inventory and
customer quote convention.


## 1.7.0

2026-08-18, from Bhoumik. **`unit_price` is an Austin Plant Supply price.** The
ladder already sent rung-3 lines to other suppliers; now what comes back stays
in `sourcing_notes` — supplier named, price included — and `unit_price` stays
NULL. §5 rung 3, §5.1 (new opening rule and a second note example) and §5.2's
hand-back from daisy all say the same thing: the column is theirs, the note
carries everyone else's.

The exception is the one that already existed. When Chris or the customer names
another supplier for the line (§5), that price goes in the column, and the note
says whose instruction put it there.

Why: the price column is read as one number in one currency of trust — what the
house yard charges. A rung-3 price silently sitting in it makes a quote out of a
lead, and Chris is the one who decides a line is worth buying in. Until he does,
the finding is a finding.

The description is rewritten short in the same bump — what the skill covers, in
a clause, plus when to use it. It had grown into a summary of the procedure and
was one edit away from pi's 1024-character cap.

## 1.6.0

2026-08-18, with migration 0061. Two changes from Chris.

**`internal_notes` is `sourcing_notes`.** Renamed on both job-request tables,
and throughout: the SQL patterns in §2, the notes table and both halves of §4,
the ladder in §5, the statuses in §6. ("Internal" said who may read it, which
the other two note columns already imply by contrast. The new name says what
goes in it.) `inventory.internal_notes` is daisy's and keeps its name.

**A customer-facing note names the change and stops.** §4's customer-visibility
rule no longer asks for an explanation: `external_notes` says what the customer
is being offered ("Substituting 3 G for the 5 G requested"), and the reason —
a price we don't hold, a grower who is out — stays a `sourcing_notes` line. A
note that argues its case invites a negotiation about the case. Sizes in either
note column are written `XX G`, the way the inventory prints them; only the
item's own `size` keeps the customer's verbatim wording. §5 and §6 follow.

## 1.5.1

2026-08-18. §2 spells out that a newline in psql is `E'…\n…'` — a plain
single-quoted `\n` stores a backslash and an `n`, which is how eleven item
notes came to read `APS: $23/unit, 3 G alternative\nVerde River: 5 G` on one
line in the app. One line per supplier only works if the breaks are real. The
three affected rows were repaired in place.

## 1.5.0

2026-08-18, with migration 0060. **`needs_attention` is gone** — the column is
dropped from both tables, the app's badges, filter and flag buttons are
removed, and §6 goes with them (Statuses and Contacting the customer renumber
to §6 and §7).

It was the weaker of two ways to say "a person has to look at this". The other
is `status`, which says it in a more specific word: `alternative_proposed` is a
substitution waiting on approval, `unavailable` is a line somebody must decide
about, `pending` is one nobody has answered. Only `available` needs no one — so
once the app derived its "Needs input" surface that way, the flag was marking
nearly every row, which marks nothing.

What replaces it, and was always the better record: the **status** for where a
line stands, and **`internal_notes`** for why. Where §5 used to say "set the
flag and let Chris pick", it now says the line keeps a status that says a
decision is open, with both options on its supplier lines.

## 1.4.0

2026-08-18, with migration 0059 and the matching app change. Three things from
Chris, all about what a note is for.

**`internal_notes` is free text, edited in place — not an append-only log.**
§2's fourth rule now splits the two columns that used to share one discipline:
`internal_notes` is a working sheet rewritten as things change (read it and
write it back in the same breath, keeping the lines you didn't come to change),
while `customers.communication_notes` stays append-only, stamped and signed,
because a contact happened at a time. The stamp-and-signature format added in
1.3.0 therefore applies to the contact log only — a supplier line that gets
rewritten can't carry an honest timestamp, and the changelog already holds who
changed what, when.

**Notes are terse.** §4 rewrites the item's sourcing sheet as a line per
supplier — `APS: $26/unit, availability requested` — with `APS` for Austin
Plant Supply, `$N/unit` for price, the line *updated* rather than added to, and
free text welcome for anything that isn't about a supplier. The request's own
`internal_notes` is now explicitly job-level only: what changed about the order
("Delivery date 8/22 → 8/29"), never a line's sourcing detail. Every example in
§5, §6 and §7 was rewritten this way.

**Requests get a name.** Intake now writes `job_requests.name` (migration
0059): what the job is called out loud, the site or project if the customer
named one, a few words otherwise — not the customer, not the id, and NULL
rather than an invented label.

## 1.3.0

2026-08-18. Two policy changes from Chris.

**Austin Plant Supply is the default source.** §5 is rewritten as a ladder:
price the line from Austin Plant Supply (`suppliers.id = 1`) — their catalogue
is in the database, so rosie looks it up herself; if they don't have the ask,
recommend their closest alternative; only when they can't cover it does the
line go to other suppliers, and then `internal_notes` must say why it left
Austin Plant Supply and whose price it now carries. Chris or the customer
naming (or excluding) a supplier overrides the ladder, recorded with who said
it. When an Austin substitute and another supplier's exact ask both exist,
both are recorded and `needs_attention` lets Chris pick. Asking daisy (§5.2) is
now explicitly the rung-3 step rather than the first move.

**Pricing writes one column.** New §5.1: `unit_price` only, from the row
sourced. `available_quantity` is never written by rosie — supply is settled by
people in the app — and `total` stays generated, `quantity * unit_price`, i.e.
the customer's *asked* quantity at our price. A `0` in an inventory row is not
a price.

**Notes are signed as well as stamped.** §2's entry format becomes
`[<stamp>] <Name>: <text>`, with a table of who a name means: `Rosie` for her
own work, `Chris`/`Bhoumik` for what they decided, `Daisy` for what came back
from her. Every example in §4, §5, §6 and §7 was rewritten in the new format.
Notes the app writes carry no name (it has no signed-in user); hers always do.

**needs_attention, against what the app now derives.** §6 states that the app
shows *Needs input* on any line whose status is not `available`, so a line off
rung 1 is already in front of the team; the column is for what the status
doesn't say — a choice only Chris can make, a price over budget, an ask that
couldn't be parsed.

The frontmatter description was tightened while being updated: it had been over
the 1024-character limit `create-skill` states since 1.1.0, and now fits.

## 1.2.0

2026-08-18, with migration 0058. `job_request_items.status` narrows from seven
words to four: `pending → available | alternative_proposed | unavailable`.
`sourcing` is gone because it described an activity rather than a state, and
the activity is already in `internal_notes` in more useful detail — §7 now says
so outright and shows the log entries that replace it. `confirmed` and
`cancelled` are gone: acceptance is a note plus `job_requests.status =
'closed_won'`, a dropped line is `unavailable` with the reason in the notes,
and a line entered in error is deactivated rather than statused.

## 1.1.0

2026-08-18. §4 now states what `customer_notes` is *for*: the remainder of what
a customer said, never a transcript. Everything a structured column already
holds — plant, size, quantity, address, identity — belongs in that column and
only there; the note column carries constraints, preferences, deadlines and
reasons that have nowhere else to live. Added a where-it-goes table, the rule
that restating the ask adds nothing, and the observation that a note
duplicating a column means the column was filled wrong. Intake step 3 now
points at the rule. Written alongside the app change that surfaces an item's
note as a sub-line under its name.

## 1.0.0

2026-08-17, with migration 0055 (which created `customers`, `job_requests`,
`job_request_items` and `job_request_changelog`). Initial version, written
alongside the rosie agent itself: intake incl. anonymous requests, the
concurrency discipline for UI-shared tables, the last-5-changelog fetch rule,
the three-notes split with the customer-visibility rule for quantity changes
and substitutions, sourcing via daisy by agent-message, `needs_attention`
conventions, both status lifecycles, and the Chris-approved customer-contact
flow.

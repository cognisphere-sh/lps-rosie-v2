# Active jobs sidebar search

The Active jobs sidebar has an accessible search field for job names, JR
references, customer names and companies, plant names and sizes, and all three
job/plant note fields (customer, sourcing and notes for customer). Matching ignores
case and surrounding whitespace; every search word must occur somewhere in the
job's searchable fields. The full notes remain in the job rather than appearing
in search results.

Each sidebar card shows its JR reference, job name, customer identity and sales
status, with a small dot for unread web chat. Its footer shows **Created** and
**EDD** as `MM-DD`; EDD comes from `job_requests.expected_install_date`, and
missing dates show `—`. Creation timestamps use America/Chicago; install dates
keep their saved calendar day. Chat preview text, unread badge prose and
activity timestamp lines are omitted from the cards. Their accessible names
include the displayed dates and unread state.

Search runs immediately over the complete active inbox returned by the
admin-only `/api/job-inbox` endpoint. The server builds each job's searchable
text from its current fields and all active items, fetching items in bounded
job-ID batches and paging past the 1,000-row database response limit. It does
not search chat transcripts, inactive items or closed jobs. The inbox's
explicit 5,000-active-job limit still reports an error rather than silently
returning a partial result set. Typing needs no extra requests.

Results retain the inbox's existing activity order and selected-job marker.
Filtering, no matches and clearing the field never select or close a job in
the work pane. The field reports the match count and offers a named Clear job
search button that returns focus to the field. Search and current selection
survive sidebar collapse/expansion and job switching within the workspace.
An empty query restores every active job; no matches has its own empty state.
Initial loading and API errors retain their existing loading/retry states.

Live job/item/customer updates refresh the complete inbox and recompute the
current search without moving focus or resetting the query. Chat unread/activity
patches still update and reorder the underlying complete set, including jobs
currently hidden by the search. The search lives in the desktop sidebar; the
mobile focused Job keeps its existing layout.

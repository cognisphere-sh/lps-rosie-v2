# Availability request header metadata

The admin availability drawer, supplier-profile detail, and supplier/public
request header place Created on and each linked job's EDD/Fulfillment pair
inline in the existing header row, wrapping when space is limited. EDD is the
display label for Expected install date; the data field and editor retain the
full name. Fulfillment shows Pickup or Delivery. Missing values render as a dash.
Dates use `MM-DD`; timestamps use America/Chicago and date-only install dates
retain their calendar day.

Combined availability requests retain a separate install-date/fulfillment pair
for every linked job. The admin drawer labels these schedules with the job name
or JR reference. Supplier and public schedule payloads omit job identifiers and
names, and their headers use Job 1, Job 2, etc. Existing customer and shipping
disclosure rules still apply; combining jobs never discloses a single job's
customer or shipping details as though they applied to the whole request.

Job-card availability links receive both creation and submission timestamps.
Each caption is a bare MM-DD: the submission date for current submitted requests
and the creation date otherwise, even when a previous submission timestamp
remains on a reopened or processing request. Each AR tag's full background and
text follow its current status: yellow (the existing amber token) for new and
processing, green for submitted, and gray for closed or unknown stages. New and
processing requests retain their yellow dot; submitted requests retain their
green dot. Closed and unknown stages have no dot.
The drawer sends the confirmed submission timestamp with its status event, so
first submissions and same-status resubmissions refresh the link's date
immediately. Older status-only events preserve the saved timestamp.

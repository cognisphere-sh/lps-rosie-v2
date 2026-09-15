# Availability request header metadata

The admin availability drawer, supplier-profile detail, and supplier/public
request header place Created on and each linked job's EDD/Fulfillment pair
inline in the existing header row, wrapping when space is limited. EDD is the
customer's expected delivery or installation date, stored in the existing
`expected_install_date` field. It remains editable on the job. Fulfillment here
shows the Pickup or Delivery method; job and availability requests have no
fulfillment-date field. Only orders record a supplier's committed fulfillment
date, separately from EDD. Missing values render as a dash.
Dates use `MM-DD`; timestamps use America/Chicago and date-only install dates
retain their calendar day.

Active partner request rows and archived cards also show Created, EDD and a
Pickup/Delivery tag using the same linked-job schedules. Request and plant notes
wrap on desktop in request lists, line tables, By item and By status views.
Desktop note editors are multiline and size to their contents so longer notes
use the available row space.

Combined availability requests retain a separate EDD/pickup-or-delivery pair
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

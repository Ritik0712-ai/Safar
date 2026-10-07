# Cab Booking Complete App Flows

Version 1.0 · 7 October 2026 · Build against [PRD](01-product-requirements.md), [API contracts](02-technical-requirements.md), and [schema](05-backend-schema.md)

## Scope and global behavior

This is the exhaustive V1 screen and interaction inventory. Features excluded by the PRD have no navigation or teaser controls. All buttons below must execute their described action. API names refer to document 02. Preserve committed state across reload; do not use local component state as the source of a booked ride or payment.

Each protected screen starts with a skeleton while identity and own account resolve. Anonymous visitors go to `/sign-in?next=<encoded-relative-route>`. Accept `next` only for allowlisted same-origin protected routes; reject absolute URLs. After authentication, require onboarding then email verification before privileged actions. Wrong-role visitors get an accessible "This workspace is unavailable for your account" page with **Go to my dashboard**, never automatic privilege assignment. Inaccessible record IDs render generic not found, not another person's details.

Global request state: disable the triggering control and show its loading label; keep input data; retain idempotency key until outcome known. On timeout refresh canonical state before repeating a mutation. Inline field errors focus the first invalid field. Global errors show a request ID and **Retry**; no raw stack traces. All API 401 responses clear session and redirect to sign-in while retaining a safe return path. 403 explains permission without leaking private records. 409 refreshes the affected resource and explains its new state. 429 shows cooldown/retry time. Provider failure never yields a fake success.

Network offline: banner "You're offline. Reconnect to continue." Cached text/map may remain with stale label; disable booking, acceptance, trip transitions and payment initiation. **Retry connection** refreshes own state. Location freshness is independent from network state. At >15 seconds show "Location last updated …" and a stale marker; at >60 seconds show tracking unavailable. Do not animate interpolation past the last actual point. Closed or backgrounded browser may pause GPS; never promise background tracking.

Browser Back may leave a tracker but never cancels a ride. Back during checkout returns to the completed-trip payment screen. Reload resumes the server's current stage. No destructive operation happens because a route loads. All successful mutations receive a short screen-reader announcement. Toasts supplement, not replace, persistent state.

## Route and navigation inventory

| Route | Screen | Access | Primary exits |
|---|---|---|---|
| `/` | Landing | Public | Sign in, passenger signup, driver signup |
| `/sign-in` | Login | Public | Role-aware dashboard, password recovery |
| `/sign-up` | Registration | Public | Onboarding, existing login |
| `/forgot-password` | Reset request | Public | Login, Firebase action |
| `/auth/action` | Verify/reset action | Public token action | Verify email or set new password, sign in |
| `/onboarding` | Name/phone and intent | Auth | Verification, passenger home, driver application |
| `/verify-email` | Verification gate | Auth | Resend, refresh verification, logout |
| `/privacy`, `/terms` | Demo data and use notices | Public | Return to prior route |
| `/rider` | Booking dashboard | Passenger | Review, active trip, history, profile, help |
| `/rider/review` | Quote review | Passenger | Request ride, edit locations |
| `/rider/rides/[rideId]` | Lifecycle tracker/detail | Own passenger | Payment, rating, history, support |
| `/rider/rides/[rideId]/payment` | Fare/payment | Own passenger | Provider checkout, receipt, support |
| `/rider/rides/[rideId]/receipt` | Receipt view | Own passenger paid ride | Download PDF, rate, history |
| `/rider/rides/[rideId]/rate` | Rating form | Own passenger completed ride | Save, skip, detail |
| `/rider/history` | Ride history | Passenger | Own ride detail |
| `/rider/profile` | Profile/settings | Passenger | Save, password reset, role switch, logout |
| `/rider/help` | Help categories | Passenger | New ticket, ticket list |
| `/rider/help/new` | Ticket form | Passenger | Submitted ticket |
| `/rider/help/tickets` | Own support list | Passenger | New ticket, ticket detail |
| `/rider/help/tickets/[ticketId]` | Own support thread | Owner | Reply, reopen, list |
| `/driver/application` | Vehicle/application form | Driver | Pending screen or dashboard |
| `/driver/application/status` | Pending/rejected application | Driver | Refresh, edit/resubmit, help |
| `/driver` | Availability and offers | Driver approved | Trip, history, earnings, profile, help |
| `/driver/rides/[rideId]` | Driver trip/detail | Assigned driver | Advance trip, history, help |
| `/driver/history` | Driver ride history | Driver | Own detail |
| `/driver/earnings` | Simulated earnings | Driver | Paid trip detail, ledger pagination |
| `/driver/profile` | Driver/profile settings | Driver | Profile save, vehicle reapplication, role switch, logout |
| `/driver/help`, `/driver/help/new`, `/driver/help/tickets`, `/driver/help/tickets/[ticketId]` | Same support pattern in driver shell | Driver/owner | Corresponding driver support routes |
| `/admin` | Operations overview | Admin | Driver queue, ride queue, support queue |
| `/admin/drivers` | Application queue | Admin | Driver review |
| `/admin/drivers/[uid]` | Application review | Admin | Decision, queue |
| `/admin/rides` | Ride attention list | Admin | Ride inspection |
| `/admin/rides/[rideId]` | Read-only ride/payment inspection | Admin | Reconcile, associated support |
| `/admin/support` | Support queue | Admin | Ticket thread |
| `/admin/support/[ticketId]` | Support response | Admin | Reply, resolve, reopen |
| `/admin/demo` | Controlled demo tools | Admin + demo env | Explicit safe reset |
| unmatched route | Not found | All | Role-aware home |

Passenger mobile navigation: **Book**, **Activity**, **Help**, **Profile**. Driver: **Drive**, **Activity**, **Earnings**, **Profile**, with Help in header/profile. Admin: **Overview**, **Drivers**, **Rides**, **Support**, plus Demo only in enabled environment. Desktop uses the same destinations in sidebar. Brand link opens the current role dashboard; public brand opens `/`. Workspace switch appears only for existing capabilities; switch does not create roles. Active-trip banner remains visible on history/help/profile pages.

## Public and authentication screens

### S01 Landing

Show product purpose, controlled-demo disclosure, supported service area, a map illustration/real area preview without invented live drivers, and a concise explanation of booking. **Book a ride** → signup with passenger intent; **Drive with us** → signup with driver intent; **Sign in** → login. Signed-in users clicking either intent use their existing capability; missing driver capability opens an explicit driver application entry, never grants approval. Footer **Privacy** and **Terms** open notices. Public map tile failure shows a neutral service-area graphic and does not block auth. No fabricated reviews or usage counts.

### S02 Sign in

Email, password with **Show/Hide**, **Sign in**, **Continue with Google**, **Forgot password**, and **Create account**. Submit validates fields, executes Firebase sign-in, exchanges session, fetches `/me`, then sends admin to `/admin`, driver-only intent to `/driver` or application/status, otherwise `/rider`; safe `next` takes priority if permitted. Existing active trip takes priority over booking home. Email account not verified → `/verify-email`. Google popup blocked → offer supported redirect flow; user-closed popup restores controls without failure toast. Invalid credentials use generic message; disabled account shows support guidance. No account discovery through errors.

### S03 Sign up

Intent passenger/driver selected from entry link; editable two-option selector before submitting. Name, email, password, confirm password, phone optional here but required on onboarding, and acknowledgment of demo terms. Password minimum 10 characters; strength guidance; confirm must match. **Create account** creates Firebase identity and sends verification mail. If phone is present, complete onboarding with intent/terms and open verification; otherwise open onboarding first. If profile API fails after identity exists, retain login and resume onboarding; never create a second identity. **Continue with Google** authenticates then opens onboarding if required data/terms are missing. **Already have an account** → login preserving safe intent. Existing email → suggest sign-in/reset without automatic provider linking.

### S04 Onboarding

Name 2–80 chars; Indian mobile as +91 plus ten digits (starts 6–9); passenger/driver intent; required acknowledgment of current demo terms; explain driver requires approval. **Continue** saves through own onboarding API. Passenger → email gate or rider dashboard. Driver → email gate or vehicle application. Intent never grants administrator. Empty form shows labels and examples, not fake personal details. Save failure retains inputs. After onboarding driver capability includes passenger capability so later role switch works.

### S05 Email verification

Display user's masked email, **Resend verification email** with 60-second cooldown, **I've verified my email** reloads Firebase user, force-refreshes token, updates session and opens intended workspace only when verified. **Use another account** signs out then login. Unauthorized/expired action → request a new link. No "verified" success based solely on pressing the button.

### S06 Password reset and Firebase action

Forgot-password form: email, **Send reset link**, **Back to sign in**. Success always says "If an account exists, you'll receive a reset link." Reset action screen validates Firebase action code before new-password fields; **Save password** applies provider reset, confirms, routes to login. Invalid/expired code → **Request another link**. Verify action screen applies verify code and says **Continue to sign in** or **Return to verification** if already authenticated. Unknown action mode → invalid-link screen. Do not log action codes or preserve them in analytics. Password change in profile uses reset email; no custom password database.

### S07 Notices

State test-payment status, foreground location collection, access limited to involved users/admin for support, retention defaults in schema, no emergency service, and how to contact support for account/data concerns. Text is a plain project notice; do not present an unreviewed template as a production legal agreement. **Back** uses same-origin previous route or landing fallback.

## Passenger booking and trip screens

### S08 Booking dashboard

Split map and booking panel. Panel contains pickup, destination, **Use my location**, pin-selection affordances, **Swap locations**, and **Get fare**. Economy is the only visible ride option with four-passenger capacity, not an inactive category carousel. On existing unsettled ride replace form with **Continue ride** or **Complete payment**; never allow a second request.

Location search starts after three characters and 350 ms debounce. Cancel earlier requests when query changes; latest request wins. Arrow keys navigate suggestions, Enter selects, Escape closes. Selecting suggestion stores label, coordinate and provider place ID. Editing selected text clears coordinate selection and quote; **Get fare** disabled until two valid distinct points exist. No results → "No places found. Try a landmark or choose a point on the map." Search failure → retry and pin fallback. Search quota exhausted → inline temporary failure; manual pin can select coordinates but road quote still requires routing.

**Use my location** requests browser permission only on action, reads coordinates, reverse geocodes pickup, and retains any existing destination. Denied/unsupported/inaccurate fix (>100 m) → manual search/pin guidance. Allow user to accept an approximate GPS position explicitly; label accuracy before selecting. Map pin editing opens S09. **Swap locations** swaps complete place objects and invalidates quote. **Get fare** calls quotes API; success navigates `/rider/review?quote=<id>`; route failure retains points and displays **Try again**. Identical locations or <200 m straight-line separation → field error. Endpoints outside service area → explain area and allow edit. Skeleton for map loading; tile error retains usable form and shows map retry. Do not block accessible text entry because tiles fail.

### S09 Location picker modal or mobile sheet

Title **Choose pickup** or **Choose destination**; center crosshair with draggable map, label preview, **Use this location**, **Cancel**, search control. Moving map debounces reverse lookup 600 ms. Failed label lookup displays coordinates and "Address unavailable" but valid coordinates may be selected. **Use this location** writes Place object, closes, returns focus to the originating field and clears quote. **Cancel**, Escape or close button discards unconfirmed pin, preserving previous selected point. Both coordinate bounds and service-area constraint enforced before confirming. Provide search alternative for keyboard users unable to pan the map.

### S10 Quote review

Show pickup/destination, road polyline, distance, estimated duration (not traffic-aware), Economy, ₹ fare and breakdown, free pre-start cancellation, quote-expiry countdown, and test-payment note. **Edit locations** → home with selected points restored. **Request Economy** calls rides API with quoteId/idempotency key; success navigates tracker even if dispatch is still retrying. No driver candidate is not an immediate booking error: show searching until deadline. Expired quote disables request and shows **Refresh fare**; refresh may change price, requires explicit re-confirmation. Price/network/conflict error retains screen. Reload fetches owned quote; unknown/unowned quote → booking home with "Please get a new fare." No client-invented route on provider outage.

### S11 Searching tracker

Show route, fixed fare, "Finding a driver", server-based remaining time and **Cancel request**. Explain tracking will start after acceptance. Subscribe to own ride; refresh at ten seconds while foreground to normalize deadline/materialize dispatch. Acceptance switches same route to assigned state, no new booking. Dispatch pending/error shows "Request saved. Connecting to drivers…" with **Retry connection**, same ride ID; cancel remains available. Expiry → S15. No animations imply actual drivers are approaching before assignment.

### S12 Assigned and arrived tracker

Show driver display name/initials, rating or "New driver", vehicle make/model/color/plate, locked fare, driver marker, latest update time, and pickup. Driver contact is not exposed as a call button in V1. Assigned copy **Driver is on the way**; arrived copy **Your driver has arrived**. Show trip PIN in a discreet card with **Show/Hide PIN** (fetch via own endpoint); keep hidden until requested, never in URL. State "Share this PIN only when you are ready to start." No copying PIN to clipboard by default.

**Cancel ride** opens S16. **Get help** opens new ticket prefilled with own ride association. Assigned location unavailable shows persistent last-update status, driver identity still visible, **Refresh tracking** calls refresh/repair, not a booking retry. Driver cancellation → cancelled state with reason, **Book again**. Arrival notification comes from state listener and remains a visible state, not toast-only. Driver pickup ETA, if shown, comes from a bounded routing request refreshed at most every 60 seconds; no ETA until an actual route response; caption "Estimated, without live traffic".

### S13 In-progress tracker

Show **Ride in progress**, destination, route, driver identity, fixed fare and latest location time. Remove cancel action and PIN display. **Get help** opens support form; explicitly say support is not an emergency service. Browser back leaves ride active. Completion listener opens payment screen once; subsequent reload resumes payment from lock. Lost GPS pauses marker but does not stop trip or change fare. No driver movement simulation in non-demo environment.

### S14 Completed ride detail

Show completion time, route labels, fixed final fare, driver/vehicle, payment status, optional rating status. Pending/failed → **Pay ₹amount**; processing → **Check payment status**; paid → **View receipt**. review_required without captured payment → **Get help**, checkout disabled; review_required with an existing captured payment → **View receipt** plus investigation banner, no extra payment requested and no new passenger lock. **Rate driver** if not reviewed; **View my rating** if reviewed; **Get help**; **Back to activity**. Completed unpaid record appears in history and maintains passenger lock. Cancelled/expired records have no payment or review control. Driver receipt view uses its own workspace rather than redirecting into passenger pages.

### S15 Expired or cancelled request

Expired: "No driver accepted this request"; preserve endpoints, no charge, **Try again** obtains new quote, **Change locations** opens booking. Cancelled: show actor/reason, zero cancellation fee, **Book again** obtains new quote, **View activity**. No silent resubmission and no reused expired quote. Driver cancellation must not say the passenger cancelled. No-driver empty state is distinct from map/provider failure.

### S16 Cancel confirmation dialog

Title **Cancel this ride?**, explanatory zero-fee text, reason selector (plans_changed, wrong_location, taking_too_long, other) and optional note ≤300 characters; **Keep ride** closes, **Confirm cancellation** performs guarded mutation. Focus initially on Keep ride. If driver starts concurrently, 409 refreshes to in-progress and states cancellation is no longer available. If accepted while searching, same confirmation can cancel assigned if still pre-start. Loading prevents duplicate clicks. Success shows S15, not landing. Error keeps dialog open with retry and unchanged fare.

## Payment, receipt, rating and history

### S17 Payment screen and provider checkout

Show completed ride, final fixed fare, mode label **Test payment — no real money**, and breakdown. **Pay ₹amount** creates/reuses server order and loads Razorpay Checkout with provider-supported methods; do not promise methods that the actual test account does not enable. Checkout loading failure → **Try opening checkout again**, same order. Checkout dismissal → unpaid screen "Payment wasn't completed"; failed provider payment → specific safe failure and **Retry payment**. Do not infer paid from UI success callback.

On callback, show **Verifying payment…** while server verifies and confirms capture. Verified capture → S18. Authorized/not captured → **Payment processing**, poll payment-status every five seconds for 30 seconds, then offer **Check status** and **Get help**. Browser can navigate away; return reconciles. Verification/network error → "We couldn't confirm payment yet. Check its status before retrying." Pending ambiguity/review_required disables new checkout; **Get help** and request ID available. Captured webhook arriving after failure refreshes screen to paid. Paid route revisit immediately offers receipt, never opens checkout again.

### S18 Receipt

Show **Test payment verified**, ride ID, receipt number, passenger/driver names, vehicle, pickup/destination labels, quoted distance/duration, completion time, INR amount, provider payment ID/masked display and **Not a tax invoice**. **Download receipt** requests server PDF and downloads `cab-booking-<receipt-number>.pdf`; show progress, retry if unavailable. **Rate driver** → rating form if missing. **Back to activity** → history. **Book another ride** → home after lock released. Generating PDF failure does not reverse paid state; support option remains. Unpaid direct URL redirects payment with explanation.

### S19 Rating

Five radio-like star buttons with accessible labels **1 star**…**5 stars**, optional feedback textarea max 500, **Submit rating**, **Skip for now**. Submit disabled without selected star. Success saves one review and returns completed detail with visible rating; duplicate conflict loads existing review. **Skip** returns detail without marking reviewed. Existing review shows immutable submitted rating, no Edit control. Incomplete/cancelled ride direct route → own detail with explanation. Empty optional comment accepted.

### S20 Passenger activity

Tabs **All**, **Completed**, **Cancelled** (cancelled tab includes expired with its own label). Rows show endpoints, date, fare only if applicable, ride/payment badge; each entire row and **View ride** opens detail. **Load more** advances signed cursor; no infinite-scroll requirement. Empty All → "Your rides will appear here" and **Book a ride**; empty filter → **Show all rides**. Loading uses skeleton rows; page failure preserves previously loaded rows and shows retry footer. Returning to booking never replays an old request. Date groups use Asia/Kolkata.

### S21 Passenger profile

Name, phone, read-only email and verification indicator. **Save changes** enabled when valid dirty fields; success updates own profile, not snapshots of past rides. **Reset password** sends provider email after reauthentication if required; hide for Google-only accounts or explain provider management. **Become a driver** explicitly adds driver draft capability and opens application; never approval. **Switch to driver** only existing capability. **Help**, notices, **Sign out**. No avatar upload, saved cards, wallet, or account-delete button. Account/data deletion concerns route support. Unsaved navigation opens **Discard changes / Stay** dialog. Passenger logout does not cancel their trip; returning resumes it.

## Driver screens

### S22 Application form

Fields driver name/phone, vehicle plate, make, model, color, seats (4 only in V1), and acknowledgment that approval is for this controlled demo, not transport KYC. **Submit for review** validates and saves pending driver+vehicle version; opens status. **Save draft** stores draft without approval; explicit own application API supports draft intent. No license/document upload. Rejected application **Edit and resubmit** restores fields/reason; editing approved vehicle opens warning that it goes offline and awaits reapproval. Active ride blocks vehicle changes. Duplicate plate returns field conflict, no ownership transfer.

### S23 Application status

Pending: submitted date, vehicle summary, **Refresh status**, **Edit application**, **Get help**, **Switch to passenger**. No driving control. Rejected: reviewer reason, **Edit and resubmit**. Approved: **Open driver dashboard**. Suspended: reason, **Contact support**, passenger switch; no self-reactivation. Refresh failure retains last state labelled timestamp. Empty application → form. Pending edit changes version and resubmits so stale admin review cannot approve old vehicle details.

### S24 Driver dashboard

Show online/offline status, active ride if any, map of own location, request cards, today's completed trips and simulated captured earnings from records. **Go online** requires verified email, approved driver/vehicle, no active ride, browser location consent/fresh fix and server availability confirmation. Denied GPS → manual permission guidance; cannot go online with arbitrary typed coordinates. **Go offline** stops receiving offers and location matching, retains active trip tracking if one exists; active trip UI always has **Continue trip**.

No open offers → "You're online. Waiting for ride requests" or offline **Go online** prompt. Offer card: pickup/destination labels, fare, quoted distance/duration, pickup approximate distance, expiration, **Accept**, **Decline**. **Accept** disables card, calls claim; success opens driver trip; 409 removes unavailable card and says another driver accepted. Expired offer removes controls; decline hides only own offer. Going offline invalidates accept even if stale card remains. No new offer appears during active ride. Do not list unrelated passengers or all requests.

Demo-only card for allowlisted driver: **Use demo location** enables explicit simulation at configured point; banner **Simulated location** remains in both driver and passenger trackers. **Move along route** starts/stops a bounded foreground simulation after assignment; never advances trip status. **Stop simulation** freezes location with stale state; no hidden auto-completion. Production renders no demo controls and rejects simulated writes.

### S25 Assigned driver trip

Show pickup, destination, passenger first/display name, fixed fare, current stage and map. **I've arrived** opens **Confirm arrival / Not yet** then performs assigned → arrived; button used while stationary, no geofence assertion. **Cancel ride** opens driver reason dialog (vehicle_issue, cannot_reach_pickup, other), note required for other; cancellation ends booking and notifies passenger. **Get help** links driver support. No phone/chat or turn-by-turn button; map displays route only. If another device advances state, controls update from listener and stale mutation refreshes.

### S26 Arrived driver trip

Four-digit PIN input with numeric keyboard, **Start ride**, **Cancel ride**, **Get help**. Explain ask passenger for PIN once seated. Invalid PIN → clear digit input, announce error, no state advance. Fifth failure within minute → cooldown and retry time. **Start ride** valid mutation moves same page to in-progress. Passenger cancel wins conflict → cancelled read-only result; don't allow late start. PIN never readable by driver API.

### S27 In-progress driver trip

Show destination, route, elapsed time from server startedAt (informational), locked fare, tracking source/freshness and **Complete ride**. Complete opens fare summary and **Confirm completion / Keep driving**. Confirm mutation finishes trip, stops its GPS sharing, sets driver offline and clears lock. Completion is explicit, not triggered by route animation. No cancellation/start/PIN control. Offline network disables Complete; reconnect preserves startedAt. **Get help** remains. User should interact only while safely stationary; no auto-advancing workflow.

### S28 Completed/cancelled driver detail

Show terminal outcome and payment pending/paid indicator. Captured → driver share and **Download test receipt**; pending → "Passenger payment pending" and no receipt. **Back to dashboard**, **View earnings**, **Get help**. No collect-cash/mark-paid action. **Back to dashboard** leaves driver offline; next **Go online** refreshes GPS. Cancelled/expired shows no earnings. Past detail never shows trip transition controls.

### S29 Driver activity and earnings

History uses own records and the same pagination/filter behavior as passenger history. Earnings has **Captured test earnings**, **Pending passenger payments**, per-trip ledger rows with driver share, dates and test badge, date selection Today/Last 7 days/All. All is paginated; no unbounded aggregation in client. **View trip** opens own detail; **Load more** continues list. Empty captured ledger → "No captured test earnings yet"; pending fares appear separately. API failure preserves known rows with stale timestamp. There is no Withdraw button or balance that implies real bank funds.

### S30 Driver profile

Own profile edits as S21; vehicle summary, approval status, **Edit vehicle** goes application with reapproval warning, **Switch to passenger**, **Help**, notices, **Sign out**. Active trip blocks vehicle changes and prompts before logout: **Return to trip** or **Sign out anyway**. Sign out leaves trip in canonical state, stops browser location and marks unavailable; passenger sees stale tracking. Driver must sign back in to finish; administrator/support cannot silently complete it.

## Shared support screens

### S31 Help and ticket list

Help categories **Ride issue**, **Payment issue**, **Lost item**, **Account issue**, **Other** open new ticket with selected category. **My requests** opens own list. Clear text: "Support is not an emergency response service." List tabs All/Open/Resolved; rows subject, category, status, last update; **New request**, **Load more**, row open. Empty → "You haven't contacted support yet" and **Create a request**. Query failure has retry, no sample tickets.

### S32 New ticket

Category, subject 5–100, description 10–2000, optional own ride selector. No file attachments. **Submit request** calls support create and navigates saved ticket; **Cancel** returns list with discard warning if dirty. Own ride supplied by help link is preselected; foreign ride is never accepted. Validation stays inline; timeout retries same key after canonical check. Payment ambiguity ticket includes own ride ID/request ID, never credentials or card details. Success includes ticket ID and status Open, with no fabricated response-time promise.

### S33 Ticket conversation

Subject, status, associated ride link (own workspace), timestamped messages. Reply textarea 1–2000, **Send reply**. Owner reply to resolved is blocked until **Reopen request** makes Open; confirmation and success status visible. **Back to requests**. Admin messages marked Support, owner messages You. Loading pagination preserves thread; failed send preserves draft/key; empty messages impossible for created ticket because description is initial message, but corruption shows support/retry instead of invented content. Ticket owned by another user → generic 404.

## Administrator screens

### S34 Overview

Show real counts of pending applications, active rides, payment review incidents and open support; each card links filtered queue. Recent operational events list is bounded; loading/failed/empty each distinct. No fake revenue graph. Count unavailable shows unavailable, not zero. Header shows administrator role and environment. Sign out uses same session logic. Demo link hidden outside demo.

### S35 Driver queue and review

Queue tabs Pending/Approved/Rejected/Suspended, filter exact plate or UID supported server-side, **Load more** and row review. Empty shows no applications in selected category. Review displays versioned vehicle/profile and submission date, **Approve**, **Reject**, **Suspend** (approved only), **Back to queue**. Approve confirmation references exact vehicle. Reject/suspend require reason 5–500; **Confirm / Cancel**. Success updates status and appends audit. Stale version → refresh and require review again. Active ride blocks suspension; explain finish/resolution first. Admin cannot grant itself roles through this UI and cannot mark an unreviewed vehicle approved by editing a field.

### S36 Ride queue and inspection

Filters Searching/Active/Completed/Cancelled/Payment attention and exact ride ID search; clear filter; pagination. Detail shows canonical timeline, snapshots, fare, payment state/provider IDs, sync/dispatch status and associated tickets, with no PIN or payment secrets. **Reconcile status** performs provider/access check and refreshes; success may update verified payment, no manual paid button. Ambiguous duplicate charge remains review_required and offers **Open support ticket** under an explicit operational actor with ride association; ticket API checks admin rights. No force complete/cancel/reset financial records. Failure shows request ID and retry; nonexistent ID 404.

### S37 Support queue and reply

Filters All/Open/In progress/Resolved and pagination. Ticket view as S33 plus **Mark in progress**, **Resolve**, **Reopen**, response field and **Send response**. Resolve requires at least one admin reply; unresolved payments must be reconciled before claiming paid. Status mutation confirmation, audit, and stale-version conflict refresh. Sending an admin reply to Open makes In progress; replying to Resolved requires reopen. No email/SMS is implied by an in-app response.

### S38 Demo tools

Only demo administrator: view allowlisted demo identities and scenario guidance; **Reset completed demo fixtures** opens dialog with exact affected IDs and typed `RESET DEMO`. Backend rejects active rides, captured payment/ledger deletion, non-demo users and non-demo env. Reset clears only eligible unpaid terminal fixtures/ephemeral data according to schema; paid demonstration history remains auditable. Success lists count actually reset, no forced fresh payment state. No seed button that overwrites a real account; fixture creation is a documented operator script in development.

## Universal overlays and boundary states

| Component | Actions | Success | Error/empty |
|---|---|---|---|
| Unsaved changes | Stay / Discard | Preserve or abandon unsubmitted edits | Never deletes committed record |
| Session expired | Sign in again | Return to permitted active record | Repeated failure shows support route |
| Map attribution | Provider/data-source links | Open source page in new tab | Always visible, never under sheet |
| Toast | Optional close | Announced and dismissed after 5 seconds | Critical state stays inline |
| Loading skeleton | None until ready | Real content replaces it | After 10 seconds show retry; retain state |
| Not found | Go to dashboard | Appropriate role home | Public fallback landing |
| Driver GPS prompt | Allow / Not now via browser | Fresh point, online eligibility | Not now keeps offline, manual passenger booking unaffected |
| Permission denied | Retry after settings / Help | Reauthorize once permitted | Never auto-grants capability |
| Maintenance/config unavailable | Retry | Restores provider-backed flow | No simulated payment or booking outside demo |

## End-to-end acceptance paths

1. New passenger → signup → verify → manual pickup/destination → quote → request → driver acceptance → arrived/PIN → started → completed → captured test payment → receipt → rating → history.
2. New driver → signup → vehicle submission → pending → admin approval → GPS online → decline one offer → accept another → complete → pending/captured earnings.
3. Two drivers accept same ride → one wins, one gets conflict; neither sees the other's private data.
4. Search expires/cancellation races acceptance/start → canonical terminal or active state; no duplicate locks.
5. Checkout success followed by browser close → signed webhook captures → login returns paid receipt; no second order/ledger.
6. GPS denied, tiles/search/routing failure, offline/reconnect and stale mirror → honest status and recovery actions.
7. Passenger support ticket → admin reply/resolve → owner reopen; each role sees only permitted conversation.
8. Mobile 360 px and keyboard-only flows complete without inaccessible map-only actions, hidden attribution or unusable dialogs.

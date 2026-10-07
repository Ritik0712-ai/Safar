# Cab Booking Product Requirements

Version 1.0 · 7 October 2026 · Owner Ritik Agarwal · Status proposed build specification

## Purpose and reading order

Build a usable India-focused cab booking website in which a passenger requests a ride, a driver accepts and completes it, and the passenger makes a verified test payment and receives a receipt. Version 1 is a controlled student and portfolio release. It is not authorization to operate a public transport marketplace or collect real money.

Read this document, [technical requirements](02-technical-requirements.md), [app flows](03-app-flows.md), [design brief](04-ui-ux-design-brief.md), [backend schema](05-backend-schema.md), and [implementation plan](06-implementation-plan.md), in that order. Product rules belong here, API and runtime contracts in document 02, screen behavior in document 03, visual tokens in document 04, persistent fields and permissions in document 05, and build gates in document 06. Explicit later instructions from Ritik override these proposals. Do not silently change contracts in only one document.

The working product name is **Cab Booking**. A final brand name and logo are not prerequisites. The original source is `../Cab Booking App .docx`. This specification resolves its optional and conflicting features for a coherent first release.

## App overview

A responsive website with passenger, driver, and administrator workspaces. Firebase Authentication identifies users, Firestore stores durable records, Firebase Realtime Database carries short-lived location data, Leaflet renders maps, Geoapify provides map tiles/address search/routing, and Razorpay Test Mode demonstrates payments. Next.js server routes implement trusted operations. Google Maps billing, Stripe, native mobile apps, and Firebase Cloud Functions are not dependencies of version 1.

## Problem statement

Passengers need one clear sequence for choosing locations, understanding the price, finding a driver, seeing ride progress, paying, and checking past rides. Drivers need actionable requests, an unambiguous trip state, and a reliable earnings record. Students need an implementation that demonstrates these connected workflows with persisted data rather than disconnected mock screens.

The primary product problem is confidence during a ride: who accepted, what happens next, what the agreed fare is, and whether payment was verified. Do not measure success by the number of dashboard cards or integrations installed.

## Target users

| Persona | Context | Main need | Constraints |
|---|---|---|---|
| Passenger | Books from phone or desktop | Clear price and ride progress | May decline GPS; can enter locations manually |
| Driver | Uses phone browser while stationary | Accept requests and advance a trip | Requires foreground GPS to go online; one active trip |
| Administrator | Manages a controlled demonstration | Approve driver profiles, inspect records, respond to support | Cannot fabricate payments or silently alter rides |
| Evaluator | Reviews portfolio or student project | Reproduce the whole journey | Simulation and sandbox payment must be labelled |

The initial release supports English, INR, and Asia/Kolkata display times. One account can have passenger and driver capabilities; administrator capability is separately granted. Use separate passenger and driver accounts for a two-browser demonstration. An account must not drive its own requested ride.

## Product decisions and defaults

These are product defaults proposed to remove guessing, not facts from the original document:

| Decision | Version 1 rule |
|---|---|
| Service area | One configured circular area. Development seed: Bengaluru center 12.9716, 77.5946, radius 25 km. Both endpoints must be inside it. Change the configuration before choosing another city. |
| Ride category | Economy cab only; up to four passengers; one pickup and one destination |
| Booking | On-demand only; one unsettled ride per passenger |
| Matching | Offer once to up to ten eligible drivers within 5 km; first valid acceptance wins |
| Search timeout | 120 seconds from server creation; declining drivers receive no repeated offer for that request |
| Quote validity | Five minutes; changing either endpoint invalidates the quote |
| Fare | Fixed agreed quote calculated from route distance and estimated travel time, not a GPS meter |
| Cancellation | Passenger can cancel before trip start, with zero fee; driver can cancel before start with a required reason |
| Driver cancellation | Ends that booking; passenger can create a new request; no automatic reassignment |
| Trip verification | Passenger sees a four-digit trip PIN; assigned driver enters it before starting |
| Payment timing | After completion; test checkout only; no cash option |
| Driver earnings | 80% of captured test fare, recorded as simulated earnings; no bank transfer |
| Receipt | Downloadable PDF after capture; labelled test receipt, not tax invoice; email delivery deferred |
| Location | Foreground browser GPS; stale readings clearly identified; explicit simulation in demo environment only |
| Images | Initials avatars; no profile/license uploads in version 1 |
| SOS | Emergency-service dispatch excluded; support is not an emergency channel |

Fare configuration in paise: base 4000; distance 1200 per km; estimated time 100 per minute; minimum 8000; commission 2000 basis points. Server computes `raw = base + round(distanceMeters * perKm / 1000) + round(durationSeconds * perMinute / 60)`, then `total = ceil(max(minimum, raw) / 100) * 100`. Example: 5 km and 15 minutes gives ₹115. These are illustrative demo rates, not market or regulated fares. No surge, taxes, toll adjustments, or waiting charges. Final fare equals the locked quote. Driver share is `total - round(total * commissionBps / 10000)`; snapshot rates when booking.

## Core requirements and user stories

| ID | Requirement and user story | Acceptance criteria |
|---|---|---|
| FR01 | As a user, I can register with email/password or Google and return safely | Email users verify email before booking/going online; reset flow works; protected routes reject anonymous users; active ride survives reload |
| FR02 | As a passenger, I can choose pickup and destination | Search selects a coordinate-backed result; map pin selection works; manual entry works without GPS; text alone cannot create a booking |
| FR03 | As a passenger, I can inspect the route and price | Road route, distance, estimated duration, fixed fare, expiration, and Economy capacity appear before confirmation |
| FR04 | As a passenger, I can request and cancel a ride | One request created despite double clicks/retries; searching, no-driver, expired, and cancelled states have recovery actions |
| FR05 | As a driver, I can register a vehicle and await approval | Required name/phone/plate/make/model/color/seats validated; submission is pending; only administrator can approve or reject |
| FR06 | As an approved driver, I can go online and accept or decline | Fresh location required; expired or conflicting offers fail gracefully; concurrent accepts assign exactly one driver |
| FR07 | As both parties, we know the trip stage | `searching → assigned → arrived → in_progress → completed`; PIN required for start; only assigned driver advances trip |
| FR08 | As a passenger, I can see the driver approaching | Assigned driver marker updates; timestamp shown; reconnect does not reset the trip; stale data never appears live |
| FR09 | As a passenger, I can pay the completed fare | Server creates/reuses provider order; only verified captured payment marks paid; failures and dismissals permit recovery without a duplicate charge |
| FR10 | As both parties, I can inspect history | Actual persisted trips, role filters, pagination, details, payment status; no invented ride history |
| FR11 | As a passenger, I can download a receipt and rate a driver | Receipt requires capture; one rating 1–5 per completed trip; optional comment ≤500 characters; ratings update once |
| FR12 | As a driver, I can understand earnings | Captured-trip ledger only; pending fare distinguished; all amounts labelled simulated; no cash-out button |
| FR13 | As a user, I can request help | Category, subject, description, optional own ride; ticket saved; own conversation readable; administrator response persists |
| FR14 | As an administrator, I can review drivers and support | Explicit authorization, approval reason for rejection, audited changes, no arbitrary edit of money/ownership |
| FR15 | As an evaluator, I can demonstrate without driving | Allowlisted demo driver has explicit simulation label; two real identities and real database writes; production rejects simulation |

## Lifecycle and invariants

Ride status: `searching`, `assigned`, `arrived`, `in_progress`, `completed`, `cancelled`, `expired`. `completed`, `cancelled`, and `expired` are terminal. Payment status is separate: `not_due`, `pending`, `processing`, `paid`, `failed`, `review_required`. A completed trip may still be unpaid; the UI must say so.

Passenger active lock remains through completed-but-unpaid, until payment capture or audited support resolution. Driver active lock clears on completion/cancellation, so the driver may take another ride; that does not imply the old fare was paid. A passenger with a pending payment is redirected to payment, not allowed to create another ride. Driver availability resets offline on completion, with an explicit online action for the next trip.

All transitions use server timestamps and checked prior state. Competing acceptance, completion, cancellation, review creation, and payment capture must be atomic or idempotent. External service calls never run inside a retried database transaction. Driver arrival is an explicit stationary action, not an automatic GPS geofence. Completing a ride requires driver confirmation and a trip already in progress; GPS never sets the fare.

The same UID cannot request a passenger ride while online as a driver or driving an active trip, and cannot go online while holding an unsettled passenger ride. Workspace switching remains possible for inspection, but these mutually exclusive actions return a clear conflict. A rider cannot accept their own request. This prevents simultaneous riding/driving and keeps capability switching separate from trip ownership.

## MVP scope and release boundary

Version 1 includes all FR01–FR15, but with a deliberately narrow admin console, one ride category, fixed quotes, free pre-start cancellation, controlled driver approval, and test payment. Required screens and edge cases are in document 03. The release is complete only when separate passenger/driver accounts finish a persisted ride with a captured sandbox payment and receipt on the deployed website.

Not having credentials permits emulator development but does not satisfy integration or deployment acceptance. A frontend build is not a launch. Simulation is a verification aid and does not replace a foreground GPS test.

## Success metrics

These are initial targets, not measured results. Record a baseline after the first deployed pilot. Do not send addresses, precise coordinates, PINs, tokens, or personal descriptions to analytics.

| Metric | Definition | Initial acceptance target |
|---|---|---|
| Workflow reliability | Fully completed and captured sandbox journeys / started scripted journeys | At least 19/20 in a controlled seeded environment; payment-provider intentional declines reported separately |
| Assignment integrity | Requests with more than one assigned driver | Zero in 100 concurrent-accept trials |
| Duplicate protection | Double booking, duplicate receipt, ledger or rating under retries | Zero across retry/webhook scenarios |
| Booking usability | New testers complete location selection and request without guidance | ≥4/5 testers within three minutes |
| Status responsiveness | Server change to visible foreground UI change | p95 ≤3 seconds under tested connectivity |
| GPS freshness | Age of visible foreground location | ≤15 seconds normally; stale warning above 15 seconds |
| API latency | Own API excluding provider waiting, measured on preview | p95 ≤1.5 seconds at pilot load |
| Accessibility | Critical blockers in booking/payment/driver journey | Zero; keyboard path and contrast checked |
| Operational correctness | Unauthorized cross-account access / rejected test attacks | Zero allowed access in the documented permission test matrix |
| Cost discipline | Database and Geoapify usage during pilot | Below 70% of applicable free allowance; alerts/usage review at that threshold |

Events: signup_completed, quote_created, booking_requested, offer_accepted, ride_started, ride_completed, checkout_opened, payment_captured, review_submitted, support_created. Include pseudonymous actor ID, ride ID if needed, environment, server timestamp, duration/error category. Funnel denominator includes failures, not just successes.

## Features to avoid in version 1

- Multiple stops, scheduled rides, pooling, subscriptions, multiple vehicle classes, bidding, and surge pricing.
- Promo codes, wallets, loyalty points, cash, saved card management, real payouts, and automated refunds.
- Native apps, background/locked-phone tracking, turn-by-turn navigation, traffic-sensitive ETA promises.
- Emergency-service dispatch, automatic SMS to contacts, live chat, masked calls, and passenger-driver messaging.
- Uploaded identity documents, automatic driver KYC, public driver directories, complex fleet administration.
- In-app tax invoicing, receipt email delivery, AI matching or chatbots, recommendation engines, multi-city configuration UI.

Do not render disabled teaser buttons for these features. Remove them from version 1 navigation. A later release can add them with explicit contracts.

## Risks and decision gates

Free quotas, provider failures, sparse place data, browser GPS behavior, and unapproved payment accounts are real dependencies. Provide manual map pin selection and error recovery; do not invent routes or hide sandbox status. Scope assumes a small controlled pilot, not thousands of drivers. Real-money launch, real payouts, emergency integrations, billing upgrades, and a public marketplace require separate product approval and operational design.

The service-area seed, demo fare, 80/20 earnings split, no upload policy, and fixed-fare policy can be revised by Ritik before implementation. They are deliberately specified defaults, so a builder must not ask the same questions repeatedly or substitute its own rules.

# Cab Booking Implementation Plan

Version 1.0 · 7 October 2026 · Delivery plan for [PRD](01-product-requirements.md) and the five linked specifications

## Objective and definition of done

Deliver the specified responsive website with real persisted passenger, driver and admin workflows. First build a coherent booking interface, then connect the complete ride lifecycle, sandbox payment and receipt. Final acceptance is a deployed two-account journey, permission tests, mobile/keyboard review and documented integration evidence. A scaffold, simulated payment response or successful local build alone is not completion.

This request creates planning documents only. Application implementation starts after Ritik instructs it. Documents propose product defaults and do not authorize paid subscriptions, billing upgrades, public commercial operations, real-money activation or bank payouts.

## Build instructions for an AI agent

1. Read all six files before modifying the app. Preserve their canonical terminology, routes, states and field names. Resolve changes across relevant documents; do not invent extras.
2. Inspect working tree, repository instructions, existing application files and credentials without printing secrets. Do not overwrite unrelated work or reset a repository. Choose an isolated worktree only if actual repository state warrants it.
3. Keep Git author/committer `Ritik Agarwal <ritikagarwal2468@gmail.com>` and push using Ritik's credentials. Before first commit inspect per-repository user.email. No Co-Authored-By trailer. Commit/push only within the authorized build workflow.
4. Use emulators for destructive/concurrent tests; use distinct preview Firebase project for provider-backed validation. No full-code mock dashboard in deployed default mode.
5. Implement domain invariants and API contracts before UI shortcuts. Never let browser approval/fare/payment state become authoritative.
6. Report the actual completion boundary: files/build, emulator checks, preview deployment, integration verification, or launch. Maintain a task-local checklist with evidence; do not claim external services work before testing them.

## Dependencies and setup gates

| Dependency | Required by | If unavailable |
|---|---|---|
| Firebase project, edition/region and Admin credentials | Phase 2 live access and Phase 3 rules | Continue with emulator; mark live verification pending, no silent project selection |
| Firebase email/password and Google providers, authorized domains | Authentication verification | Build screens/emulator tests; actual email/Google remains a gate |
| Geoapify tile/server keys and allowed origins | Maps/quotes | Implement adapter/automated fixtures; no invented deployed fare route |
| Razorpay test keys and stable signed webhook URL | Payments | Complete contract/unit tests; sandbox payment gate stays open |
| Vercel project access and deploy env | Deployment | Local build only; cannot call it deployed |
| Demo allowlist/service area/rates | Seeded demonstration | Apply documented defaults in preview only; don't modify existing real users |

No new plugin is mandatory. Render is optional and its previously observed reauthentication issue does not block the single Next.js backend. Plugin connectivity is not application credential configuration. Keep provider keys in ignored local/hosting secrets, never committed files or screenshots.

## Phase 1 Project setup and architecture foundation

Tasks: inspect workspace; initialize Next.js TypeScript app in a clearly named app directory without disturbing docs/source; pin compatible stable dependencies and lockfile; establish modules from TRD; create environment validation and `.env.example` containing names only; set lint/typecheck/build scripts; local emulator configuration; shared request/error/DTO contracts; install design tokens, font, icon set and base accessible components; implement public shell and role shells with real routes.

Deliverables: runnable application, clean structure, token system, environment template, error boundary/not-found screens, emulator start instructions and labelled environment display. No fake finished workflows.

Gate: install/build/typecheck/lint pass; no secret values tracked; landing and all shells render at360px and1440px; missing configuration gives actionable status, not success fallback. Dependencies chosen for actual available runtime and checked against official documentation.

## Phase 2 Authentication and onboarding

Tasks: Firebase SDK/Admin initialization separated; email/password + Google sign-in; verification/reset/action-code flows; dual browser auth/server session with CSRF protection; onboarding; explicit role capability selection; current account status; role layouts/return paths; sign-out and resume behavior; admin bootstrap operator mechanism without public role grant.

Deliverables: functional sign-in/signup/verify/reset/profile foundation, server session handlers, permission middleware/service, protected screens and seeded test identities.

Gate: anonymous access rejected; user cannot grant admin; email gating works; safe return URL only; cookie/client identity mismatch handled; reload preserves identity; reset/action expiry and Google popup cancellation tested. Use Auth emulator where appropriate; verify provider/email on preview separately.

## Phase 3 Database, permissions and domain services

Tasks: implement Zod field/enum types and all collections/relationships; Firestore indexes; default-deny SDK rules; RTDB access-mirror model and validation; server repository authorization; shared durable limiter and operation idempotency; immutable audit/events; seed proposed service area/fare policy in preview; driver/vehicle drafts, plate reservations, applications/admin decisions; maintenance dry-run script.

Deliverables: versioned schema modules, prototype rules/index files, migration/seed tools, Account/Driver/Admin service, transaction helpers and emulator tests. No cloud mutation just to create documents; deployment to selected project occurs in authorized build phase.

Gate: permission tests include wrong account, wrong role, forged owner/price/approval, oversized values, orphan subcollection access and stale RTDB mirror. Validate rules compilation and actual query compatibility. Seed rerun must be idempotent; no actual identities overwritten. Explicitly report prototype rules and review/test evidence before broad sharing.

## Phase 4 Core UI and map booking slice

Tasks: implement passenger dashboard, address combobox, GPS action, manual pin picker, quote review, loading/empty/errors, map styles/attribution; Geoapify adapter, debounce/cancellation/cache/global throttle; server route/quote/fare calculation; own quote retrieval and expiry; actual recent-history empty state; driver application UI and admin queue.

Deliverables: polished usable booking slice, map/provider adapter, fixed server quote, review screen and driver approval UI.

Gate: review dashboard screenshots before extending secondary screens; 360/768/1440 responsive review, keyboard suggestions/picker alternative, denied GPS, map tile failure and quote expiry. Route distance/fare comes from provider in preview; test fixture only in test environment. No fabricated driver markers, reviews or charts.

## Phase 5 Booking, matching and trip lifecycle

Tasks: quote consumption/rider lock; candidate geohash queries and distance filter; idempotent offers fan-out; availability/presence and heartbeat; accept/decline transactions; searching expiry/lazy cleanup; active trackers; PIN encryption/retrieval/verification; arrived/start/complete/cancel; events; refresh/resume; driver lock release and offline state; RTDB tracking access sync/retry; allowlisted foreground simulation.

Deliverables: complete passenger/driver trip path before payment; actual tracking and honest stale/reconnect behavior; deterministic transitions and recovery.

Gate: two identities/two browsers complete trip; 100 concurrent-accept trials yield one driver; cancel-vs-accept/start race correct; double request yields one ride; fresh GPS checked; closed-browser expiry resumes safely; unauthorized location reads fail; access mirror failure shows pending tracking and repairs. Simulation label persists and is rejected outside demo.

## Phase 6 Payment and receipt integrations

Tasks: canonical payment record on completion, order-creation lease/uncertainty reconciliation, Razorpay Test Checkout, server callback signature/provider capture check, raw signed webhook/idempotency, unique order/payment mappings, captured ledger/receipt/passenger lock transaction; retries and processing/review states; on-demand PDF; receipt screen/download; driver captured-vs-pending earnings.

Deliverables: provider-backed sandbox payment, verified capture, immutable test receipt/ledger, accurate payment recovery and simulated earnings.

Gate: signed captured payment verified on preview; intentionally failed/dismissed payment never paid; authorized-only never paid; webhook/callback races create one ledger; stale failed event cannot downgrade capture; browser-close recovery; wrong amount/order/mode/user rejected; duplicate different capture produces incident; ambiguous order creation never blindly retries external charge. PDF amount/IDs match persisted receipt. No live money or payouts.

## Phase 7 History, reviews, support and operational UI

Tasks: role-scoped history/filter/pagination; completed detail/ratings and atomic aggregate; profile edits and vehicle reapproval; support categories/create/thread/reopen; admin support/ride attention/reconciliation; demo tools with guarded reset; operational counts from records; server event funnel instrumentation without personal payloads.

Deliverables: all remaining V1 routes with complete states; one-time reviews; functioning support and admin console; actual paginated records.

Gate: owner isolation, rating replay, thread pagination/status checks, admin audit and stale application review; no cash-out/force-paid/force-complete controls; empty lists honest; past snapshots unchanged after profile/vehicle edits. All actions in flow document exercised at least once.

## Phase 8 System testing and resilience

Tasks: targeted unit tests for fare rounding/expiry/state transitions; emulator integration/rules/concurrency tests; Playwright passenger+driver+admin journeys; provider sandbox runs; failures/reconnect/session expiry; keyboard/mobile/contrast; privacy/log inspection; quota baseline, listener teardown, global throttling and modest pilot latency measurements.

Deliverables: reproducible test scripts, test identities with safe reset, acceptance matrix keyed FR01–FR15 and S01–S38, screenshots and failure evidence, list of unresolved integration gates.

Gate: no critical or high-impact correctness/security defect open; required tests/build/lint/typecheck pass; PRD targets measured or explicitly reported unmeasured. Do not add redundant tests for static visual tokens; prioritize concurrency, permissions and payment integrity. Repeat only after meaningful change/failure/uncertainty.

## Phase 9 Deployment and verified demo release

Tasks: select authorized Vercel/Firebase preview project; configure exact origins/provider keys/session URLs; deploy rules/indexes; deploy application; register/test stable Razorpay webhook; health/readiness check; run full journey against resulting HTTPS URL; verify provider dashboard capture and database record/receipt/ledger agreement; establish release/rollback notes and usage review procedure.

Deliverables: accessible deployment URL, deployed environment inventory without secrets, end-to-end evidence, handover README, safe demo accounts/scenario, rollback and operational instructions.

Gate: real deployed two-browser workflow, foreground device GPS check plus labelled demo simulation, downloads work, reconnect/history persist, unauthorized URL rejected. Payment remains Test Mode. If a provider key or service is missing, report partial/unverified deployment and keep its gate open; do not imply completion.

## Phase 10 Final polish and handover

Tasks: inspect all specified screenshots and long-content cases; fix mobile keyboard/safe-area/map-attribution/focus issues; remove temporary placeholders, debug controls and unsupported feature links; review copy and state distinction; record schema/contracts/versioned seeds and limits; confirm all six documents reflect final implementation; provide user-friendly demo sequence and technical maintenance instructions.

Deliverables: finished V1 website, final docs, verified acceptance checklist, known limitations and future backlog. No additional paid service introduced without explicit scope decision.

Gate: every visible action works; no canned sample dashboard masquerading as data; no test secrets/logs; no unexplained empty shell; no production simulation control; final completion report distinguishes deployment, tests, commit/push and launch status.

## Milestones and sequencing

M1: setup/auth/database gates. M2: reviewed map+quote UI. M3: complete ride in two browsers. M4: captured sandbox payment/receipt. M5: full support/admin/history coverage. M6: deployed verified release and polish. Integrations start as soon as their keys are available, but final acceptance waits for real provider checks.

The original source suggests two weeks. Treat that as a sequencing guide, not a promise that all quality gates fit fourteen days. Budget scope around a working vertical slice and verified checkpoints; provider setup, failure diagnosis and visual review may extend calendar time. Do not squeeze reliability out to meet a nominal day count.

## Required release evidence checklist

- [ ] Stable HTTPS deployment URL and exact environment/mode.
- [ ] Separate passenger/approved driver/admin identities; no printed secrets.
- [ ] Quote → request → accept → arrive/PIN → start → complete → captured test payment → PDF → rating/history verified.
- [ ] Payment callback/webhook, concurrency and account-isolation tests passed.
- [ ] Real foreground GPS test and separate labelled simulation test.
- [ ] Mobile, keyboard, contrast, stale/error/empty/loading screenshots reviewed.
- [ ] Actual provider usage/quotas checked; no unbounded listeners/queries.
- [ ] All V1 route actions in document 03 covered; excluded features absent.
- [ ] Prototype rules validated; deployment/auth domains/webhook verified.
- [ ] Local build vs deployed verification vs commit/push reported accurately.

## Later releases

After V1 acceptance, separately specify multi-stop rides, scheduled bookings, promo codes, richer driver/admin operations, safe contact options, receipt emails, native/background GPS, and real financial activation/payout/refund handling. Do not implement those merely because they appear in source tutorials. Keep them out of the V1 critical path.

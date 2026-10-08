# Safar

A responsive Bengaluru cab-booking website with passenger, driver and administrator workspaces. Built for a controlled student and portfolio release. Payments are test-only; earnings are simulated.

**Website:** [safar-kappa-six.vercel.app](https://safar-kappa-six.vercel.app) · **Repository:** [Ritik0712-ai/Safar](https://github.com/Ritik0712-ai/Safar)

## Current delivery boundary

The complete application and all workspaces are implemented. Firebase Authentication, Firestore Standard, Realtime Database, rules/indexes and Vercel are connected. Deployed authentication, session exchange, onboarding, role rejection, persisted support and idempotency were verified.

Geoapify and Razorpay integration code is implemented, but their project/test credentials still need to be configured. The deployed site refuses to invent a road quote or payment success. `/api/health` returns `503` with `degraded` until those dependencies are configured. The two-browser journey passes with explicitly labelled automated fixtures; that is **not** evidence of a real Geoapify route or Razorpay sandbox capture. See [release evidence](docs/07-release-evidence.md).

## What is included

- Email/password and Google authentication, verification, password recovery, onboarding and scoped workspaces.
- Map/address selection, coordinate-backed endpoints, server quotes, locked fares and expiry.
- Matching to approved nearby drivers, atomic acceptance, pre-start cancellation and protected trip PINs.
- Scoped live ride/offer listeners and foreground location sharing with honest stale-state labels.
- Razorpay order creation, callback/webhook validation, capture reconciliation, immutable receipts and earnings.
- Actual ride history, one-time ratings, profiles, driver application/review and private support conversations.
- Admin queues, audit records, read-only payment inspection and guarded demo reset.

The original requirements are in [docs](docs/01-product-requirements.md). Branding uses Safar, as named in the repository and selected Firebase project. The six source documents were retained; storage clarifications are appended where required.

## Run locally

Use Node.js 24 and Java 21 or newer for the emulators.

```sh
npm ci
npm run setup:local
npm run emulators
```

In a second terminal:

```sh
npm run seed
npm run dev
```

Open `http://localhost:3000`. The seed creates three **emulator-only** identities. Their generated passwords are saved privately in `.env.demo-accounts.json`; never commit or publish that file. The default local app uses real provider adapters and shows unavailable states until provider keys exist.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

Integration tests require the emulators. The concurrency test performs 100 two-driver acceptance trials and can take several minutes. It resets only the `demo-safar` emulator database, so do not use that namespace for valuable local records while running the suite.

```sh
npx playwright install chromium
E2E_EMULATORS=true npm run test:e2e
npm run test:journey
```

`test:journey` starts a separate server on port 3001 and a local payment fixture on 4111, uses fresh emulator identities and labels its simulated provider responses. It exercises the actual booking, acceptance, PIN, completion, verification, PDF, rating and earnings UI. Fixtures require `APP_ENV=test`, an emulator and explicit test flags; Vercel rejects the fixture transport. Screenshots and the downloaded test receipt are local ignored artifacts.

## Connect services

Copy `.env.example` to an ignored environment file and supply the actual values. Browser Firebase configuration and a restricted Geoapify tile key use `NEXT_PUBLIC_`; Admin credentials, routing keys, payment secrets and signing keys remain server-only.

1. Firebase: enable email/password and Google; authorize the exact deployment domain. Use a dedicated runtime service account with Datastore, Firebase Auth and RTDB permissions. Do not give a browser this credential.
2. Geoapify: create Safar on the intended free plan; use distinct server and browser keys. Restrict the browser key to the exact website/local origins. OSM tiles provide an attributed map preview while the tile key is absent; there is no road-routing fallback outside automated tests.
3. Razorpay: use `rzp_test_` credentials and `PAYMENT_MODE=test`. Set a webhook at `https://safar-kappa-six.vercel.app/api/webhooks/razorpay`, subscribing to captured payments with the matching server webhook secret. Configure automatic capture on the test account. Do not activate live payments or payouts.
4. Set `APP_ORIGIN` to the exact stable HTTPS origin. Deploy rules/indexes before the app. Keep `DEMO_MODE=false` in production and use a separate preview project for further pilots.

PIN encryption requires a 32-byte hex key. HMAC and cursor keys should each have independent cryptographically random values. Rotation must preserve outstanding records; do not casually replace keys during active rides.

## Administrator bootstrap

Sign up and complete onboarding first. An authorized operator then grants a capability to the **verified Firebase UID**:

```sh
npm run grant-admin -- YOUR_EXISTING_UID
```

Load live credentials explicitly for a live project. The script audits the grant and sets the provider claim. Sign out/in afterward. Email addresses are never a public administrator allowlist; registration cannot grant admin or approve a driver.

## Data and operations

Firestore owns lifecycle, quote, payment and account state. Client durable writes are denied. RTDB owns ephemeral presence/tracking with short, server-controlled participant leases. Assignment and financial writes use transactions; provider calls stay outside transaction callbacks. GeoJSON is persisted as a bounded JSON string because Firestore does not support nested coordinate arrays, and is decoded into the normal API DTO.

The deployed project selected by Ritik is `portfolio-69e1b`, now named Safar. Its existing Standard database is in `nam5`; RTDB is in `us-central1` and Vercel runs near the database. No existing database was recreated or existing identities overwritten. Do not assume the proposed Mumbai region was provisioned.

The rules are a tested prototype for the controlled release. The emulator matrix covers ownership, role/field tampering, default deny, orphan access, tracking expiry, sequencing and simulation allowlisting. Broader launch still requires provider verification, physical foreground GPS, accessibility/device checks, quota/latency measurement and operational review.

```sh
npm run maintenance
```

Maintenance is a bounded dry run by default. `--apply` is restricted to the demo emulator. It excludes financial/audit history and uncertain payment operations. Retention is operator-managed; no paid TTL, Cloud Functions or unattended cleanup is implied.

## Deployment and recovery

The Vercel project is linked to this repository. Keep all changes as focused commits under `Ritik Agarwal <ritikagarwal2468@gmail.com>` without co-author trailers, then push with Ritik’s credentials. `.vercelignore` excludes local secrets and test artifacts from upload.

The lockfile pins dependencies. The `jose` compatibility override fixes Firebase’s CommonJS/ESM interop in the hosted runtime; the gRPC override addresses vulnerable transitive versions. Re-run the live auth smoke check after changing either. Production dependency audit currently reports zero findings; development tooling still has findings that should be reviewed before updates.

Rollback the application deployment with Vercel when necessary. Keep additive rules/index/schema changes compatible with old readers. Never roll back or rewrite captured payment, receipt or ledger records to make a demo look fresh. For an ambiguous order, reconcile with the provider or support; never blindly create another charge.

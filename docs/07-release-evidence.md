# Safar release evidence

8 October 2026. This records actual checks and remaining release gates; it supersedes any implication that the planning documents alone completed a release.

## Implemented scope

All V1 public/auth, passenger, driver, shared support and administrator route families are implemented. The application uses server-controlled quotes, assignment, PIN, lifecycle, capture, review and support writes. Native apps, multiple classes/stops, cash, wallets, payouts, SOS and uploaded identity documents remain excluded.

## Verified results

| Check | Evidence |
|---|---|
| Production build, strict TypeScript and lint | Passed locally and on Vercel; lint has no warnings at the final check |
| Fare math, location bounds, redirects and strict inputs | Six targeted unit tests, including exact paise display |
| Assignment integrity | 100 simultaneous two-driver acceptance trials; exactly one acceptance per request |
| Lifecycle and locks | Owner isolation, arrival/start PIN, forbidden late cancellation, completion, driver release and unpaid passenger lock |
| Capture integrity | Amount/order mismatch rejection, authorized-only processing, duplicate callback/webhook capture, single ledger/receipt, duplicate-charge investigation preservation |
| Recovery | Ambiguous order creation never blindly creates another provider order; expired offers cannot starve new requests |
| Driver administration | Registration uniqueness, application-version rejection, approved-vehicle ownership and active-trip suspension conflict |
| Support | Own thread isolation, idempotent creation, admin response before resolution, reopen/reply and visible saved responses |
| Database permissions | Anonymous/unscoped reads, forged fields/roles/ownership, orphan reads, invalid/stale tracking, sequencing, simulation and expired access rejected |
| Browser checks | Public pages and protected redirects; passenger, driver and administrator workspaces at 1440 and 360 px |
| Complete browser journey | Separate identities book, accept, arrive, enter PIN, start, complete, verify a captured automated fixture payment, download PDF, rate and see ₹92 driver share |
| Live deployed Firebase | Native test-account sign-in, bearer verification, session cookie, onboarding, protected passenger page, wrong-role rejection and persisted/idempotent support verified |
| Production dependency audit | Zero reported production dependency findings; development tooling findings remain recorded |

Local screenshots, receipt PDF and test logs are in ignored `artifacts/`. They contain only controlled test data, and are excluded from Git and deployment upload. The complete-browser payment screenshot is **fixture evidence**, not a Razorpay sandbox dashboard capture.

## Deployed inventory

- Website: `https://safar-kappa-six.vercel.app`.
- Repository: `https://github.com/Ritik0712-ai/Safar`, main branch, commits authored/committed as Ritik Agarwal with the requested email.
- Firebase project selected by Ritik: `portfolio-69e1b`, renamed Safar.
- Firestore: existing Standard/native `(default)` database, `nam5`.
- RTDB: `portfolio-69e1b-default-rtdb`, `us-central1`.
- Authentication: email/password and Google enabled; exact stable website domain authorized; new passwords require at least ten characters and email enumeration protection is enabled.
- Vercel: `ritik-agarwals-projects/safar`, linked to GitHub; Node 24, near the existing database.
- Production mode: controlled test-payment application; driver simulation and fixture providers rejected.
- Dedicated runtime credentials and independent PIN/HMAC/cursor keys are in private local/hosting secret storage. No values are included here.

## Gates still open

- [ ] Create/approve the Safar Geoapify project and configure distinct restricted browser/server keys.
- [ ] Acknowledge the Razorpay account’s updated terms, configure Test Mode keys and stable signed webhook, then verify a real sandbox capture.
- [ ] Verify real Geoapify road distance, geometry and fare on the deployed website.
- [ ] Complete the two-account journey with actual provider services, then compare payment, receipt and ledger with the provider dashboard.
- [ ] Run a physical foreground GPS/device test, including permission denial, background pause and reconnect.
- [ ] Verify real Google popup/redirect and email delivery/action links end to end with the owner.
- [ ] Measure the 19/20 pilot reliability, p95 latency/stage response and actual provider usage/quota targets. No measurements are invented.
- [ ] Complete assistive-technology, 200% zoom and physical mobile keyboard/safe-area review.

`/api/health` intentionally remains degraded until required provider configuration exists. An implemented screen, passed fixture, pushed commit or deployed URL does not by itself close these gates.

## Operational limits

The rules are a validated prototype for a small controlled pilot. Firestore/RTDB revocation is not cross-database atomic; tracking is protected with bounded leases and authorized repair. Live location is foreground-only. Search expiry is normalized on authoritative reads rather than by an always-running server timer. Cleanup is operator-managed, dry-run-first and excludes financial/audit/uncertain records. Retention defaults are project choices rather than statutory claims. Public commercial transport, real money, refunds/payouts and larger scale require a separate design and review.

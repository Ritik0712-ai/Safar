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
| Actual Geoapify on the deployment | Address search and a 57-point road geometry; 1,773 metres / 204 seconds / ₹80 minimum fare |
| Actual Razorpay sandbox | Provider order, actual Checkout and mock bank success; provider confirmed captured ₹80. Safar callback/provider verification produced one receipt and ₹64 / ₹16 ledger split in the emulator, released both locks, and passed two signed capture replays |
| Hosted service setup | Distinct Geoapify browser/server keys, Razorpay Test Mode credentials and independent webhook signing secret configured privately; stable capture webhook enabled; deployed health 200 |
| Unrelated merchant events | Valid signed events for unmapped orders acknowledged without provider calls or financial writes; invalid signatures still rejected |
| GitHub verification | Full lint, types, unit tests, build, emulator suite including 100 assignment trials, and complete fixture UI journey passed on main |
| Production dependency audit | Zero reported production dependency findings; development tooling findings remain recorded |

Local screenshots, receipt PDF and test logs are in ignored `artifacts/`. They contain only controlled test data, and are excluded from Git and deployment upload. The complete-browser payment screenshot is **fixture evidence**, not a Razorpay sandbox dashboard capture.

Actual provider evidence is separately named `real-sandbox-payment-success.png`, `razorpay-real-capture-dashboard.png`, `real-sandbox-receipt.pdf` and `real-provider-capture.txt`. The actual provider trip used simulated location and emulator durable storage; it does not claim physical GPS or a complete hosted two-account journey. Test credentials were saved in ignored files with owner-only permissions and hosting secret settings. A Test Mode secret appeared once in the private tool output during setup; rotate it before broader use or sharing the conversation. Subsequent checks redact secrets.

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
- Geoapify project: Safar, free plan, separately labelled server routing and browser maps keys. HTTP Referer filters saved for the stable site and local ports 3000–3001. Foreign-referrer API search denied with 401; raster tiles returned 200, so tile endpoint restriction enforcement is not claimed.
- Razorpay: Test Mode credentials, automatic capture observed, stable webhook enabled for `payment.captured`. No live payment account activation, paid plan or payout was performed.

## Gates still open

- [x] Create the Safar Geoapify project and configure distinct browser/server keys with saved browser referrer filters.
- [x] Configure Razorpay Test Mode keys and stable signed webhook, then verify a real sandbox capture.
- [x] Verify real Geoapify road distance, geometry and fare on the deployed website.
- [ ] Rotate the Test Mode credential that appeared in private tool output; configure and verify its replacement.
- [ ] Verify raster tile restriction enforcement with the provider; current API search restriction works, but foreign-referrer tiles were served.
- [ ] Complete the two-account journey with actual provider services, then compare payment, receipt and ledger with the provider dashboard.
- [ ] Run a physical foreground GPS/device test, including permission denial, background pause and reconnect.
- [ ] Verify real Google popup/redirect and email delivery/action links end to end with the owner.
- [ ] Measure the 19/20 pilot reliability, p95 latency/stage response and actual provider usage/quota targets. No measurements are invented.
- [ ] Complete assistive-technology, 200% zoom and physical mobile keyboard/safe-area review.

`/api/health` now returns 200 for configured dependencies. Actual provider checks also passed; health is a configuration check, not continuous provider monitoring. An implemented screen, passed fixture, pushed commit or deployed URL does not by itself close the remaining gates.

## Operational limits

The rules are a validated prototype for a small controlled pilot. Firestore/RTDB revocation is not cross-database atomic; tracking is protected with bounded leases and authorized repair. Live location is foreground-only. Search expiry is normalized on authoritative reads rather than by an always-running server timer. Cleanup is operator-managed, dry-run-first and excludes financial/audit/uncertain records. Retention defaults are project choices rather than statutory claims. Public commercial transport, real money, refunds/payouts and larger scale require a separate design and review.

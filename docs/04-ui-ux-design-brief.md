# Cab Booking UI and UX Design Brief

Version 1.0 · 7 October 2026 · Design authority for V1 · Read with [screen flows](03-app-flows.md)

## Design objective

Make booking, trip progress and payment understandable at a glance. The visual direction is calm urban transport: a warm light surface, dark ink, restrained teal action color, readable maps, and strong hierarchy. The website must feel like a finished service with real states and records. A polished empty state is preferable to fabricated rides, drivers, charts or testimonials.

Use the working name Cab Booking until Ritik chooses branding. Create a simple wordmark plus route/pin icon; no Uber logo or copied brand assets. English and INR; dates/times Asia/Kolkata. Avoid gradients, glass effects, decorative dashboard clutter, excess pills and unrelated stock photography. Dark mode is excluded from V1 to keep contrast and maps consistent.

## Design tokens

| Token | Value | Use |
|---|---|---|
| `color-bg` | #F7F8FA | Application background |
| `color-surface` | #FFFFFF | Panels, inputs, dialogs |
| `color-surface-muted` | #EEF2F5 | Subtle separators/disabled fills |
| `color-text` | #142129 | Main text, headings |
| `color-text-secondary` | #52616B | Supporting text |
| `color-border` | #D8E0E5 | Card/table/input boundary; stronger focus separate |
| `color-primary` | #006B5B | Main CTA and links, white text |
| `color-primary-hover` | #005448 | Hover/pressed emphasis |
| `color-primary-soft` | #E5F3EF | Selected surfaces with dark text |
| `color-danger` | #B42318 | Error/destructive text, white on filled destructive button |
| `color-danger-soft` | #FDECE9 | Error supporting surface |
| `color-warning-text` | #8A4B00 | Stale/pending warning text |
| `color-warning-soft` | #FFF3D6 | Warning background; no white text |
| `color-success` | #166534 | Paid/completed text |
| `color-success-soft` | #EAF6EE | Success background |
| `color-info` | #174EA6 | Demo/info text |
| `color-info-soft` | #EAF1FD | Test-mode disclosure |
| `color-focus` | #2457D6 | 3 px keyboard outline with 2 px offset |
| `color-route` | #006B5B | Route polyline, 5 px stroke with white casing |

Verify actual token/component combinations against WCAG 2.2 AA contrast before release: normal text at least 4.5:1; large text/UI boundary at least 3:1. Light borders are decorative boundaries, not the sole focus indicator. Status colors always include text/icon.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px, named `space-1` through `space-8`. Do not add arbitrary near-duplicate spacing. Radius: input/button 10 px, card 16 px, large sheet/dialog 20 px, pill 999 px only for badges. Shadow subtle `0 4px 20px rgba(20,33,41,0.07)` for elevated panel; borders for normal cards. Avoid large diffuse shadows under every row.

Typography: self-host a pinned open-license Inter font via the framework font tooling; system sans fallback. Size/line height: display 36/44 weight 650–700; page title 28/36 650; section 20/28 600; body 16/24 400; controls 15/22 600; caption 13/20 400. Mobile page title 24/32 and display 30/38. Minimum user-facing text 12 px, including attribution. Money 28/36 semibold with tabular numerals; detailed amounts 16/24. Use sentence case, not all-caps panels. No more than three font weights per screen.

## Layout and responsive behavior

| Width | Shell | Booking/trip layout | Lists/forms |
|---|---|---|---|
| 320–767 px | 56 px header; 64 px bottom nav + safe area | Map 38–45dvh; details below in scrollable document, sticky primary action above nav | Single column; tables become labelled records; 16 px gutters |
| 768–1023 px | 64 px header; compact 80 px sidebar or top role nav | Booking panel 340 px beside map if room, otherwise stacked | 24 px gutters; forms max 560 px |
| ≥1024 px | 240 px sidebar; 72 px top header | Booking panel 380 px; map remaining width; trip details 400 px | Content max 1440 px; 32 px gutters; admin tables |

Use dvh and safe-area insets; never hide primary CTA under phone chrome/keyboard. Avoid a rigid full-height scroll trap: details must be scrollable while map height remains useful. Map attribution stays visible outside sheet coverage. At 200% zoom and 320 px no horizontal page scroll, except intentionally pannable map. At 360 px the full booking form, selected addresses and one CTA fit without tiny text. Test the keyboard opening address/PIN/reply inputs.

Desktop booking is a purposeful two-column workspace. History/help/profile pages use normal constrained content; do not force every page into a map layout. Dialog width 480 px max; long dialogs scroll internally with footer reachable. Mobile modal becomes a full-width bottom sheet, max-height 85dvh, with a visible Close button; dragging is an optional convenience, never the only way to close. No swipe-only actions.

## Component specifications

| Component | Style and variants | Interaction/state requirements |
|---|---|---|
| Primary button | Teal fill/white text; min height 48 px; padding 16–20 px | Hover/pressed, 3 px focus, disabled neutral fill, loading spinner + action label; constant width while loading |
| Secondary button | White, dark text, visible border | Same touch/focus size; no faint clickable text |
| Destructive button | Danger fill only in confirmation | Keep/Cancel secondary visible; first focus on safe option |
| Text input | Height ≥48 px; label above; 12 px inset; 10 px radius | Helper/error below; red border + error icon/text; never placeholder-only labels |
| Address combobox | Pickup circle/destination square icon; two-line selected address | Accessible listbox, selected suggestion/check icon, loading, no-results, keyboard focus; preserve full address in detail |
| Card | White, border, 16 px radius, 24 px desktop/16 px mobile padding | Clickable cards have explicit affordance and keyboard action; no card-wide nested link ambiguity |
| Ride row | Endpoint pair, timestamp, price, stage/payment | Two-line labels; consistent badges; row focus; full detail on open |
| Status badge | Small icon + text, muted tinted surface | searching neutral; assigned/info; in_progress/teal; completed/success; cancelled/neutral; failed/danger |
| Payment badge | Separate from trip badge | A completed trip can display Payment pending; never equate green trip badge to paid |
| Step timeline | Vertical stages with labels/time | Completed check, active ring, upcoming neutral; include textual current state |
| Driver summary | Initials 48 px, display name, rating, vehicle/plate | "New driver" for no rating; no default 5-star value |
| Quote fare panel | Large price, compact itemized breakdown | Fixed-fare description; expiration persistent; no hidden fees |
| PIN field/card | Four digits, 4 × 48 px or single accessible numeric input | Show/hide; no admin visibility; error/cooldown; don't announce PIN automatically |
| Map markers | Pickup circle, destination square, driver car arrow | Shapes and labels distinguish without color; stale driver becomes muted; no unrelated driver markers |
| Toast | Compact, max 400 px | Polite announcement, optional dismissal; not sole financial confirmation |
| Banner | Inline full-width message, small icon | Offline, stale GPS, sandbox, access-sync pending are persistent and specific |
| Empty state | Icon, direct title, one explanatory sentence, working CTA | No decorative chart; copy describes how records will appear |
| Skeleton | Matches actual layout in muted surface | aria-busy; reduced-motion static; timeout offers retry |
| Support thread | Plain-text messages, actor/date, distinct alignment | Long words wrap; no HTML; reply errors preserve draft |
| Table | Readable header, 16 px cell padding, row borders | Sort/filter only if implemented; mobile labelled cards; pagination footer |

Small icon-only controls require a visible tooltip on desktop and accessible name; minimum target 44 × 44 px. Lucide outline icons use 20 px controls, 24 px navigation, 1.75–2 px stroke. Decorative icons hidden from assistive tech.

## Dashboard structure

Passenger: greeting and service-area text, booking/map workspace, active/unpaid ride card replacing new booking when locked, then up to three actual recent rides. Avoid spending charts, wallets, destination recommendations and fabricated nearby counts.

Driver: availability header first, active trip card second, actionable offer list third, then two compact metrics (today's completed trips and captured test earnings). Pending earnings is visually separate. Online state uses text and indicator; no color-only toggle. GPS and simulation disclosures appear next to availability.

Admin: four linked operational counts, recent attention items, no speculative financial dashboard. Driver approvals and support occupy primary navigation. Financial data read-only; reconcile action communicates server verification.

## Motion and maps

Button/focus transitions 120–160 ms; sheet open/close 200 ms ease-out; route loading subtle only. Respect prefers-reduced-motion; remove map fly animations, shimmer and movement interpolation. Driver marker interpolation may last at most one second between actual successive samples, never beyond last sample or across stale gaps. Searching animation indicates waiting, not location. Do not automatically recenter while user pans; **Recenter** restores fitted route. Loading a new trip initially fits endpoints and assigned driver with padding for panel/nav. Attribution cannot be cropped.

Map is an enhancement: textual endpoints, distance, duration, fare and trip stage are always available. Address search, selected point confirmation and quote validation are keyboard accessible without manipulating map. Route geometry is subordinate to actionable details. No road-route line when provider routing fails; an explicitly labelled endpoint preview may show points only.

## UX copy and principles

Use concrete actions: **Get fare**, **Request Economy**, **Keep ride**, **Confirm cancellation**, **Start ride**, **Pay ₹115**, **Check payment status**, **Download receipt**. Avoid "Submit" without context, generic "Oops", internal error codes as primary text and promises of instant support.

Tell users what is saved and what to do next. "Your ride request is saved. We're reconnecting to drivers" is appropriate after dispatch failure. "Payment verified" only after captured confirmation. "Location last updated 40 seconds ago" is better than a live badge on stale data. Show quote total before request, payment total before checkout, and zero cancellation fee before confirmation. Keep the same terms across all documents: passenger-facing "ride", driver-facing "trip", internal `Ride`; passenger is never called a driver.

Persist drafts only as needed: location form may store coordinates/labels in sessionStorage for the current browser tab, cleared on sign-out/expiry; do not store auth secrets or trip PIN there. Form errors should not erase valid values. Optimistic presentation is allowed for a local selected input, not assignment, trip advancement, capture, approval or ledger balance.

## Accessibility and QA

Semantic headings/landmarks, skip-to-content, logical focus order, labels, error associations, 44 px targets, keyboard-complete dialogs and comboboxes. On route change focus page heading; on modal close return to trigger. Announce trip stage changes politely, no repeated location announcements. Money uses clear currency labels; star buttons are radio options. PIN hidden state remains accessible without reading secret aloud unprompted. Lists paginate with buttons rather than scroll-only fetching. Test NVDA/VoiceOver where available, keyboard-only, reduced motion, 200% zoom, high-contrast and 320/360/390/768/1024/1440 widths.

Visual completion requires screenshots of landing, booking review, active ride, payment success, driver dashboard/trip, history, admin queues, every important error/empty/loading state and mobile variants. Check actual content length, keyboard, attribution, dialogs and failed maps; screenshot review is not just a build check.

## Visual references and boundaries

Use [Leaflet's official examples](https://leafletjs.com/examples.html) for interaction capabilities, and [Geoapify map documentation](https://apidocs.geoapify.com/docs/maps/) for tile integration. These are functional references, not a ready-made product design. Uber/Rapido-style workflows mentioned in the source are conceptual references for pickup/destination and a primary ride action; do not clone their typography, logo, branded palette or screens. No specific Figma/reference deck has been supplied or inspected. The tokens and screen layouts here are the proposed visual authority; an AI builder must not invent a different theme halfway through implementation.

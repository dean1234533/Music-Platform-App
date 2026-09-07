# Security, privacy, and production-readiness audit

Date: 2026-09-07. Scope: full codebase (`src/`, `functions/src/`, `firestore.rules`,
`storage.rules`, Stripe integration, Cloudflare deployment config, PWA/service
worker). Method: six parallel code-reading passes (Firestore rules + IDOR,
Storage rules + uploads, XSS/secrets/logging, Stripe/webhooks/race conditions,
PWA/service worker, admin/auth/rate-limiting), followed by fixes for every
finding that was safely fixable in code, and this write-up.

**This document does not claim the system is "100% secure" or "fully GDPR
compliant."** It states what was found, what was technically fixed, and what
still depends on a Firebase/Cloudflare/Stripe console action, a legal/DPO
decision, or manual testing this session couldn't perform. See
`COMPLIANCE_CHECKLIST.md` for the compliance-specific breakdown and
`SECURITY_INCIDENT_RESPONSE.md` for the incident workflow this audit's
breach-register work feeds into.

## 1. Executive summary

The core security architecture was already sound before this audit: every
sensitive Firestore field (`roles`, `subscriptionStatus`, `paidAt`,
`legalHold`, agreement signatures, balances, admin-only collections) is
locked to server-only writes, every licensing/payment/messaging callable
independently verifies `request.auth.uid` against the resource it's
acting on (no IDOR/BOLA found anywhere), and there is no path — client or
server — that can grant a user the `admin` role. No `dangerouslySetInnerHTML`,
no exposed secrets in source or git history, no committed credentials.

What this audit found and fixed: two real Stripe race conditions that could
double-credit an artist's balance or trigger a double payout transfer, a
complete absence of refund handling, two Storage-rule gaps (an unscoped
copyright-evidence write, and SVG uploads enabling a stored-XSS path via the
admin evidence viewer), a service-worker cache rule that could serve
access-controlled images past their entitlement window, zero rate-limiting
or abuse controls anywhere in the app, no deployed security headers, no PWA
install-prompt UI despite the manifest/icons already existing on disk, and a
password policy that only enforced Firebase Auth's default 6-character
minimum. All of these are now fixed in code (see §2 and the per-item detail
below). A handful of items — MFA, Firebase App Check, HIBP breach-password
checking, Identity Platform's server-side password policy, Cloudflare-level
rate limiting, and all legal wording — remain and are explicitly called out
as requiring a console action or professional review, not implemented here.

## 2. Findings and fixes, by severity

Each item: severity, what was found, the file(s) it lives in, and what was
done about it.

### CRITICAL

None found. This is stated plainly rather than omitted — six independent
audit passes across auth, rules, storage, payments, and abuse surfaces
found no critical (immediately exploitable, high-impact) issue.

### HIGH

1. **No refund handling anywhere** (`functions/src/stripe/webhook.ts`). If a
   Stripe subscription or DJ-licence payment was refunded via the Stripe
   Dashboard/API, nothing reversed the corresponding `artistBalances`
   credit — an artist could keep (and even pay out) money for a refunded
   charge. **Fixed**: added a `charge.refunded` handler that reverses the
   credit from `pendingMinor` first, then `availableMinor`; if funds were
   already paid out, it logs an `auditLogs` entry for manual reconciliation
   instead of silently pushing a balance negative. **Known gap**: this only
   matches DJ-licence payments (via a newly-recorded `stripePaymentIntentId`
   on the transaction). Subscription-income transactions don't currently
   record a payment intent ID, so a refunded subscription invoice is **not**
   automatically reversed — flagged rather than silently assumed covered.
   **REQUIRES STRIPE DASHBOARD CHANGE**: the webhook endpoint must be
   configured to send `charge.refunded` events (it isn't required to today).

2. **No security headers deployed at all** — no CSP, HSTS,
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or
   frame-blocking anywhere in the Cloudflare deployment. **Fixed**: added
   `public/_headers` (Cloudflare Pages/Workers-assets convention, copied
   into `dist/` at build time) with a CSP built from the app's actual
   dependencies (Firebase Auth/Firestore/Storage domains, Google profile
   photos, no third-party scripts since none are loaded), `X-Frame-Options:
   DENY` + `frame-ancestors 'none'`, HSTS with `preload`, and the rest.
   `style-src` allows `'unsafe-inline'` deliberately (React inline `style=`
   attributes are used for progress-bar widths etc.) — `script-src` does
   not.

3. **Service worker cache rule matched cross-origin Storage URLs by file
   extension** (`sw-src/sw.ts`). The `CacheFirst` image route matched any
   URL whose *pathname* ended in an image extension, with no origin check —
   this included Firebase Storage download URLs for access-controlled paths
   (copyright evidence, licence-signature images), which could then be
   served from the device's cache for up to 30 days after the underlying
   Storage-rule/token access was revoked. **Fixed**: the route now also
   requires `url.origin === self.location.origin`, so only same-origin
   (bundled/public) assets are cached; cross-origin Storage content is never
   cached by the service worker.

### MEDIUM

4. **Two Stripe race conditions** (`functions/src/stripe/webhook.ts`,
   `functions/src/payouts/requestPayout.ts`):
   - `checkout.session.completed` read `paidAt`, then wrote via a plain
     batch — two concurrent deliveries of the same event (Stripe explicitly
     documents at-least-once, possibly-duplicate delivery) could both pass
     the null check and both credit the artist's balance. **Fixed**: the
     entire read-check-write is now one `db.runTransaction`, which Firestore
     serializes against a concurrent transaction on the same document.
   - `handleInvoicePaid`'s per-artist idempotency check had the same
     read-outside/write-inside-a-batch shape. **Fixed**: each artist's
     credit is now its own transaction.
   - `requestPayout` read the available balance, called Stripe, and only
     *then* decremented the balance — a double-click (or two concurrent
     calls) could both read the same balance and both trigger a real Stripe
     transfer before either decrement landed. **Fixed**: the balance is now
     reserved (decremented + a `payoutInFlight` flag set) inside one
     transaction *before* Stripe is ever called; a concurrent call sees the
     flag or the already-reduced balance and is rejected before any transfer
     happens. If the Stripe call itself fails, the reservation is reverted.

5. **`copyrightEvidence/{claimId}/{fileName}` Storage write was unscoped**
   (`storage.rules`). Any signed-in user — not just the claim's own
   reporter — could write into an *existing* claim's evidence folder
   (the read rule already correctly restricted to reporter/artist/admin,
   but the write rule didn't). **Fixed**: write now additionally requires
   either the claim doesn't exist yet (the normal upload-before-create
   ordering, matching the `licenceSignatures` pattern already used
   elsewhere) or the caller is that claim's `reporterId`.

6. **SVG uploads allowed everywhere images were** (`storage.rules`), which,
   combined with the admin claim-review UI opening `evidenceUrls` directly
   in a new tab, is a stored-XSS vector scoped to the Storage origin (an
   attacker-crafted SVG with embedded script, uploaded as "evidence",
   executed when an admin opens it). **Fixed**: `isImage()` now only matches
   `image/jpeg`, `image/png`, `image/webp`, `image/gif` — no legitimate
   upload path in this app (artwork, avatars, story media, evidence) needs
   vector graphics.

7. **No Firebase App Check anywhere.** Every callable and Firestore/Storage
   access is reachable by anyone presenting a valid Firebase Auth token,
   with no attestation that the request came from the real app rather than
   a script. **Not fixed in code** — App Check is a Firebase Console
   enrollment (reCAPTCHA v3 or App Attest/Play Integrity provider
   registration) plus a client SDK initialization step that needs a real
   site key issued for the production domain, which this session cannot
   generate. **REQUIRES FIREBASE CONSOLE CHANGE.**

8. **No rate-limiting anywhere** — signup, login, password reset, chat
   messages, DJ requests, copyright claims, and preview-play counting all
   had zero volume control beyond Firebase Auth's own built-in throttle.
   **Fixed** for the callables that matter most: `sendMessage` (30/minute
   per user), `submitLicenceRequest` (20/hour per DJ),
   `submitCopyrightClaim` (5/hour per user), and `recordPreviewPlay`
   (120/minute per track, keyed by track since anonymous preview playback
   is intentionally allowed — see `functions/src/rateLimit.ts`, a small
   Firestore-transaction-backed fixed-window limiter, cleaned up daily).
   **Not fixed**: signup/login/password-reset rate limiting is Firebase
   Auth's own responsibility (`auth/too-many-requests`) — there is no
   Cloudflare-level HTTP rate limiting configured for those endpoints
   either, since browser calls to Firebase Auth go directly to Google's
   Identity Toolkit API, not through this app's Cloudflare deployment, so
   Cloudflare rules can't intercept them. **REQUIRES FIREBASE CONSOLE
   REVIEW** (Identity Platform has additional configurable abuse protection
   beyond the legacy Auth defaults).

9. **No PWA install-prompt UI existed** despite proper 192/512/maskable
   icons already sitting unused on disk and a valid manifest otherwise.
   **Fixed**: added `src/lib/installPrompt.ts` (captures `beforeinstallprompt`
   at module scope, before React even mounts), `useInstallPrompt` hook, and
   an `InstallBanner` shown to every authenticated role — fan, artist, DJ,
   **and admin** (there is no role exclusion) — after login, suppressed
   once already running standalone and for 7 days after "Not Now." iOS gets
   Share → Add to Home Screen instructions since `beforeinstallprompt`
   doesn't fire there. Manifest now also references the existing
   192/512/maskable PNGs (previously only an SVG "any" icon was listed) and
   `index.html` now has an `apple-touch-icon` link. A manual "Settings →
   Install App" entry point was added to the fan settings page; extending
   the same entry point to the artist/DJ/admin settings pages is a
   reasonable small follow-up not done here (the automatic banner already
   reaches every role).

10. **Password policy only enforced Firebase Auth's default 6-character
    minimum**, with no common-password rejection and no strength feedback.
    **Fixed**: `src/utils/passwordPolicy.ts` enforces a 12–64 character
    range and rejects a local common-password blocklist (the exact list
    from the audit brief plus common variants) on signup and password
    change; `PasswordStrengthMeter` (dynamically-imported `@zxcvbn-ts/core`,
    so the ~1.2MB dictionary isn't in the main bundle) shows a
    Weak/Fair/Good/Strong meter. **This is client-side defense-in-depth
    only** — trivially bypassed by calling the Firebase Auth API directly.
    Real server-side enforcement needs Identity Platform's password policy;
    added `adminEnableStrongPasswordPolicy` (admin-only callable, Admin
    Settings → Password policy) that sets a server-side 12–64 character
    minimum via `projectConfigManager().updateProjectConfig()` — but this
    requires the Firebase project to already be upgraded to Identity
    Platform. **REQUIRES FIREBASE CONSOLE ACTION** (Authentication →
    Settings → upgrade to Identity Platform) before that callable will
    succeed, and then one admin click to run it.
    Composition rules (uppercase/number/symbol requirements) were
    deliberately **not** added — the brief itself prefers length +
    common-password rejection over rules that push people toward
    predictable substitutions.

11. **Have I Been Pwned / breach-password checking not implemented.**
    Deliberately deferred, not silently skipped: HIBP's k-anonymity range
    API is the right way to do this without ever sending a full password
    off-device, but it does mean a partial hash prefix leaves the browser
    on every signup/password-change, which is a real third-party data flow
    that needs a privacy decision before shipping. **REQUIRES LEGAL /
    PRIVACY REVIEW BEFORE PRODUCTION** if added. The local blocklist above
    covers the obvious cases in the meantime, matching the brief's own
    fallback instruction ("if this external dependency is not implemented
    now, create a local blocklist").

12. **MFA not implemented; no architecture for it either.** Firebase Auth
    supports phone-based MFA, but enrolling it needs a phone number
    collection flow, SMS provider cost, and (for admin accounts
    specifically, which is what actually matters here) a decision about
    whether to *require* it. **Not implemented.** **REQUIRES PRODUCT +
    FIREBASE CONSOLE DECISION BEFORE PRODUCTION**: admin accounts should
    require MFA before this app handles real user data at scale; flagging
    this explicitly rather than leaving it implicit.

### LOW

13. **Hardcoded Firebase Web API key fallback** (`src/lib/firebase.ts`,
    `sw-src/sw.ts`) when the `VITE_FIREBASE_*` env var is unset. Not a
    credential leak — Firebase web API keys aren't secrets, they're
    restricted by Security Rules/App Check, not by secrecy — but it's poor
    hygiene (couples the code to one project, two places that can drift).
    **Not changed** — low value relative to risk of breaking local dev for
    anyone relying on the fallback; recommend removing it and failing fast
    instead, as a follow-up.

14. **`recordPreviewPlay` had no auth check**, allowing unlimited anonymous
    calls to inflate `playCount` (a vanity metric, not tied to money).
    **Fixed** via the per-track rate limit in item 8 — an auth requirement
    was deliberately *not* added, since anonymous preview playback is a
    real, intended use case.

15. **No email verification gating** on any sensitive action (upload,
    payout request, copyright claim, contract signing). **Not fixed** —
    this is a product decision (would an unverified email block real users
    from onboarding?) as much as a security one; noted for consideration,
    not changed unilaterally.

16. **Admin role is a Firestore document field, not a Firebase Auth custom
    claim.** Verified safe today — every write path is blocked (`roles`
    updates are pinned to `['fan','artist','dj']` in `firestore.rules`, and
    no Cloud Function ever writes `'admin'` into that field) — but it's a
    single-layer control: the entire admin boundary rests on one rules
    clause never regressing, with no independent custom-claims backstop.
    **Not changed** — migrating to custom claims is a bigger, riskier change
    to a system that currently works correctly, which the brief explicitly
    says not to do "just for stylistic reasons." Recommended as a future
    hardening step, not a bug fix.

17. **Contract/signature integrity had no explicit content fingerprint.**
    Terms were already frozen and server-only-writable (a real client could
    never forge `signed: true`), but there was no independent way to
    detect a hypothetical future code bug that mutated terms in place after
    generation. **Fixed**: `functions/src/licensing/agreements.ts` now
    computes a SHA-256 `contentHash` over the canonicalised terms when an
    agreement is created/versioned, records it, and `signAgreement`
    recomputes and compares it before accepting a signature — an agreement
    whose stored terms don't match its own hash is refused rather than
    signed. The acceptance log records which `agreementContentHash` a
    signature was made against.

## 3. Mobile UX issues (reported directly, fixed alongside the audit)

Not part of the original audit scope, but reported mid-session and fixed
because they were quick, real bugs:
- **Mobile bottom nav didn't scroll**, so a role with more than ~5 items
  (artist, DJ, admin) rendered unreadably compressed tabs with no way to
  reach the rest. Fixed: `MobileNav` now scrolls horizontally
  (`overflow-x-auto`) instead of squeezing everything into equal-width
  columns, and the artist dashboard's mobile nav no longer truncates to 5
  items (it can just scroll to the rest now).
- **No sign-out reachable from the mobile nav** on any role. Fixed: a
  "Sign out" button is now pinned at the end of the mobile nav bar,
  independent of each role's item list.
- **Page zoomed in when tapping a text field on mobile** — the classic iOS
  Safari behavior of auto-zooming the viewport when a focused input's
  computed font size is under 16px. All shared form fields (`Input`,
  `TextArea`, and the `<select>` dropdowns that repeated the same pattern)
  now render at 16px below the `sm:` breakpoint and shrink back to the
  existing 14px on larger screens, where the zoom doesn't trigger.

## 4. Confirmed-clean (verified, not assumed)

Listed explicitly so "no finding" isn't confused with "not checked":
- No `dangerouslySetInnerHTML` anywhere in `src/`, `functions/src/`,
  `worker/`, or `sw-src/`.
- No hardcoded Stripe/Firebase-admin secrets, service-account JSON, or
  private keys in tracked source, `.env.example`, or git history.
- `vite.config.ts` does not enable production source maps.
- Stripe secret key and both webhook secrets are read from Firebase
  Functions secrets (`defineSecret`), never embedded in client code; the
  Stripe SDK is a functions-only dependency, not in the client bundle.
- Every price/fee/amount used in a Stripe charge or Firestore balance
  write is read server-side from Firestore, never trusted from
  `request.data` (checked `createCheckoutSession`,
  `createLicencePaymentSession`, `updateSupportAllocations`,
  `adminUpdatePlatformSettings`).
- The Stripe Connect destination account is always looked up server-side
  by `request.auth.uid`, never client-supplied.
- Webhook signature verification is correctly implemented on both
  `stripeWebhook` and `stripeConnectWebhook` (raw body, no body-parser
  middleware intercepting it, secrets from Functions secrets).
- No IDOR/BOLA found in any of `submitLicenceRequest`,
  `respondToLicenceRequest`, `sendOffer`/`counterOffer`/`acceptOffer`/
  `withdrawOffer`, `signAgreement`, `getSecureDownloadUrl`, `sendMessage`,
  `deleteAccount`, `exportUserData`, or any `requireAdmin`-gated callable —
  every one loads the resource server-side and checks the caller against
  it.
- No client or server path exists that can grant a user the `admin` role.
- `getSecureDownloadUrl` re-validates auth, role, agreement ownership,
  status, payment, legal hold, revocation, and expiry before issuing a
  5-minute signed URL; original track files have no other read path.
- No collection referenced anywhere in the codebase is missing a
  `firestore.rules` match block (no accidental default-deny/default-allow
  surprises).
- No `AppCheck`/`customClaims` setup was silently assumed — both are
  correctly reported as absent (items 7, 16) rather than glossed over.

## 5. Firebase/Cloudflare/Stripe console changes required

These cannot be done from code in this session — they need dashboard
access:

- **Firebase**: upgrade the project to Identity Platform, then run "Enable
  strong password policy" from Admin Settings (item 10). Enable Firebase
  App Check (item 7) with a real reCAPTCHA v3/App Attest site key for the
  production domain, and enforce it on Firestore/Storage/Callable
  Functions. Consider enabling MFA enrollment for admin accounts (item 12).
- **Stripe**: add `charge.refunded` to the `stripeWebhook` endpoint's
  subscribed events (item 1).
- **Cloudflare**: verify `public/_headers` is actually being served in
  production (Workers-assets should honor it automatically via the
  `dist/` output, but confirm with a live response-header check after
  deploy) — item 2. Consider Cloudflare-level rate limiting on any
  endpoint that *does* route through this Worker (the crawler/OG-unfurling
  path in `worker/share-og.ts`), though the main abuse surface (Firebase
  Auth, Firestore, Callable Functions) doesn't route through Cloudflare at
  all and can't be rate-limited there.

## 6. Items requiring legal/privacy review

- HIBP breach-password checking (item 11), if added later — a third-party
  data flow needs sign-off first, even under k-anonymity.
- The suggested data-retention periods documented in
  `platformSettings/dataRetention` and rendered on `/privacy` (see the
  earlier account-deletion/retention work) — technical defaults, not legal
  advice.
- All Terms/Privacy/Copyright Policy/DJ-licence wording — see
  `COMPLIANCE_CHECKLIST.md`.
- The refund-reconciliation gap for subscription income (item 1) — worth a
  business decision on how much manual-reconciliation risk is acceptable
  before this is closed properly (e.g. by also recording payment-intent
  IDs on subscription transactions).

## 7. Items requiring manual testing

Not exercised in this session (no live Firebase project/emulator was
available to run against):
- End-to-end: sign up with a common password (`password123`) and confirm
  the client-side blocklist rejects it; confirm the server-side policy
  (once Identity Platform is enabled) independently rejects a sub-12-char
  password sent directly to the Auth API.
- Delete a test account with an active signed licence agreement and
  confirm the agreement, its acceptance log, and the DJ's download history
  survive while the artist's profile/tracks are correctly offboarded.
- Trigger each scheduled cleanup function (`functions/src/retention/
  cleanup.ts`) against seeded stale data in the Firebase Emulator Suite.
- Set a legal hold via the new admin UI and confirm a cleanup job skips
  the held record.
- Install the PWA on Android Chrome, iOS Safari, and desktop Chrome;
  confirm the banner doesn't reappear for 7 days after dismissal and never
  appears once installed (standalone display mode).
- Load the production site with browser devtools open and confirm the CSP
  in `public/_headers` doesn't block anything real (Firebase Auth popup,
  Firestore/Storage requests, Stripe Checkout redirect) — this was
  reasoned through from the actual dependency list, not tested against a
  live CSP report-only deployment.
- Concurrency-test `requestPayout` and the checkout webhook fix (item 4)
  with genuinely parallel requests, not just sequential ones — the fix is
  correct per Firestore's transaction semantics, but hasn't been load-
  tested.

## 8. Firestore/Storage rules coverage

Every collection referenced anywhere in `src/`/`functions/src/` has a
corresponding `firestore.rules` match block (verified by cross-referencing
every `.collection(...)` call against the rules file). New collections
added in this pass (`rateLimits`, `securityIncidents`) are both
`allow read, write: if false` — Cloud-Function-only. No emulator-based
automated rule test suite exists yet (see §7's manual-testing note and the
"Firebase rule tests" section this document doesn't check off — that would
need `@firebase/rules-unit-testing` wired into a test runner, which is a
reasonable follow-up rather than something done in this pass).

## 9. Final build/test results

```
$ npm run build          # tsc -b && vite build  → PASS, 0 errors
$ npm run lint           # oxlint                → PASS, pre-existing warnings only, no new categories
$ cd functions && npm run build   # tsc          → PASS, 0 errors
$ npm audit                        (root)        → 0 vulnerabilities
$ cd functions && npm audit                       → 11 moderate (see below)
```

**Functions dependency vulnerabilities**: 11 moderate-severity advisories,
all transitive through `firebase-admin`'s own dependency tree (`qs` →
`body-parser`/`express`; `uuid` → `gaxios`/`google-gax`/`teeny-request` →
`@google-cloud/firestore`/`@google-cloud/storage`). `npm audit fix`
(non-breaking) resolves none of them — the only available fix path is
`npm audit fix --force`, which would bump `firebase-admin` to a new major
version (14.x). Per this audit's own instruction not to force breaking
upgrades blindly, **this was not applied**. These are moderate-severity
issues in Google's own SDK internals (a `qs` parsing DoS/bypass and a
`uuid` buffer-bounds issue), not directly reachable through this app's own
code paths as used here — but they should be addressed deliberately: bump
`firebase-admin` in a dedicated change, re-run the full test/build suite,
and smoke-test the emulator before deploying. **REQUIRES A DEDICATED
DEPENDENCY-UPGRADE PASS**, not bundled into this audit.

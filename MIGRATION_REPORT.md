# BackTheVibes migration report — 2026-09-12

This documents the migration carried out in this session, on top of the pre-existing
5-phase application described in `README.md` / `PRODUCT_FLOW.md`. It follows the
structure requested by the migration brief. Branch: `claude/dreamy-goodall-5yfbqe`.

Sections below are explicitly labelled **IMPLEMENTED**, **REQUIRES MANUAL
CONFIGURATION**, or **REQUIRES LEGAL/COMPLIANCE REVIEW**. Nothing here should be read
as a claim of legal compliance — the technical migration and legal/compliance sign-off
are separate things.

## 1. What was kept

- Overall branding, navigation, layout, and page structure (landing page, Discover,
  artist/DJ profiles, dashboards, admin, notifications, moderation, account settings).
- Firebase Auth, Firestore, Storage, Cloud Functions, Cloudflare Workers/Pages hosting.
- Fan/artist/DJ/admin role architecture, one-role-per-account enforcement, admin-only
  role changes.
- Artist Membership (flat annual subscription for publishing) — unchanged.
- The DJ/business proposal system (`licenceRequests` → negotiation → `licenceAgreements`
  with e-signatures, versioning, PDF export via print) — kept as the collaboration/deal
  workspace per spec section 19 ("do not redesign the entire deal section").
- Copyright claim review workflow, admin moderation, verification queues, audit log.
- Firestore/Storage rules architecture (money/roles/moderation server-authoritative
  only) — extended, not rearchitected.
- Existing test suite structure (`tests/flow-contracts.test.mjs`,
  `tests/firestore-rules.test.mjs`) — updated in place rather than replaced.

## 2. What was modified

- Track entitlement ladder (public/followers/supporters/dj_only/private/early_access) —
  same tiers, now gating a YouTube video ID's disclosure instead of a signed audio URL.
- "Supporter" status — now means "has a `supportRelationships` doc" (a real one-off
  payment), not "has an active recurring subscription".
- DJ/business licence payments — same negotiation/agreement flow, payment mechanism
  changed from Stripe Checkout + internal balance to a Stripe Connect destination charge.
- Admin Settings — fee percentages retitled/repurposed for the new model; obsolete
  preview-duration/upload-limit/payout-minimum fields removed.
- Terms, Privacy, Copyright Policy, and the DJ agreement disclaimer — content rewritten
  for the new architecture (see section 17).
- `worker/share-og.ts` crawler-facing marketing copy (home/pricing/for-artists) updated
  to match the new fee structure; extended with a new public JSON API route.

## 3. What was removed

**Hosted audio (Phase 1 of this session):**
- Client-side audio compression/derivation (`src/services/audioProcessing.ts`, the
  `@ffmpeg/ffmpeg` and `@ffmpeg/util` dependencies).
- `functions/src/tracks/onOriginalUploaded.ts` (SHA-256 duplicate-hash detection on
  uploaded masters).
- All hosted-audio Storage paths and their rules: `artists/{id}/originals/`,
  `.../streaming/`, `.../previews/`, `.../dj-previews/`.
- `TrackDoc` fields: `originalAudioPath`, `streamAudioPath`, `previewAudioPath`,
  `djPreviewAudioPath*`, `previewEnabled/StartSec/DurationSec`, `fileHash`, `fileSize`,
  `mimeType`, `hashCheckedAt`, `possibleDuplicateOfTrackId`, the granular
  preview/full/DJ/supporter play-count breakdown fields (collapsed to one `playCount`).
- The master-audio DJ download endpoint's actual file transfer
  (`functions/src/licensing/downloads.ts` now always returns HTTP 410 with an
  explanation — the route/auth surface is kept so old links fail clearly rather than
  breaking silently).

**Payment/revenue architecture (Phase 2):**
- `supportAllocations` collection, `updateSupportAllocations` callable, the whole
  "subscribe once, allocate monthly across followed artists" UI.
- `artistBalances`, `payouts`, `billingSettlements` collections.
- `functions/src/support/allocations.ts`, `functions/src/payouts/requestPayout.ts`,
  `functions/src/payouts/promoteBalances.ts` (the pending→available clearing job).
- The paid `fan_supporter` subscription plan (retired via `LEGACY_PLAN_IDS`).
- `PlatformSettings.minimumPayoutMinor` and the already-dead
  `allowedPreviewDurationsSec`/`maxUploadSizeMB`/`supportedAudioTypes`/
  `defaultPreviewDurationSec` fields.

## 4. What was replaced

| Old | New |
|---|---|
| Client-compressed hosted audio (original/stream/preview) | A validated YouTube link (`youtubeVideoId`/`youtubeUrl`), played via the official YouTube IFrame Player API |
| `getTrackPlaybackUrl` (signed Storage URL) | `getTrackYoutubeInfo` (discloses a video ID after the same entitlement check) |
| Direct client `setDoc` for track creation | `createTrack` Cloud Function (needed to also write `trackMedia`, a doc no client can read) |
| Recurring fan "Supporter" subscription + monthly allocation | One-off Stripe Connect destination-charge payment to one artist (`createSupportCheckoutSession`) |
| DJ licence fee → Stripe Checkout → internal `artistBalances` credit | DJ licence fee → Stripe Checkout with `payment_intent_data` set for a destination charge, paid directly to the artist |
| `RevenuePage` pending/available/paid balance + "Request payout" | Read-only transaction history + "Open Stripe dashboard" (Stripe's own payout schedule) |
| `SubscriptionPage` (plan picker + allocation editor) | Support history ("Your support") |
| `SupportButton` → navigate to `/app/subscription` | `SupportButton` → `SupportModal` (amount picker, fee breakdown, direct Stripe Checkout) |

## 5. New Firestore schema (net changes)

- **New:** `trackMedia/{trackId}` — `{ youtubeVideoId, youtubeUrl }`, `allow read, write:
  if false` (Admin SDK only). Deliberately separate from `tracks/{trackId}` because
  Firestore has no per-field read rules and `tracks` is intentionally public-readable
  for locked-tier metadata (title/artwork/CTA) even when a viewer isn't entitled to the
  video ID.
- **Changed:** `tracks/{trackId}` — audio fields removed (see section 3); `allow create:
  if false` (was a validated direct client write; now server-only via `createTrack`).
- **Changed:** `transactions/{id}.type` is now `'artist_support' | 'dj_licence_income' |
  'artist_membership_income'` (was `'subscription_income' | 'dj_licence_income' |
  'payout'`); read rule now also allows the paying fan (`fanId`), not just the artist.
- **Removed collections:** `supportAllocations`, `artistBalances`, `payouts`,
  `billingSettlements`.
- **Unchanged in shape but reinterpreted:** `supportRelationships/{fanId_artistId}` — no
  longer created/deleted by allocation edits; now created once by the Stripe webhook on
  a real payment, and effectively permanent (no "unallocate").

## 6. Removed Storage paths

`artists/{artistId}/originals/`, `.../streaming/`, `.../previews/`, `.../dj-previews/`.
Retained: `artists/{artistId}/artwork/`, story media paths, profile images, copyright
evidence, licence signatures, user data exports.

## 7. Removed Cloud Functions

`onOriginalUploaded`, `updateSupportAllocations`, `requestPayout`,
`promotePendingBalances`. (`downloadLicensedTrack` is *retained* as an endpoint that
always responds 410 — not deleted, so old deep links fail with an explanation instead of
a broken route.)

## 8. Stripe Connect architecture — IMPLEMENTED

- Artists onboard via Stripe Connect Express (`createConnectOnboardingLink`,
  unchanged from the pre-existing implementation) — this session did not need to modify
  onboarding, only what happens *after* it.
- **One-off fan support** (`functions/src/support/checkout.ts`): Stripe Checkout in
  `mode: 'payment'`, with `payment_intent_data.application_fee_amount` (computed from
  `platformSettings.platformFeePercent`) and `transfer_data.destination` set to the
  artist's connected account ID — a standard Stripe Connect **destination charge**.
  Requires the artist's account to have `chargesEnabled`; blocked if `payoutHolds` is
  active for that artist. Amount bounded server-side (£1–£1,000) and validated as an
  integer; artist can't be the same account as the fan.
- **DJ/business licence payments** (`functions/src/stripe/licencePayment.ts`): same
  destination-charge mechanism, fee from `platformSettings.djServiceFeePercent`.
- **Webhook** (`functions/src/stripe/webhook.ts`): `handleSupportCheckoutCompleted` is
  idempotent on the Stripe Checkout Session ID (`support_${session.id}` as the
  `transactions` doc ID, checked inside a Firestore transaction before any write).
  Refunds (`charge.refunded`) update the transaction record only — no balance to reverse,
  since Stripe itself reverses the application fee and connected-account transfer
  automatically on a destination-charge refund.
- No internal balance, ledger, or payout queue anywhere. Artists' money is never held by
  BackTheVibes; Stripe pays out to the artist's bank on Stripe's own schedule.

## 9. Exact 20% commission implementation — IMPLEMENTED

- Single source of truth: `platformSettings/default.platformFeePercent`
  (`functions/src/platformSettings.ts`, `DEFAULT_PLATFORM_SETTINGS.platformFeePercent =
  20`), admin-editable only via `adminUpdatePlatformSettings` (Firestore rules:
  `platformSettings` is public-read, admin-write-only).
- Fee is computed **inside** `createSupportCheckoutSession`, server-side, from the
  admin-configured percentage — never accepted from the client, never hard-coded as a
  literal `20` anywhere in payment logic.
- Enforced through Stripe's own `application_fee_amount` mechanism, not a value
  BackTheVibes has to separately collect or reconcile.
- The `SupportModal` shows the fan the exact split (amount paid / platform fee / artist
  receives) before they're sent to Stripe Checkout.

## 10. YouTube implementation — IMPLEMENTED

- `src/utils/youtube.ts`: strict allowlist of URL shapes (`youtube.com/watch`,
  `youtu.be/`, `.../shorts/`, `.../embed/`, `youtube-nocookie.com/embed/`), each
  requiring an exact 11-character `[A-Za-z0-9_-]` video ID; anything else (including a
  markup-injection attempt) returns `null`.
- Playback: `src/lib/youtubeIframeApi.ts` + `PlayerContext.tsx` drive the real YouTube
  IFrame Player API; `src/components/player/YouTubePlayer.tsx` is the reusable
  click-to-load component used on the track detail page and available for reuse
  elsewhere.
- No autoplay: the IFrame Player's `playVideo()` call only ever fires from `onReady`,
  which only ever runs after the visitor has already pressed play in BackTheVibes' own
  UI.
- No hosted audio, extraction, caching, or proxying anywhere in the codebase (verified
  via `tests/flow-contracts.test.mjs`'s YouTube validation test, which asserts the
  absence of `originalAudioPath`/`streamAudioPath`/`previewAudioPath` and the `@ffmpeg`
  dependency).

## 11. YouTube privacy/consent implementation

- **IMPLEMENTED:** `youtube-nocookie.com` embed domain; click-to-load (no request to
  YouTube/Google until the visitor presses play); Terms/Privacy sections explaining
  YouTube playback and linking the relationship to Google's own privacy policy.
- **REQUIRES MANUAL CONFIGURATION:** no cookie-consent banner exists in this app at all
  (pre-existing, not introduced this session). If BackTheVibes' operating jurisdiction
  requires an active consent mechanism before *any* third-party content loads (some
  interpretations of the ePrivacy Directive go further than "click-to-load"), a consent
  banner should be added — this was out of scope for a code migration and needs a
  product/legal decision on the exact mechanism.

## 12. Deal/collaboration workflow

**IMPLEMENTED** (see section 1 — kept largely as-is per spec instruction not to
redesign it) plus, this session:
- `ContractPage.tsx`'s disclaimer now explicitly states BackTheVibes is not a party to
  the agreement, does not provide legal advice, does not guarantee legal sufficiency,
  that payment alone never grants a right not explicitly listed, and that parties may
  use an external e-signature/legal service.
- `downloadLicensedTrack` permanently disabled (see section 3) — master/stem exchange
  is explicitly stated to happen outside BackTheVibes in both the UI and Terms.
- Firestore rules confirmed to already scope `licenceRequests`/`licenceAgreements`/
  `licenceOffers` reads to the two named parties + admin (no public read, no IDOR).
- Confirmed no general-purpose chat exists anywhere in the app outside per-proposal
  negotiation events.

**REQUIRES MANUAL CONFIGURATION / future work (not done this session):** the "export
agreed terms" mechanism is the browser's native print-to-PDF over the rendered contract
page, not a generated document with a verifiable hash/signature block. This satisfies
"export for external legal review" functionally, but if a more formal export (e.g. a
generated, hash-stamped PDF) is wanted, that's a follow-up feature, not a bug fix.

## 13. WordPress plugin architecture — IMPLEMENTED

`wordpress-plugin/backthevibes/` — a self-contained WordPress plugin (PHP 7.4+, no
build step, no bundled JS framework beyond what WordPress core already ships):

- `backthevibes.php` — bootstraps four classes, each registering only its own hooks.
- `includes/class-backthevibes-api.php` — the only network-calling code in the plugin:
  one cached (`wp_remote_get`, 5-minute transient) read of BackTheVibes' own public
  artist API, with full server-side sanitisation of every returned field
  (`esc_url_raw`/`sanitize_text_field`/etc.) and a YouTube-host allowlist before any
  video ID is ever rendered.
- `includes/class-backthevibes-render.php` — the single HTML-building path shared by
  shortcodes and blocks; every dynamic value escaped at the point of output.
- `includes/class-backthevibes-settings.php` — Settings → BackTheVibes, storing one
  option (a public artist slug), gated by `manage_options` + the Settings API's own
  nonce handling.
- `includes/class-backthevibes-shortcodes.php` /
  `includes/class-backthevibes-block.php` — `[backthevibes_artist]`,
  `[backthevibes_support]`, `[backthevibes_music]` shortcodes, and matching
  server-rendered Gutenberg blocks (`blocks/*/block.json` + `render.php`), sharing the
  render class above.
- `assets/backthevibes.js` — click-to-load YouTube embed for the music grid (identical
  policy to the main site: nothing requested from YouTube until a click).
- No Firebase or Stripe credentials anywhere in the plugin. Follow/Support actions are
  outbound links to the artist's real BackTheVibes profile — the plugin never collects
  credentials or payment details itself.

**Backing infrastructure — IMPLEMENTED:** `worker/share-og.ts` now also serves `GET
/api/public/artist/:slug`, an unauthenticated JSON endpoint returning only public
profile fields and `visibility: 'public'` tracks' YouTube links (reusing the existing
unauthenticated-Firestore-REST pattern already used for OG cards, and independently
still gated by `firestore.rules`).

**REQUIRES MANUAL CONFIGURATION:** the plugin has not been installed/tested inside a
live WordPress instance in this session — I validated PHP syntax (`php -l` on every
file) and JS syntax, and reasoned through the WordPress APIs used, but there is no
WordPress environment available here to load-test it end-to-end (activation, Settings
page, shortcode/block rendering, live API round-trip). It should be smoke-tested in a
real WordPress install before distribution. It is not yet packaged as a zip or
submitted anywhere.

## 14. Security changes this session

- Fixed a real gap I introduced and caught before shipping: putting a track's YouTube
  video ID directly on the public `tracks/{trackId}` doc would have let anyone read a
  "locked" track's video ID directly from Firestore, bypassing entitlement entirely
  (Firestore has no per-field read rules, and `tracks` is intentionally
  publicly-readable for locked-tier metadata). Fixed by moving the ID to
  `trackMedia/{trackId}` (`allow read, write: if false`) and moving track creation into
  a Cloud Function that can write both docs atomically.
- `createSupportCheckoutSession`/`createLicencePaymentSession`: amount bounds, integer
  checks, self-support block, `chargesEnabled` check, `payoutHolds` check, rate limiting
  (support checkout), all server-side.
- Webhook idempotency: `handleSupportCheckoutCompleted` checks-and-writes inside one
  Firestore transaction keyed on the Checkout Session ID.
- Confirmed (did not need to change): `licenceRequests`/`licenceAgreements`/
  `licenceOffers` Firestore rules already scope reads to the two named parties + admin;
  no general chat feature exists; no `purchase`/`buy`/`own the track` language found in
  the DJ/collaboration UI.

**REQUIRES MANUAL CONFIGURATION / not re-audited this session:** the pre-existing
`SECURITY_AUDIT.md` predates this migration and was not regenerated — a fresh full
pass (Storage rules, rate limits, notification abuse, admin access, webhook replay
beyond what's described above) covering the *entire* app, not just this session's
changes, is still worth doing before a production launch.

## 15. Privacy changes

Covered in Terms/Privacy content updates (section 17). No new personal data collection
was introduced — the public artist API and WordPress plugin only surface data already
public on an artist's BackTheVibes profile.

## 16. Terms changes

See section 17 (`src/pages/marketing/LegalPage.tsx`) — new sections for YouTube
playback, one-off support payments, and the collaboration/deal proposal disclaimer
(no legal advice, no automatic rights transfer, master audio never hosted here).
`DOC_VERSION` bumped so existing acceptances don't silently carry over to materially
different terms.

## 17. Account deletion changes

Updated for the new architecture: removed the now-nonexistent `supportAllocations`
cleanup step; `trackMedia/{trackId}` is deleted alongside each removed track (both in
`offboardArtistTracks` and account deletion's artwork/track cleanup path). The
overall deletion flow, retained-record policy (signed agreements, financial records),
and idempotency were not otherwise restructured — they were already sound.

## 18. Tests performed — IMPLEMENTED

- `tests/flow-contracts.test.mjs`: 141/141 passing, including new/rewritten coverage
  for YouTube URL validation (valid/invalid/malicious inputs), the YouTube entitlement
  ladder, Stripe Connect destination-charge construction (fee computation,
  `application_fee_amount`, `transfer_data.destination`), webhook idempotency, the
  removed-tier admin settings, and the WordPress-plugin-adjacent public API's absence
  of any credential handling in the plugin itself.
- `tests/firestore-rules.test.mjs`: 3/4 passing. The one failure
  (`a regular user can only set roles once...`) is a **pre-existing bug**, confirmed via
  `git stash` to fail identically on the unmodified base branch before this session
  started — not something introduced or touched here.
- Full frontend TypeScript build (`tsc -b`), production build (`vite build`), Cloud
  Functions TypeScript build, and `oxlint` all clean.
- WordPress plugin: every PHP file passed `php -l`; both JS files passed `node --check`;
  all `block.json` files are valid JSON. **Not** run inside a live WordPress instance
  (see section 13).

## 19. Build/lint results

All green except the one pre-existing rules-test failure noted above. No new lint
warnings introduced beyond one pre-existing, unavoidable
`no-unsafe-declaration-merging` warning in `src/lib/youtubeIframeApi.ts` (the standard
TypeScript pattern for typing an external global, identical to how `@types/youtube`
itself is structured).

## 20. Remaining warnings

- The production bundle still emits a "chunks larger than 500kB" build warning — this
  predates the migration (noted in the original `PRODUCT_FLOW.md` "known current
  limits") and wasn't addressed here.
- `no-unsafe-declaration-merging` in `youtubeIframeApi.ts` (see above) — expected and
  benign.

## 21. Configuration/environment variables required

No new environment variables were introduced. Existing Stripe/Firebase configuration
covers the new payment flows unchanged (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_WEBHOOK_SECRET`, the `VITE_FIREBASE_*` client config). One
**REQUIRES MANUAL CONFIGURATION** item: an admin should visit Admin → Settings after
deploy and confirm/re-save the platform fee percentages (defaults are now 20% support /
10% DJ) and run "Sync plan templates" once to retire the legacy `fan_supporter` plan
and refresh `fan_free`'s granted features in any already-deployed Firestore project.

## 22. Manual production checks required

- Full manual walkthrough (visitor, fan, artist, DJ, business/deal participant, admin,
  suspended user, deleted account) per the spec's section 51 — not performed in this
  session (no live deployment or browser available here).
- A real Stripe test-mode run of: artist Connect onboarding → fan support payment → fee
  split verification in the Stripe dashboard → DJ licence payment → a refund, to confirm
  the destination-charge/application-fee behaviour matches this report's description
  against a live Stripe account (this session validated the code paths and Stripe API
  shape, not a live Stripe integration).
- WordPress plugin smoke test in a real WordPress install (section 13).
- Confirm the new `worker/api/public/artist/:slug` route actually receives traffic as
  expected once deployed (Cloudflare Worker routing, not locally testable here).

## 23. Anything requiring legal/compliance review

- All Terms/Privacy/Copyright Policy content in this repo is explicitly labelled
  (in-page) as a template requiring review by a qualified solicitor/accountant before a
  public launch — this was true before this session and remains true; the content was
  updated to describe the *current* architecture accurately, which is a precondition
  for a lawyer's review to be meaningful, not a substitute for it.
- The DJ/business collaboration agreement disclaimer wording (section 12) was written
  to satisfy the specific bullet points in the migration brief, not drafted or reviewed
  by a lawyer.
- Cookie-consent mechanism for the YouTube embed (section 11) needs a legal/product
  decision on what's actually required in BackTheVibes' operating jurisdiction(s).
- The 20%/10% platform fee figures are the ones specified in the migration brief itself
  — not independently reviewed for tax/regulatory treatment (e.g. whether BackTheVibes
  needs a money-transmitter licence in any jurisdiction; Stripe Connect's own compliance
  posture should be discussed directly with Stripe, but that's a business/legal
  conversation, not something a code change can settle).

---

*Everything above reflects work completed on branch `claude/dreamy-goodall-5yfbqe`
across three commits: the YouTube playback migration, the Stripe Connect payment
migration, and this WordPress-plugin/legal-copy pass.*

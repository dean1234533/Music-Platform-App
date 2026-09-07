# Firestore schema

Status: every collection below is implemented and actively read/written by
the app (client SDK for reads/owner-writes, Cloud Functions for anything
sensitive). All documents use server timestamps (`serverTimestamp()` client
side, `FieldValue.serverTimestamp()` in functions) — never `Date.now()`.

## Accounts & profiles

### `users/{userId}`
Created server-side by the `onUserCreate` auth trigger.

`uid, displayName, email, photoURL, roles ('fan'|'artist'|'dj'|'admin')[],
onboardingComplete, subscriptionStatus ('none'|'active'|'past_due'|
'canceled'), notificationPreferences{email,inApp}, stripeCustomerId?,
suspended?, createdAt, updatedAt`

Client can update `roles` (only to a subset of fan/artist/dj — never admin),
`displayName`, `photoURL`, `notificationPreferences`. `subscriptionStatus`,
`stripeCustomerId`, `suspended` are frozen — Cloud Functions / Admin SDK
only. `admin` is granted by hand in the Firestore console (see README) —
there is intentionally no in-app path to it.

**`subscriptionStatus` is fan-role-only.** Now that artists and DJs have
their own independent paid tiers (see `subscriptions/{userId}_{role}`
below), this field only ever reflects the *fan* subscription — it is not a
general "does this user have any active paid plan" flag. Artist/DJ tier
status lives in `artistProfiles.planTier`/`djProfiles.planTier` instead.

### `artistProfiles/{artistId}` (== owner's uid), public read
`slug, name, nameLower, bio, genres[], location, socialLinks{}, photoURL,
coverURL, verified, followerCount, supporterCount, djAllowRequests
('anyone'|'verified_only'|'approved_only'|'disabled'), trackCount, trackLimit,
planTier('free'|'mid'|'top'), perks[], createdAt, updatedAt`

`verified`/`followerCount`/`supporterCount` are frozen on client writes —
maintained by `reviewVerificationRequest` and the follow/support triggers.
`trackCount` is maintained by the `onTrackCreate`/`onTrackDelete` triggers.
`trackLimit`/`planTier` are mirrored from the artist's resolved entitlement
plan (see Entitlements section below) by `mirrorResolvedLimits`, called from
both the `onArtistProfileCreate` trigger (initial free-tier value) and the
Stripe subscription webhook (every upgrade/downgrade/cancellation).
`trackLimit == -1` means unlimited; `tracks/{trackId}`'s create rule compares
`trackCount < trackLimit` directly — rules never resolve a plan themselves.
`perks` is artist-writable free text (Super Supporter perks) — not
platform-enforced.

### `artistSlugs/{slug}` — `{ artistId }`, reserved transactionally with the profile create, immutable.

### `djProfiles/{djId}` (== owner's uid), public read
`name, realName, photoURL, coverURL, bio, genres[], country, city, venues[],
website, socialLinks{}, verificationStatus
('unverified'|'pending'|'verified'|'rejected'), requestsThisMonth,
requestsMonthResetAt, planTier('free'|'mid'|'top'), bulkOutreachOptIn,
createdAt, updatedAt`

`requestsThisMonth`/`requestsMonthResetAt`/`planTier` are server-mirrored —
the monthly counter is maintained transactionally inside
`submitLicenceRequest` (lazy reset: if `requestsMonthResetAt` is in a prior
calendar month, the effective count is treated as 0 before the limit check).
`bulkOutreachOptIn` is DJ-writable — their own opt-in to receive Artist Pro+
bulk promotional outreach (defaults `false`; `sendBulkDjOutreach` only ever
targets DJs where this is `true`).

## Music

### `tracks/{trackId}`
`artistId, title, titleLower, albumId, genre, subgenre, bpm, mood, key,
location, releaseDate, description, explicit, credits{songwriters[],producers[],
featuredArtists[]}, previewAudioPath, previewDurationSec, previewStartSec,
originalAudioPath, artworkURL, visibility
('public'|'followers'|'supporters'|'early_access'|'dj_only'|'private'),
djPromotion, djLicenceMode
('free'|'fixed_price'|'custom_price'|'negotiated'|'not_available'),
djFixedPrice, djPromoTier('all'|'pro_plus_only'), embargoUntil, playCount,
rightsConfirmed, takenDown?, createdAt, updatedAt`

`genre`/`mood` are drawn from the fixed vocabulary in
`src/constants/musicTaxonomy.ts` (not free text) so DJ Pro's discovery
filters can rely on exact matches. `key` is Camelot notation. `location` is
a denormalized copy of the artist's `ArtistProfile.location` at upload time
(avoids a join for location filtering). `djPromoTier` (Artist Pro+ "private
promo pools") and `embargoUntil` (Artist Pro+ "release embargoes") both
gate DJ-discovery visibility and `submitLicenceRequest` eligibility — a
`pro_plus_only` track is excluded from discovery unless the requesting DJ
has the `privatePromoPools` feature, and an embargoed track is excluded
until `embargoUntil` passes.

Read: `visibility=='public'` (anyone), `visibility=='dj_only'` (any
signed-in DJ), owner, or admin. **Any query over this collection must be
constrained to a visibility the requester can actually read** — an
unconstrained `where('djPromotion','==',true)` query, for example, fails
outright the moment a non-public djPromotion track exists, because
Firestore rejects list queries that *could* match an unreadable document
rather than silently filtering them. See `listDJPromotionTracks` /
`listArtistsSeekingDJExposure` / `subscribePublicArtistTracks` for the safe
pattern (`where('visibility','in',['public','dj_only'])`, or a fixed
`=='public'`). `playCount` and `takenDown` are frozen on client writes.

### `albums/{albumId}` — `artistId, title, type, artworkURL, releaseDate, createdAt`

### `follows/{fanId_artistId}` — `{fanId, artistId, createdAt}`. `artistProfiles.followerCount` maintained by `onFollowCreate`/`onFollowDelete` triggers.

### `trackLikes/{fanId_trackId}` — same pattern, backs the player's like button and Library.

### `playlists/{playlistId}` — `ownerId, title, trackIds[], createdAt, updatedAt`. Owner-only.

### `crates/{crateId}` — `ownerId, title, trackIds[], notes, tags[], createdAt, updatedAt`. Owner-only, `create` additionally requires the `dj` role.
Structurally identical to `playlists` but kept as a separate collection so
fan playlist and DJ crate queries never conflate. Basic crates (create/add/
remove/view) are DJ Free; `notes`/`tags` are populated only when the DJ has
the `advancedCrates` (Pro+) feature — enforced client-side in the crate
editor UI, since the fields themselves are freeform and not security-sensitive.

### `artistPosts/{postId}` — `artistId, visibility('everyone'|'followers'|'supporters'), type, title, body, mediaURL, createdAt`.
Same query-safety rule as tracks: a public viewer's read is split into one
query per visibility tier they're entitled to (`subscribePublicArtistPosts`)
rather than one unconstrained query.

### `notifications/{notificationId}` — `userId, type, title, body, linkTo, read, createdAt`. Server-created only; client may only flip `read`.

## Subscriptions & entitlements (Phase 2, extended for tiered Fan/Artist/DJ plans)

### `subscriptionPlans/{planId}` — public read, admin-write-only (`adminUpsertSubscriptionPlan`).
`planId, name, role('fan'|'artist'|'dj'), tier('free'|'mid'|'top'),
priceMinor, currency, interval, stripePriceId(null for the 3 free plans),
active, isDefaultFree, features{PlanFeatureKey: boolean}, limits{PlanLimitKey:
number}, displayOrder, recommended, updatedAt`.

Exactly one plan per `role` must have `isDefaultFree: true` — the
entitlement resolver's fallback when a user has no active subscription for
that role. `limits` values use `-1` to mean unlimited. `features`/`limits`
keys are the fixed vocabulary in `src/types/entitlements.ts` (client) /
`functions/src/entitlements.ts` (server, duplicated deliberately — see
comments in both files). The 9 spec'd plans (3 per role) are seeded via the
admin-only `adminSeedSubscriptionPlans` callable, which skips (never
overwrites) any plan doc that already exists, so it's safe to re-run.

### `platformSettings/default` — public read, admin-write-only (`adminUpdatePlatformSettings`). `platformFeePercent, artistAllocationPercent, djServiceFeePercent, minimumPayoutMinor, allowedPreviewDurationsSec[], maxUploadSizeMB, supportedAudioTypes[]`.

### `subscriptions/{userId}_{role}` — Stripe webhook only.
`userId, role('fan'|'artist'|'dj'), stripeCustomerId, stripeSubscriptionId,
planId, stripePriceId, status, cancelAtPeriodEnd, currentPeriodEnd,
updatedAt`.

Composite doc ID (was `subscriptions/{userId}`) — a user can hold up to 3
concurrent subscriptions, one per role, since roles aren't mutually
exclusive. **No doc exists for a user on a role's free/default tier** —
entitlement resolution treats "no doc, or status not active/past_due" as
"use that role's `isDefaultFree` plan." The Stripe subscription's
`metadata.role` (set at Checkout-session creation) tells the webhook which
role a given event belongs to. Every subscription lifecycle event
(created/updated/deleted) also triggers `mirrorResolvedLimits`, which
re-resolves the user's plan and writes the result onto `artistProfiles.
trackLimit`/`.planTier` (role `artist`) or `djProfiles.planTier` (role
`dj`) — see those sections above. `users/{uid}.subscriptionStatus` is only
ever updated for `role=='fan'` (see the `users` section above) — it does
not reflect artist/DJ tier status.

### `supportAllocations/{fanId}` — `updateSupportAllocations` callable only. `fanId, allocations{artistId: amountMinor}, totalMinor, updatedAt`. The callable re-validates the total against the fan's actual subscription price server-side — the client's numbers are a proposal, never trusted directly.

### `supportRelationships/{fanId_artistId}` — reconciled by the same callable to match the allocation map. Drives `artistProfiles.supporterCount` (via trigger) and supporter-content entitlement (Firestore + Storage rules both check this collection).

## Revenue (Phase 2/5)

### `transactions/{transactionId}` — server-written only.
`type ('subscription_income'|'dj_licence_income'|'payout'), artistId, fanId?,
djId?, grossMinor, platformFeeMinor, netMinor, currency, createdAt,
promotedAt (null until the clearing job promotes it)`

### `artistBalances/{artistId}` — server-written only. `pendingMinor, availableMinor, paidMinor, currency, updatedAt`. `promotePendingBalances` (daily scheduled function) moves funds from pending to available 7 days after the transaction lands.

### `artistPayoutAccounts/{artistId}` — Stripe Connect callables/webhook only. `stripeAccountId, payoutsEnabled, chargesEnabled, onboardingComplete, updatedAt`. No bank details ever stored here — Stripe holds those.

### `payouts/{payoutId}` — `requestPayout` callable only. `artistId, amountMinor, currency, stripeTransferId, status, createdAt`.

## DJ licensing (Phase 3/4)

### `licenceRequests/{requestId}` — server-written only (`submitLicenceRequest`/`respondToLicenceRequest`/`proposeAgreement`).
`djId, artistId, trackId, trackGenre, intendedUse, territory, expectedDate, venue,
message, status ('submitted'|'artist_review'|'negotiating'|
'agreement_ready'|'awaiting_signatures'|'awaiting_payment'|'approved'|
'rejected'|'expired'|'cancelled'), conversationId, currentAgreementId?,
createdAt, updatedAt`

`trackGenre` is denormalized from the track at submission time (DJ Pro+
analytics groups requests by genre without an N+1 read per request).
`submitLicenceRequest` also enforces the DJ's monthly request limit here —
see `djProfiles.requestsThisMonth` above — and rejects requests against
tracks that are embargoed (`tracks.embargoUntil` in the future) or in a
private promo pool the requesting DJ can't see (`tracks.djPromoTier`).

### `licenceAgreements/{agreementId}` — server-written only (`proposeAgreement`/`signAgreement`/the licence-payment webhook handler).
`licenceRequestId, artistId, djId, trackId, trackVersion, permittedUse,
territory, startDate, expiryDate, licenceFeeMinor, currency,
attributionRequirements, recordingPermission, streamingPermission,
commercialUse, redistributionAllowed, resaleAllowed, additionalTerms,
agreementVersion, status ('pending'|'signed'|'superseded'),
artistAcceptedAt, djAcceptedAt, paidAt, downloadRevoked, downloadCount,
createdAt, finalisedAt`

Immutable once both parties accept — a term change after that creates a new
document with `agreementVersion + 1` and marks the old one `superseded`
rather than mutating signed terms.

### `licenceAgreementAcceptances/{acceptanceId}` — append-only signature log. `agreementId, userId, role, agreementVersion, acceptedAt`. Deliberately minimal — no IP/device metadata collected, per the "don't collect unnecessary personal data" requirement; the architecture leaves room to add it later if legal review calls for it.

### `conversations/{conversationId}` — created by `submitLicenceRequest`, scoped to a track/licence request. `participantIds[], trackId, licenceRequestId, lastMessageAt, lastMessagePreview, createdAt`.
### `conversations/{id}/messages/{messageId}` — appended by `sendMessage` only. `senderId, text, readBy[], createdAt`.

### `downloadLogs/{logId}` — written by `getSecureDownloadUrl` only. `djId, artistId, trackId, agreementId, fileVersion, timestamp`.

## Trust & safety (Phase 5)

### `verificationRequests/{id}` — `submitVerificationRequest`/`reviewVerificationRequest` only. `userId, profileType('artist'|'dj'), status('pending'|'approved'|'rejected'), createdAt`.

### `copyrightClaims/{claimId}` — anyone can `submitCopyrightClaim`; only `reviewCopyrightClaim` (admin) can change `status`. `reporterId, trackId, artistId, reason, description, status('submitted'|'under_review'|'action_required'|'removed'|'restored'|'rejected'), adminNote?, createdAt, reviewedAt?`. Uploading a track never marks the uploader as a confirmed rights holder — that's an admin determination via this collection, not an automatic consequence of the upload form's checkbox.

### `reports/{reportId}` — anyone can `submitReport`; only `adminResolveReport` (admin) can change `status`. `reporterId, targetType, targetId, reason, description, status('open'|'resolved'|'dismissed'), createdAt`.

### `auditLogs/{id}` — admin-read, server-write-only. `adminId, action, details, createdAt`. Written by every admin callable (`writeAuditLog` helper) — suspensions, takedowns, verification decisions, claim reviews, plan/fee changes.

## Denormalisation & query-safety notes

- `nameLower` / `titleLower` mirror `name` / `title` for Firestore-native
  prefix search (`searchService.ts`). Swap in a dedicated search provider
  behind that same function signature if typo-tolerant/ranked search is
  needed later.
- `followerCount` / `supporterCount` / `playCount` are denormalised counters
  updated exclusively server-side (Cloud Function triggers/callables), with
  a matching Firestore rule freezing those fields on client writes.
- **Any list query over `tracks` or `artistPosts` must be constrained to a
  visibility tier the requester can read.** Firestore rejects a list query
  outright if it could match a document the rule would deny, rather than
  silently omitting it. `subscribePublicArtistTracks`,
  `subscribePublicArtistPosts`, `listDJPromotionTracks`, and
  `listArtistsSeekingDJExposure` show the pattern (one query per readable
  tier, or a fixed `where('visibility','==','public')`); `subscribeArtistTracks`
  is the unconstrained, owner-only counterpart — never call it for a viewer
  who isn't the artist themselves.

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

### `artistProfiles/{artistId}` (== owner's uid), public read
`slug, name, nameLower, bio, genres[], location, socialLinks{}, photoURL,
coverURL, verified, followerCount, supporterCount, djAllowRequests
('anyone'|'verified_only'|'approved_only'|'disabled'), createdAt, updatedAt`

`verified`/`followerCount`/`supporterCount` are frozen on client writes —
maintained by `reviewVerificationRequest` and the follow/support triggers.

### `artistSlugs/{slug}` — `{ artistId }`, reserved transactionally with the profile create, immutable.

### `djProfiles/{djId}` (== owner's uid), public read
`name, realName, photoURL, coverURL, bio, genres[], country, city, venues[],
website, socialLinks{}, verificationStatus
('unverified'|'pending'|'verified'|'rejected'), createdAt, updatedAt`

## Music

### `tracks/{trackId}`
`artistId, title, titleLower, albumId, genre, subgenre, bpm, mood,
releaseDate, description, explicit, credits{songwriters[],producers[],
featuredArtists[]}, previewAudioPath, previewDurationSec, previewStartSec,
originalAudioPath, artworkURL, visibility
('public'|'followers'|'supporters'|'early_access'|'dj_only'|'private'),
djPromotion, djLicenceMode
('free'|'fixed_price'|'custom_price'|'negotiated'|'not_available'),
djFixedPrice, playCount, rightsConfirmed, takenDown?, createdAt, updatedAt`

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

### `artistPosts/{postId}` — `artistId, visibility('everyone'|'followers'|'supporters'), type, title, body, mediaURL, createdAt`.
Same query-safety rule as tracks: a public viewer's read is split into one
query per visibility tier they're entitled to (`subscribePublicArtistPosts`)
rather than one unconstrained query.

### `notifications/{notificationId}` — `userId, type, title, body, linkTo, read, createdAt`. Server-created only; client may only flip `read`.

## Subscriptions & support (Phase 2)

### `subscriptionPlans/{planId}` — public read, admin-write-only (`adminUpsertSubscriptionPlan`). `planId, name, priceMinor, currency, interval, stripePriceId, active`.

### `platformSettings/default` — public read, admin-write-only (`adminUpdatePlatformSettings`). `platformFeePercent, artistAllocationPercent, djServiceFeePercent, minimumPayoutMinor, allowedPreviewDurationsSec[], maxUploadSizeMB, supportedAudioTypes[]`.

### `subscriptions/{userId}` — Stripe webhook only. `userId, stripeCustomerId, stripeSubscriptionId, planId, stripePriceId, status, cancelAtPeriodEnd, currentPeriodEnd, updatedAt`.

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
`djId, artistId, trackId, intendedUse, territory, expectedDate, venue,
message, status ('submitted'|'artist_review'|'negotiating'|
'agreement_ready'|'awaiting_signatures'|'awaiting_payment'|'approved'|
'rejected'|'expired'|'cancelled'), conversationId, currentAgreementId?,
createdAt, updatedAt`

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

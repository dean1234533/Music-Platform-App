# Firestore schema

## Accounts and creator profiles

- `users/{uid}` stores identity, roles (`fan`, `artist`, `dj`), fan subscription status, Stripe customer ID and moderation state.
- `artistProfiles/{uid}` stores the public artist profile, DJ request policy, supporter perks and server-maintained audience/track counters.
- `djProfiles/{uid}` stores the public DJ profile, verification state, discovery preferences and bulk-outreach opt-in.

Artist and DJ profiles are free. There are no creator plan tiers, upload caps, monthly DJ-request counters or feature entitlements. Legacy creator-plan fields may remain on old documents during migration but are ignored by clients, rules and Functions.

## Music and community

- `tracks/{trackId}` stores artist ownership, metadata, visibility, audio assets (`originalAudioPath`, `streamAudioPath`, `previewAudioPath`), preview settings, DJ-promotion/licence settings, server-computed integrity fields (`fileHash`, `fileSize`, `mimeType`, `hashCheckedAt`, `possibleDuplicateOfTrackId`), the artist's `rightsMetadata` declaration, and copyright-enforcement fields (`takenDown`, `restrictedCapabilities`).
- `albums/{albumId}`, `playlists/{playlistId}`, `follows/{id}`, `posts/{postId}` and `notifications/{id}` support listener and community experiences.
- `supportRelationships/{fanId_artistId}` grants access to a chosen artist's supporter content.

Track creation requires an artist role, rights confirmation and an initial play count of zero. There is no plan-based upload limit. Legacy private-promo values are visible to all DJs.

An uploaded master is compressed client-side (image/audio) before it ever reaches Storage; the audio pipeline derives a `streamAudioPath` (full-length, optimised) and `previewAudioPath` (trimmed) from the master, uploaded alongside the untouched `originalAudioPath`. A Storage-triggered function hashes the original on upload and flags (never auto-removes) a same-hash upload by a different artist via `possibleDuplicateOfTrackId`.

`restrictedCapabilities` (`'dj_licensing' | 'discovery' | 'streaming'`) lets a track be partially restricted — e.g. pulled from DJ licensing and discovery — short of a full `takenDown`. Both fields are Cloud-Function-only (frozen in `firestore.rules`).

## Fan subscriptions and artist allocation

- `subscriptionPlans/{planId}` contains fan plans only: a default Free Listener plan and configurable paid Supporter plans with Stripe Price IDs.
- `subscriptions/{uid}_fan` is the server-written Stripe subscription mirror.
- `supportAllocations/{uid}` records how a supporter allocates their monthly artist share.
- `transactions/{transactionId}` records gross, platform share and artist net amounts.
- `artistBalances/{artistId}` and `payouts/{payoutId}` track balances and Stripe Connect payouts.

The admin sync callable retires legacy creator/DJ plan documents. Checkout accepts fan plans only.

## DJ licensing

- `licenceRequests/{requestId}` stores a DJ request and its workflow state.
- `conversations/{conversationId}/messages/{messageId}` keeps negotiation scoped to that request.
- `licenceAgreements/{agreementId}` stores versioned terms, signatures, agreed gross fee, configured transaction-fee snapshot, artist net amount and payment state.
- `downloadLogs/{id}` provides an audit record for secure downloads.

DJs can submit unlimited requests, use filters/crates/analytics, and apply for verification without a subscription. Before checkout, the UI shows the gross licence amount, configured transaction fee and artist proceeds. Stripe webhook accounting uses the saved fee snapshot.

## Copyright protection and legal acceptance

- `legalAcceptances/{userId}_{docType}_{version}` is an append-only record of a user accepting a versioned legal document (`terms`, `privacy`, `copyright_policy`, `dj_licensing_terms`, `rights_declaration`). The rights-declaration variant is written by the `recordRightsDeclaration` callable (idempotency-guarded, one per upload) immediately before a track is created; ToS/privacy acceptance is a direct client write since it needs no cross-doc validation.
- `copyrightClaims/{claimId}` stores a claim's full lifecycle: claimant identity (`claimantName`, `claimantEmail`, `claimantCompany`, `claimantIsOwnerOrRep`), evidence (`supportingLinks`, `evidenceUrls`, `declarationSignature`), `status` (`submitted → under_review/information_required → artist_notified → temporarily_restricted/removed → rejected/resolved/restored`, plus `appealed`/`counter_noticed`), the artist's `artistResponse`, and `counterNoticeText`. Written only via callables (`submitCopyrightClaim`, `reviewCopyrightClaim`, `submitArtistResponse`, `submitCounterNotice`) — direct client writes are rejected by rules.
- `payoutHolds/{artistId}` blocks `requestPayout` while `active: true`. Set automatically when a claim results in `removed`, cleared automatically on `restored`. Read-only to the artist; never client-writable.

Copyright evidence files upload to Storage under `copyrightEvidence/{claimId}/{fileName}`, readable only by the claim's own reporter or an admin.

## Artist Stories

- `stories/{storyId}` is an ephemeral (24h default, up to 7 days) artist update — `mediaKind` (`image`/`video`/`audio`/`text`/`poll`), `storyCategory` (a descriptive label), `visibility` (`public`/`followers`/`supporters`/`dj`), a restricted `ctaType`/`ctaTargetId` pair (never an arbitrary URL — `'track'` CTAs are checked server-side against a real track the artist owns), and denormalised counters (`uniqueViewerCount`, `reactionCount`, `ctaClickCount`, `pollVoteCounts`). Written only via the `createStory`/`toggleStoryHighlight` callables (or deleted directly by the owning artist); the one client-writable field is `ctaClickCount`, and rules enforce it can only ever increment by exactly 1.
- `storyViews/{storyId_userId}`, `storyReactions/{storyId_userId}`, `storyPollVotes/{storyId_userId}` are per-viewer dedup docs, direct client writes (like `follows`), aggregated onto the story's counters by a Firestore trigger.
- The `dj` visibility tier additionally requires the viewer to hold the `dj` role AND the artist's own `artistProfiles.storiesDjEnabled` opt-in — independent of `djAllowRequests`, which only governs licensing requests. Story media lives under `artists/{artistId}/stories/{public,followers,supporters,dj}/{fileName}` — the tier is encoded directly in the Storage path, so (unlike track streaming) no Firestore visibility lookup is needed for the public/followers/supporters tiers.
- Marking a Story `isHighlight` keeps it queryable past its `expiresAt` for the profile's Highlights row (public-tier highlights only, in this pass); it does not extend the "active" rail, which always filters on `expiresAt`.

## Platform configuration

`platformSettings/default` is public-readable and admin-write-only. Payment processing requires `platformFeePercent`, `artistAllocationPercent`, `djServiceFeePercent`, and `minimumPayoutMinor`. Platform and artist percentages must total 100. Revenue code does not fall back to hard-coded percentages.

Optional media configuration includes `allowedPreviewDurationsSec`, `maxUploadSizeMB`, and `supportedAudioTypes`.

## Shareable links

Artist and track pages are reachable at `/artist/:slug` and `/artist/:slug/track/:trackId` (the flat `/track/:trackId` form still resolves and upgrades the address bar once the artist loads). A Cloudflare Worker (`worker/share-og.ts`) detects crawler user agents and serves a server-rendered OG/Twitter card built from an unauthenticated Firestore REST read of the same public-readable docs; real visitors always get the normal SPA. A non-public track falls back to an artist-level card rather than exposing anything the crawler isn't allowed to read.

## Security model

Public profiles and releases are readable without authentication. Users own their editable profile content, while counters, verification, billing, moderation, balances, agreements, transactions and secure downloads are controlled by Cloud Functions and Firestore/Storage rules. Stripe amounts and plan eligibility are resolved server-side from Firestore rather than trusted from the browser.

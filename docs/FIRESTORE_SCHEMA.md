# Firestore schema

## Accounts and creator profiles

- `users/{uid}` stores identity, roles (`fan`, `artist`, `dj`), fan subscription status, Stripe customer ID and moderation state.
- `artistProfiles/{uid}` stores the public artist profile, DJ request policy, supporter perks and server-maintained audience/track counters.
- `djProfiles/{uid}` stores the public DJ profile, verification state, discovery preferences and bulk-outreach opt-in.

Artist and DJ profiles are free. There are no creator plan tiers, upload caps, monthly DJ-request counters or feature entitlements. Legacy creator-plan fields may remain on old documents during migration but are ignored by clients, rules and Functions.

## Music and community

- `tracks/{trackId}` stores artist ownership, metadata, visibility, audio assets, preview settings and DJ-promotion/licence settings.
- `albums/{albumId}`, `playlists/{playlistId}`, `follows/{id}`, `posts/{postId}` and `notifications/{id}` support listener and community experiences.
- `supportRelationships/{fanId_artistId}` grants access to a chosen artist's supporter content.

Track creation requires an artist role, rights confirmation and an initial play count of zero. There is no plan-based upload limit. Legacy private-promo values are visible to all DJs.

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

## Platform configuration

`platformSettings/default` is public-readable and admin-write-only. Payment processing requires `platformFeePercent`, `artistAllocationPercent`, `djServiceFeePercent`, and `minimumPayoutMinor`. Platform and artist percentages must total 100. Revenue code does not fall back to hard-coded percentages.

Optional media configuration includes `allowedPreviewDurationsSec`, `maxUploadSizeMB`, and `supportedAudioTypes`.

## Security model

Public profiles and releases are readable without authentication. Users own their editable profile content, while counters, verification, billing, moderation, balances, agreements, transactions and secure downloads are controlled by Cloud Functions and Firestore/Storage rules. Stripe amounts and plan eligibility are resolved server-side from Firestore rather than trusted from the browser.

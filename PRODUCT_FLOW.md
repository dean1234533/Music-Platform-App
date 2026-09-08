# BackTheVibes Product Flow

This document describes behaviour that exists in the current codebase after the 2026-09-07 flow audit. It does not describe planned functionality.

## 1. Visitor

Visitors can view the marketing home, pricing, terms, privacy and copyright pages. They can open a public artist URL and public track URL. Public audio is requested from a callable backend, which checks the track’s current visibility, embargo/moderation state and audio capability before returning a short-lived playback URL. Actions that create personal state send a signed-out visitor to sign-in and return them to the protected destination where applicable.

## 2. Fan

A fan can discover public releases and DJ-ready public tracks, search public artist names and track titles, follow artists, like/save tracks, organise tracks into private playlists, and play a playlist continuously through the persistent player. Create, save, remove and delete actions provide in-app feedback. Fan account access itself is free.

## 3. Supporter

A signed-in listener can choose a paid fan plan and enter Stripe Checkout. The redirect is not the entitlement: Stripe webhook state writes the authoritative subscription document. An active supporter allocates the artist-support portion among artists; the allocation callable reconciles `supportRelationships`. Those relationships gate supporter-only track/post/Story document access and identify eligible fan offers. Cancellation and billing management happen in Stripe’s billing portal, with access following webhook status.

## 4. Artist

Artists join without a recurring creator plan. Artist onboarding reserves a public slug and creates a profile. Artists can edit profile media/details, upload compressed supported audio plus artwork, declare rights, choose visibility, enable DJ promotion, configure track/reusable DJ deals, publish community posts and Stories, make fan offers, respond to DJ requests, sign agreements, inspect revenue and connect Stripe for payouts. Artists can delete posts, Stories, offers, deals and tracks. Track deletion is server-authorised, removes associated unused media/state, and refuses deletion under legal hold or an active licence.

## 5. DJ

DJs join without a recurring DJ plan. A DJ profile records genres, location, outreach preference and verification status. DJs can browse tracks explicitly open to DJ promotion with genre/BPM/mood/key/licence/location filters, preview permitted audio, create private crates, submit licence requests, negotiate in the request conversation, sign agreements and download an original only when the final agreement permits it. DJ verification is requested by the DJ and decided by an admin.

## 6. Artist/DJ negotiation

A DJ request creates a private request and conversation for exactly that DJ and artist. Text messages are written through a callable that checks membership and rate limits. Offers and counter-offers are new append-only documents; previous terms remain history. An accepted offer can be used to generate the agreement. Notifications deep-link back to the canonical request route.

## 7. Contracts

Licence agreements are generated and updated only by backend callables. Terms have a version/content hash. Each party provides a legal name and signature; client code cannot forge agreement status or write the agreement directly. A change in terms requires a new version/agreement rather than silently changing a signed document. Download logs and agreement evidence remain after account deletion when needed for the counterparty’s contractual record and retention policy.

## 8. Payments

There are two payment categories. Listener supporter subscriptions are recurring Stripe subscriptions. Paid DJ licences are one-off payments tied to one agreement. Artist and DJ accounts do not have platform subscription checkout. Stripe webhooks, not success URLs, update paid/active state. Invoice transaction IDs provide idempotency for artist revenue. Stripe Connect onboarding is backend-created; payout readiness follows Stripe account state. Account deletion cancels an existing fan subscription before removing the user.

## 9. Copyright

Every track upload records the artist’s rights declaration and stores originals in a client-private path. The backend hashes originals for duplicate signalling without treating a hash match as proof. Authenticated users can submit a copyright claim with declaration and evidence. Admin review can request information, restrict discovery/licensing/streaming, remove or restore a track and apply payout holds. Playback checks current takedown and streaming restriction state on every signed-URL request.

## 10. Admin

Admin pages are protected by the `admin` role and sensitive operations also call a backend `requireAdmin` guard. Admins can review users, artist/DJ verification, reports, copyright/moderation state, subscription plans and fees, retention settings, legal holds, audit logs and security incidents. Admin settings also expose the shared PWA, password, export and account-deletion controls. Client users cannot grant themselves admin or mutate server-owned billing/contract/moderation fields.

## 11. Account management

Email/password and Google sign-in are supported. Email signup sends a verification message and onboarding does not continue until Firebase reports the address verified. The chosen marketing role is carried into onboarding. Login restores a protected deep link or chooses an appropriate dashboard. Password accounts can change password after recent credential reauthentication and local strength checks; Google-only accounts are told no local password exists. Users can export data, sign out and request destructive account deletion after reauthentication. Logging out or switching users clears the shared audio player.

## 12. Data retention

Account deletion removes Auth/user state, profiles, follows, likes, playlists/crates, notifications, supporter allocation/relationships/subscription, artist posts/offers and unlicensed media. Artist tracks with active agreements are made private/taken down instead of destroying the DJ’s contracted asset. Agreements, requests, conversations, messages, download logs, financial records, verification and copyright records follow configured retention/legal-hold rules. Scheduled cleanup functions cover Stories, notifications, abandoned requests, draft offers, inactive chats, stale negotiations, expired contracts, resolved claims, audit logs and rate-limit records.

## 13. PWA installation

Every authenticated role can receive the install banner when the browser exposes a real install prompt. iOS receives “Add to Home Screen” instructions. Dismissal is remembered for seven days; standalone mode suppresses the banner. Fan, artist, DJ and admin account settings expose install status/action. The service worker updates automatically, uses network-first navigation, limits same-origin image caching, handles background push, and navigates an existing app window to the notification destination.

## Known current limits

- Search currently covers artist names and public track titles; album, DJ and genre search are not present.
- There is no end-user block list and no complete post-signature mutual licence cancellation/void workflow.
- Restricted follower/supporter Story media still needs a server-issued media URL architecture because this project’s Storage/Firestore locations prevent reliable cross-service Storage rule checks.
- The production bundle builds successfully but still emits large-chunk warnings; route-level code splitting is not yet implemented.
- Failed mid-upload cleanup is not complete.

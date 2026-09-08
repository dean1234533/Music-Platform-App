# BackTheVibes — independent music platform

React + TypeScript + Tailwind CSS frontend, Firebase backend (Auth, Firestore,
Storage, Cloud Functions), Stripe + Stripe Connect for payments, deployed to
Cloudflare Pages. "BackTheVibes" is the current brand name and can be renamed
(search/replace in `index.html`, `src/components/layout/Sidebar.tsx`,
`src/components/layout/TopBar.tsx`, `src/pages/marketing/LandingPage.tsx`,
`src/pages/auth/AuthLayout.tsx`, and `vite.config.ts`'s PWA manifest).

## Status: all 5 phases implemented

See `docs/FIRESTORE_SCHEMA.md` for the full data model. What's real and wired
end-to-end, not stubbed:

- **Phase 1** — Firebase Auth (email/password + Google, verification, reset),
  multi-role accounts (fan/artist/dj) with onboarding, artist profiles at
  `/artist/{slug}`, track upload with a protected-original / public-preview
  split, the persistent player, following, liking, playlists, search,
  discovery.
- **Phase 2** — platform subscriptions via Stripe Checkout + webhooks, fan
  allocation of support across followed artists (server-validated against
  the actual subscription amount), supporter-gated content, artist revenue
  ledger (subscription income transactions).
- **Phase 3** — DJ discovery, `submitLicenceRequest`/`respondToLicenceRequest`
  workflow, in-app messaging scoped to a licence request, artist DJ-request
  board grouped by status.
- **Phase 4** — digital licence agreements (propose/sign, immutable once both
  parties accept, versioned on change), Stripe Checkout for paid licences,
  secure downloads via short-lived signed Storage URLs issued only after
  every server-side check (role, ownership, signatures, payment, expiry,
  revocation) passes.
- **Phase 5** — Stripe Connect Express onboarding, pending/available/paid
  artist balances with a daily clearing-period job, payout requests via
  Stripe Transfers, artist/DJ verification review queue, copyright claim +
  general report review, user suspension (enforced by an auth blocking
  function, not just a UI flag), admin dashboard, audit log.

Nothing here fakes success — every write that affects money, licensing,
counts, or trust happens in a Cloud Function using the Admin SDK, and
Firestore rules reject the equivalent client write. Where the rules file
below says "written only via `<functionName>`", that's enforced, not just
documented.

## Local setup

1. **Create a Firebase project** (console.firebase.google.com) on the **Blaze
   plan** (required for Cloud Functions, outbound network calls to Stripe,
   and the scheduled payout-clearing job). Enable:
   - Authentication → Email/Password and Google sign-in providers
   - Firestore (production mode)
   - Storage
   - Functions

2. **Web app config** — Project settings → General → Your apps → add a web
   app, copy the config into `.env` (copy `.env.example` first):

   ```
   cp .env.example .env
   ```

3. **Install and run**:

   ```
   npm install
   npm run dev
   ```

4. **Deploy Firestore/Storage rules and indexes**:

   ```
   npm install -g firebase-tools   # if not already installed
   firebase login
   # edit .firebaserc with your project id, then:
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

5. **Stripe setup**:
   - Create a Stripe account (test mode is fine for trying this out) and at
     least one recurring Price for the platform subscription.
   - Set Cloud Functions secrets:
     ```
     firebase functions:secrets:set STRIPE_SECRET_KEY
     firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
     firebase functions:secrets:set STRIPE_CONNECT_WEBHOOK_SECRET
     ```
   - After first deploy, create **two** webhook endpoints in the Stripe
     dashboard:
     - one at the `stripeWebhook` function URL, listening for
       `checkout.session.completed`, `customer.subscription.*`,
       `invoice.paid`, `invoice.payment_failed`
     - one at the `stripeConnectWebhook` function URL, listening for
       `account.updated` (set this one's "Listen to" to Connect events)
   - Use the signing secret Stripe gives each endpoint for the matching
     secret above.

6. **Cloud Functions**:

   ```
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

7. **Publish at least one subscription plan and platform settings.** Nothing
   writes these by default — they're admin-only in Firestore rules. Bootstrap
   the very first admin manually (Firestore console → `users/{yourUid}` →
   set `roles: ["admin", ...]`; this is the one place a human, not the app,
   sets the admin role), then use `/admin/settings` to create a plan (needs
   its Stripe Price ID) and set fee percentages, or call
   `adminUpsertSubscriptionPlan` / `adminUpdatePlatformSettings` directly.

8. **Stripe Connect**: artists onboard themselves from Revenue → Connect
   Stripe, no admin setup needed beyond the webhook above.

## Push notifications setup

1. Firebase Console → Project settings → Cloud Messaging → **Web Push
   certificates** → generate a key pair. Put it in `.env` as
   `VITE_FIREBASE_VAPID_KEY` (already public info, same as the rest of the
   Firebase config).
2. The same project config is hardcoded a second time in `sw-src/sw.ts` —
   the service worker is bundled standalone outside the app's module graph,
   so it can't read `.env` at build time. Update both places together if
   you ever change Firebase projects.
3. Deploy functions (`onNotificationCreatePush` needs to be live) —
   included in the normal `firebase deploy --only functions` from step 6.
4. From `/app/settings`, click "Enable" under Push notifications. Every
   existing notification-writing code path (DJ requests, messages,
   agreements, payments, verification, etc.) now reaches the device
   automatically — nothing else to wire up per-feature.
5. Requires HTTPS (Cloudflare Pages gives you this) or `localhost` for
   local testing. Desktop Chrome/Firefox/Edge support this fully; Safari
   only supports it for a PWA actually added to the home screen (iOS
   16.4+), not a regular browser tab — that's a platform limitation, not
   something fixable in this codebase.

## Keeping this at $0

Cloud Functions require the Blaze plan, which is pay-as-you-go rather than a
hard-capped free plan like Spark — so nothing here is *guaranteed* free, but
at hobby scale it should cost nothing in practice:

- **Set a budget in Google Cloud Console** (Billing → Budgets & alerts) for
  the Firebase project — do this before you invite real users, not after.
- Functions have no `minInstances` set, so they scale to zero and cost
  nothing while idle — you only pay per invocation beyond the free monthly
  quota (2M invocations/month as of writing).
- Stripe has no monthly fee; it only takes its cut when money actually
  moves, so it costs $0 with zero transactions.
- Cloudflare Pages hosting is free at this scale.
- Audio uploads are capped at 40MB and restricted to compressed formats
  (MP3/AAC/OGG — WAV/FLAC/AIFF are rejected by `storage.rules`, not just
  discouraged) specifically to keep Storage size — and the download egress
  that costs more than storage itself — predictable. See
  `src/utils/uploadLimits.ts` for the client-side mirror of that same limit.

## Deploying the frontend to Cloudflare

Connecting this repo in the Cloudflare dashboard now defaults to the newer
Workers-based static-asset deployment (`wrangler deploy`) rather than
classic Pages — `wrangler.jsonc` at the project root is already configured
for that (`assets.directory: "dist"`, `not_found_handling:
"single-page-application"` for SPA routing on deep links like
`/artist/some-artist`). There's deliberately no `public/_redirects` file —
that's the old Pages-only mechanism, and shipping both causes Cloudflare to
reject the deploy ("infinite loop detected" on the redirect rule).

1. Connect the repo in the Cloudflare dashboard (build command `npm run
   build`, output directory `dist`, Node version 20+), or deploy directly:
   ```
   npm run build
   npx wrangler deploy
   ```
2. Add the same `VITE_FIREBASE_*` variables from `.env` as environment
   variables in the Cloudflare project settings. These are public client
   identifiers, safe to expose.
3. Custom domain + HTTPS are handled by Cloudflare automatically.

## Project structure

```
src/
  components/   reusable UI (layout, player, music cards, auth guards, form inputs, licence/track modals)
  contexts/     AuthContext (Firebase Auth + user profile), PlayerContext (persistent player)
  hooks/        small cross-cutting hooks (e.g. cached artist summary lookups)
  lib/          Firebase client SDK initialisation, typed Cloud Functions callable wrapper
  pages/        route components, grouped by area (marketing, auth, onboarding, fan, artist, dj, track, requests, admin)
  services/     all Firestore/Storage/Functions calls — no Firestore calls in components
  types/        shared TypeScript types mirroring the Firestore schema
  utils/        formatting, slugs, auth error mapping, upload format/size limits
sw-src/sw.ts  custom service worker (Workbox precache + FCM background push) — bundled via vite-plugin-pwa's injectManifest, kept outside src/ so its WebWorker types don't clash with the app's DOM types
functions/
  src/
    stripe/       checkout, billing portal, subscription webhook, Connect onboarding + webhook, licence payment
    support/      allocation callable + supporter-count trigger
    licensing/    licence requests, agreements/signing, secure downloads
    messaging/    conversation messages
    payouts/      payout requests, daily pending→available balance promotion
    admin/        verification review, copyright/report review, moderation, platform settings, audit log
    notifications/ single Firestore trigger that turns every notifications/{id} write into a push
firestore.rules, storage.rules, firestore.indexes.json, firebase.json
docs/FIRESTORE_SCHEMA.md
```

Business logic lives in `services/`; components call services and render
state — kept separate on purpose so the security-sensitive logic (who can
write what) is easy to audit in one place per collection.

## Security model

Anything involving money, licensing, counts, or trust is written only by
Cloud Functions using the Admin SDK — never trusted from the client. A few
examples enforced directly in `firestore.rules`:

- `playCount`, `followerCount`, `supporterCount`, `verified`, `subscriptionStatus` are frozen on client writes.
- `licenceRequests`, `licenceAgreements`, `transactions`, `payouts`, `auditLogs` are entirely `write: if false` — every write goes through a callable.
- A user can never set their own `roles` to include `admin`, nor set `suspended`/`stripeCustomerId` themselves.
- `subscriptionPlans` and `platformSettings` are public-read, admin-write-only — pricing and fees are never hard-coded in the app.

A `suspended: true` flag is also *enforced*, not just displayed: a
`beforeUserSignedIn` blocking function (`functions/src/admin/enforceSuspension.ts`)
rejects sign-in for suspended accounts.

## Known simplifications (documented, not hidden)

- **DJ allowlist**: an artist's "DJs I approve" policy currently enforces the
  same bar as "verified DJs only" — a genuine per-artist allowlist UI is a
  natural follow-up, not built here.
- **Preview generation**: artists upload a separate preview file rather than
  the platform auto-trimming the original — adding automatic trimming would
  mean running audio processing (e.g. ffmpeg) in a Cloud Function.
- **Search**: Firestore-native prefix search on denormalised lowercase
  fields. Swap in a dedicated provider (e.g. Algolia/Typesense) behind
  `searchService.ts` if typo-tolerant/ranked search is needed later.
- **Balance clearing period**: a fixed 7-day pending→available window via a
  daily scheduled function, not a configurable per-transaction hold.
- **Messaging**: text messages with per-request scoping and notifications
  are in; read receipts beyond `readBy: [senderId]` on send, block, and file
  attachments are not — the schema documents them for a follow-up pass.
- **Push notifications**: implemented via Firebase Cloud Messaging. Every
  in-app notification (already written to Firestore by existing functions)
  now also triggers a real push through `onNotificationCreatePush`, with no
  changes needed at each call site. See "Push notifications setup" below.

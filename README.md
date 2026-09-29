# BackTheVibes — independent music platform

**Discover independent artists, support them directly, and license their music, all in one place.**

[![Live site](https://img.shields.io/badge/live-backthevibes.com-1db954?style=flat-square)](https://www.backthevibes.com/)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Stripe Connect](https://img.shields.io/badge/Stripe_Connect-635BFF?style=flat-square&logo=stripe&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)

**Live:** [www.backthevibes.com](https://www.backthevibes.com/)

BackTheVibes is a full-stack music platform with separate experiences for
**fans**, **artists**, **DJs/businesses**, and **admins**. Fans discover music
and pay artists directly. Artists publish tracks, gate them behind access tiers,
and track their growth. DJs and businesses negotiate and sign licence agreements
with artists. Anything involving money, access, or trust is enforced on the
server.

---

## Contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Getting started](#getting-started)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Further documentation](#further-documentation)

---

## Screenshots

<!-- Add screenshots to docs/screenshots/ and uncomment the lines below. -->
<!--
| Discover | Artist dashboard | Track page |
|---|---|---|
| ![Discover](docs/screenshots/discover.png) | ![Artist dashboard](docs/screenshots/artist-dashboard.png) | ![Track](docs/screenshots/track.png) |
-->

_Screenshots coming soon. For now, see the [live site](https://www.backthevibes.com/)._

---

## Features

### Fans
- Discover, search, follow, like, and build playlists
- A persistent player that plays tracks through the official **YouTube IFrame
  Player API**. It is click-to-load and uses `youtube-nocookie.com`.
- **Direct support.** Fans make one-off payments that go straight to the
  artist's Stripe Connect account and see the exact fee split before checkout.
- Supporter-only and follower-only content, fan offers, and artist stories
- Push notifications and an installable PWA

### Artists
- Public profile at `/artist/{slug}` with posts, stories, and a track catalogue
- **Access tiers** per track: public, followers, supporters, DJ-only, early
  access, and private. The video ID is only sent after a server-side access check.
- Dashboards for music, growth analytics, revenue history, fan offers,
  community, and DJ requests
- Stripe Connect Express onboarding. Payouts run on Stripe's own schedule, and
  the platform never holds artist money.

### DJs and businesses
- Browse tracks that are open to licensing, save them to crates, and request access
- Negotiate proposals with artists, then **sign digital licence agreements**.
  Agreements are versioned, become immutable once both parties sign, and
  include a drawn e-signature.
- Licence fees are paid by Stripe destination charge, straight to the artist

### Admins
- Verification queue for artists and DJs, copyright claims, and user and track
  reports
- User suspension, enforced on the server as well as in the UI
- Platform settings for fees, plans, retention, and the payments provider
- Audit log and security incident tracking

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, lucide-react |
| Backend | Firebase Auth, Cloud Firestore, Cloud Storage, Cloud Functions (TypeScript) |
| Payments | Stripe Checkout and Stripe Connect Express destination charges (a Ryft migration is planned, see below) |
| Playback | YouTube IFrame Player API (no hosted audio) |
| Notifications | Firebase Cloud Messaging and a custom Workbox service worker |
| Hosting | Cloudflare Workers static assets, SPA routing, and an edge worker for share previews |
| Tooling | oxlint, the Node test runner, and the Firestore rules emulator tests |

> **Payments status:** Stripe is being phased out in favour of **Ryft**. An
> admin-controlled `platformSettings/default.paymentsProvider` flag
> (`stripe | paused | ryft`) can pause all new checkouts. While paused, users
> see an honest "temporarily unavailable" message instead of an error.

---

## Architecture

```
          ┌────────────────────────────┐
Browser ─▶│ React SPA (Cloudflare edge)│──────── YouTube IFrame API (click-to-load)
          └─────────────┬──────────────┘
                        │ Firebase SDK (reads) / callable functions (writes)
          ┌─────────────▼──────────────┐       ┌──────────────────────┐
          │  Cloud Functions (Admin SDK)│◀────▶│ Stripe / Stripe Connect│
          └─────────────┬──────────────┘ webhook└──────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │ Firestore + Storage (rules) │
          └────────────────────────────┘
```

- **Services layer:** every Firestore, Storage, and Functions call lives in
  `src/services/`. Components never call Firestore directly, so the
  security-sensitive logic for each collection can be audited in one place.
- **Server-authoritative writes:** anything that affects money, licensing,
  counts, roles, or moderation goes through a Cloud Function.
- **Split track media:** `tracks/{id}` is public so locked tracks can still show
  their title and artwork. The YouTube video ID lives in `trackMedia/{id}`,
  which only the Admin SDK can read, and is disclosed by `getTrackYoutubeInfo`
  after an entitlement check.

See [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md) for the full data model.

---

## Security model

Firestore rules enforce these rules directly:

- `playCount`, `followerCount`, `supporterCount`, `verified`, and
  `subscriptionStatus` cannot be changed by client writes.
- `licenceRequests`, `licenceAgreements`, `transactions`, and `auditLogs` are
  `write: if false`. Every write goes through a callable function.
- Users can never grant themselves `admin` or set `suspended` or
  `stripeCustomerId`.
- `subscriptionPlans` and `platformSettings` are public-read and admin-write only.
  Pricing and fees are never hard-coded.
- Platform fees are calculated on the server from admin settings. They are
  never taken from the client and are collected through Stripe's
  `application_fee_amount`.
- Checkout webhooks are idempotent on the Stripe Checkout Session ID.

Suspension is enforced, not just shown. `requireActiveUser`
(`functions/src/roles.ts`) rejects state-changing callables for suspended
accounts, and the sign-in page signs them straight back out. See [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) and
[`SECURITY_INCIDENT_RESPONSE.md`](SECURITY_INCIDENT_RESPONSE.md) for more.

---

## Getting started

### Prerequisites
- Node.js **20+**
- A Firebase project on the **Blaze** plan, with Auth (email/password and
  Google), Firestore, Storage, and Functions enabled
- The Firebase CLI: `npm install -g firebase-tools`
- A Stripe account (test mode is fine)

### 1. Install and configure

```bash
git clone https://github.com/dean1234533/Music-Platform-App.git
cd Music-Platform-App
cp .env.example .env      # fill in your Firebase web app config + VAPID key
npm install
npm run dev
```

All `VITE_*` values are public client identifiers. Never put secret keys in `.env`.

### 2. Deploy rules and indexes

```bash
firebase login
# set your project id in .firebaserc, then:
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 3. Configure Stripe and deploy Cloud Functions

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set STRIPE_CONNECT_WEBHOOK_SECRET

cd functions && npm install && npm run build && cd ..
firebase deploy --only functions
```

Then create two webhook endpoints in the Stripe dashboard:

| Endpoint | Events |
|---|---|
| `stripeWebhook` function URL | `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded` |
| `stripeConnectWebhook` function URL (listen to **Connect** events) | `account.updated` |

### 4. Bootstrap the first admin

In the Firestore console, add `"admin"` to `users/{yourUid}.roles`. This is the
only time a person sets the admin role instead of the app. Next, open
`/admin/settings` to publish plans and set fee percentages.

### 5. Push notifications (optional)

1. Go to Firebase Console, then **Cloud Messaging**, then **Web Push
   certificates**. Generate a key pair and set `VITE_FIREBASE_VAPID_KEY`.
2. The Firebase config is repeated in `sw-src/sw.ts` because the service worker
   is bundled separately. Keep both copies in sync.
3. Enable push from `/app/settings`. Every existing in-app notification is also
   sent as a push through `onNotificationCreatePush`.

On iOS, web push only works when the PWA has been added to the home screen
(iOS 16.4+).

---

## Deployment

The frontend deploys to **Cloudflare Workers static assets**. `wrangler.jsonc`
is already set up with `assets.directory: "dist"` and SPA fallback, so there is
no `_redirects` file.

```bash
npm run build
npx wrangler deploy
```

Or connect the repo in the Cloudflare dashboard with build command
`npm run build`, output directory `dist`, and Node 20+. Add the `VITE_FIREBASE_*`
variables to the project settings.

### Keeping costs near £0 at hobby scale
- Set a **budget alert** in Google Cloud Billing before inviting real users.
- Functions have no `minInstances`, so they scale to zero when idle.
- Tracks are YouTube links rather than hosted audio, so Storage only holds
  artwork, story media, and documents.
- Stripe charges only per transaction. Cloudflare's free tier covers hosting.

---

## Project structure

```
src/
  components/   UI: layout, player, music cards, licence/track modals, auth guards
  contexts/     AuthContext, PlayerContext (persistent YouTube player), ToastContext
  hooks/        entitlements, media upload, install prompt, unread counts
  lib/          Firebase init, typed callable wrapper, SEO, YouTube IFrame loader
  pages/        routes: marketing, auth, fan, artist, dj, agreements, legal, admin, blog
  services/     every Firestore/Storage/Functions call
  types/        shared types mirroring the Firestore schema
  utils/        formatting, slugs, YouTube URL validation, password policy
sw-src/         custom service worker (Workbox precache + FCM background push)
worker/         Cloudflare edge worker (share/OG previews, public JSON API)
functions/src/
  stripe/       checkout, billing portal, Connect onboarding, webhooks, licence payments
  support/      one-off fan → artist support checkout + triggers
  licensing/    requests, offers, agreements/signing, events
  admin/        verification, copyright, reports, moderation, settings, incidents
  account/      data export + account deletion
  notifications/, stories/, retention/, legal/
tests/          flow-contract tests + Firestore rules emulator tests
wordpress-plugin/  BackTheVibes embed plugin for WordPress
```

---

## Testing

```bash
npm run lint        # oxlint
npm test            # flow-contract tests
npm run test:rules  # Firestore security rules tests
npm run check       # build + lint + all tests + functions build
```

---

## Known limitations

- **Search** uses Firestore prefix search on denormalised lowercase fields. For
  typo-tolerant search, swap in Algolia or Typesense behind `searchService.ts`.
- **DJ allowlist.** The "DJs I approve" setting currently applies the same rule
  as "verified DJs only".
- **Master and stem exchange** happens outside the platform. The legacy download
  endpoint returns HTTP 410 with an explanation.
- **Contract export** uses the browser's print-to-PDF.

---

## Further documentation

| Document | Purpose |
|---|---|
| [`PRODUCT_FLOW.md`](PRODUCT_FLOW.md) | End-to-end journey for every role |
| [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md) | Data model |
| [`MIGRATION_REPORT.md`](MIGRATION_REPORT.md) | Move from hosted audio to YouTube, and to Connect destination charges |
| [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) | Security review |
| [`COMPLIANCE_CHECKLIST.md`](COMPLIANCE_CHECKLIST.md) | Legal and compliance items |

---

## Author

Built by **Dean Da Dev**, a UK full-stack developer building web apps, websites,
and AI tools.

🌐 [dean-da-dev.co.uk](https://www.dean-da-dev.co.uk/) · 💼 [More projects](https://www.dean-da-dev.co.uk/portfolio) · 🐙 [GitHub](https://github.com/dean1234533)

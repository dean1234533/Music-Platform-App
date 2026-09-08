# Wavelength Product Flow Audit

Audit date: 2026-09-07. Scope: the existing React/Firebase/Stripe application. This is an audit of implemented behaviour, not a redesign. “PASS” means verified by code inspection and the automated/static checks described below. “NEEDS MANUAL TEST” means the code path exists but requires a real browser, email, Firebase Auth identity, Stripe account, push-capable device, or two human roles. “FAIL” is an honest remaining product gap.

## Route and system map

- Public: `/`, `/pricing`, `/terms`, `/privacy`, `/copyright`, public artist/track links.
- Authentication: `/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`, onboarding and add-role.
- Listener/fan: `/app/home`, discover, search, following, supported artists, offers, library, playlists, notifications, subscription, profile, settings.
- Artist: `/dashboard/artist`, music, upload, stories and story analytics, community, fan offers, DJ requests/deals, revenue, settings.
- DJ: `/dj/discover`, requests, crates, analytics, profile; request chat and deal negotiation live at `/requests/:requestId`.
- Shared protected: `/requests/:requestId`, `/agreements`, `/agreements/:agreementId`.
- Admin: users, verification, reports, platform settings, audit log, security incidents.
- Backend: Firebase Auth, Firestore, Storage, callable/scheduled/triggered Cloud Functions, Stripe Billing, Stripe Connect and signed Storage URLs.
- Authoritative records: `users` for roles and summary subscription state; `subscriptions` for Stripe subscription entitlement; `supportAllocations` and `supportRelationships` for allocations/access; `licenceRequests` for request status; append-only `licenceOffers` for negotiation; `licenceAgreements` for signed contract/payment/download entitlement; `copyrightClaims` plus track moderation fields for copyright state.

## Journey results

| # | Journey / expected flow | Before audit / problem | Fix or verified current behaviour | Result |
|---:|---|---|---|---|
| 1 | Complete app map | No single current map. | Routes, role shells, backend boundaries and sources of truth documented here and in `PRODUCT_FLOW.md`. | PASS |
| 2 | Account creation | Marketing role query was discarded. | Role intent now survives signup, verification and onboarding. | NEEDS MANUAL TEST |
| 3 | Strong passwords | 12–64 character and common-password checks exist; server policy is optional until Identity Platform is enabled. | Client checks retained; admin one-time policy action remains explicit. | NEEDS MANUAL TEST |
| 4 | Login and correct landing | Every direct login defaulted to fan home. | Login now loads the profile and selects onboarding/admin/artist/DJ/fan destination; protected deep links retain precedence. | NEEDS MANUAL TEST |
| 5 | PWA install | Banner covered roles, but only fan settings exposed install later. | Shared install control now appears in fan, artist, DJ and admin account settings; installed/dismissed handling retained. | NEEDS MANUAL TEST |
| 6 | Role navigation | Mobile logo/profile hardcoded to fan routes. | Top bar now resolves role-shell home and profile/settings destinations. RoleRoute guards remain. | PASS |
| 7 | Public discovery | Landing, pricing and public links exist; live catalogue data is used. | No fake ranking was introduced. Anonymous media now goes through the entitlement callable. | NEEDS MANUAL TEST |
| 8 | Public artist profile | Profile, tracks, posts, Stories, follow/support and offers are data-backed. | Visibility-specific queries are retained. | NEEDS MANUAL TEST |
| 9 | Track share | Canonical artist/track URLs and clipboard/social targets exist. | Direct shared track route remains public when visibility permits. | PASS |
| 10 | Artist onboarding | Free artist creation existed. | `?role=artist` now preselects the intended role through the full signup flow. | NEEDS MANUAL TEST |
| 11 | Music upload | Metadata, visibility, DJ options, copyright declaration and three audio derivatives exist. | Upload pipeline retained; artist can now delete a track through a validating backend operation. | NEEDS MANUAL TEST |
| 12 | Compression | Browser compression creates master/stream/preview objects with validation and progress. | Build confirms worker integration; real codec/device matrix remains manual. | NEEDS MANUAL TEST |
| 13 | Copyright declaration | Required rights confirmation and server acceptance records exist. | Server-maintained hash/duplicate metadata remains client-immutable. | PASS |
| 14 | Public preview | Storage preview was public even after takedown. | Storage is owner-only; a callable checks current visibility, relationship, roles, takedown and streaming restrictions before a 10-minute signed URL. | NEEDS MANUAL TEST |
| 15 | Story creation | Image/video/audio, visibility, CTA, highlight and deletion flows exist. | Existing server validation retained. | NEEDS MANUAL TEST |
| 16 | Story viewing | Tiered Firestore reads, viewer/reaction/poll analytics and expiry exist. | Cross-location Storage relationship checks remain an architectural limitation for restricted story files. | FAIL |
| 17 | Follow | Follow/unfollow and server-updated count exist with feedback. | Ownership rules verified. | NEEDS MANUAL TEST |
| 18 | Supporter subscription | Stripe checkout/portal and webhook-backed entitlement exist. | Only fan subscriptions are offered; creator legacy subscriptions are ignored/retired. | NEEDS MANUAL TEST |
| 19 | Support allocation | Allocation callable validates active subscription and reconciles relationships. | Relationship records remain the content gate. | NEEDS MANUAL TEST |
| 20 | Supporter content | Posts/tracks/Stories query by supporter relationship. | Firestore document gating verified; restricted Storage story delivery still needs architectural work. | FAIL |
| 21 | Cancellation | Billing portal and webhook state transitions exist. | Entitlement derives from Stripe status, not return URL. | NEEDS MANUAL TEST |
| 22 | Artist revenue | Transactions, balances, payout eligibility and Stripe Connect exist. | Connect readiness is webhook/backend-derived. | NEEDS MANUAL TEST |
| 23 | Share/growth | Share controls and real follower/supporter/play metrics exist; no dedicated growth workspace. | Actual controls documented without claiming a missing campaign system. | FAIL |
| 24 | DJ onboarding | Free DJ profile and verification state exist. | `?role=dj` now persists through signup/onboarding. | NEEDS MANUAL TEST |
| 25 | DJ discovery | Data-backed DJ-promotion query and filters exist. | Bounded query avoids loading the entire catalogue. | NEEDS MANUAL TEST |
| 26 | Artist DJ deal creation | Reusable deal templates support terms, price, duration and deletion. | Existing owner rules and UI retained. | NEEDS MANUAL TEST |
| 27 | DJ request | Callable validates DJ role, track policy and creates request/conversation. | Direct request route remains party-only. | NEEDS MANUAL TEST |
| 28 | Artist↔DJ chat | Server-only message writes, participant checks and message limits exist. | Notification deep link fixed from nonexistent `/messages/*` to the request. | NEEDS MANUAL TEST |
| 29 | Custom offer | Append-only offer and counter-offer flow exists. | Offer history is not overwritten. | NEEDS MANUAL TEST |
| 30 | Artist-defined deal | Track settings and reusable deals can seed requests. | Terms are displayed before acceptance. | NEEDS MANUAL TEST |
| 31 | Agreement generation | Callable produces agreement from accepted terms. | Agreement is server-generated and party-readable only. | NEEDS MANUAL TEST |
| 32 | E-signature | Legal name, drawn signature, timestamp and party checks exist. | Signature storage stays party/admin-only. | NEEDS MANUAL TEST |
| 33 | Agreement versioning | Content hash and versioned acceptances/signatures exist. | Term changes require a new agreement/version. | PASS |
| 34 | Free licence | Both signatures activate a zero-price agreement. | Download gate uses agreement state. | NEEDS MANUAL TEST |
| 35 | Paid licence | Both signatures lead to server-created Stripe Checkout; webhook unlocks payment. | Redirect alone cannot activate entitlement. | NEEDS MANUAL TEST |
| 36 | Secure DJ download | Callable checks DJ party, active/paid/expiry state and logs a short URL. | Original Storage path stays client-private. | NEEDS MANUAL TEST |
| 37 | Download history | Server download logs are party/admin-readable and client immutable. | Existing history query retained. | PASS |
| 38 | Agreement expiry | Expiry is checked at download and scheduled cleanup handles stale records. | Clock/production scheduler requires manual verification. | NEEDS MANUAL TEST |
| 39 | Licence cancellation/void | Withdrawal exists before agreement; no complete bilateral post-signature cancellation/void workflow. | Not represented as implemented in product documentation. | FAIL |
| 40 | Copyright report | Authenticated claim form, evidence, declaration and admin review exist. | Evidence and claim writes remain protected. | NEEDS MANUAL TEST |
| 41 | Copyright restriction | Admin can restrict discovery/licensing/streaming or remove track. | Preview/stream signed URL now enforces streaming restriction and takedown. Existing active licence policy remains contract-led. | PASS |
| 42 | Admin | RoleRoute plus server `requireAdmin`, logs, verification, reports, settings and incidents exist. | Account/PWA controls added to admin settings. | NEEDS MANUAL TEST |
| 43 | Report/block | Track/user reporting and admin resolution exist; end-user blocking is not implemented. | Missing block behaviour is not advertised as present. | FAIL |
| 44 | Notifications | Notification docs often lacked IDs; clicking did not navigate; active-window push did not deep-link. | Snapshot IDs injected, click marks read and navigates, push navigates existing window. | NEEDS MANUAL TEST |
| 45 | Settings | Fan/artist/DJ settings existed; admin lacked account controls. | Install, password, export and delete controls are now shared across all role settings. | PASS |
| 46 | Change password | Reauthentication and strength checks exist; Google-only accounts are explained. | Existing safe flow retained. | NEEDS MANUAL TEST |
| 47 | Delete account | Backend omitted active Stripe cancellation and supporter/new content cleanup. | Deletion now cancels billing first and removes subscription, allocations, relationships, posts, fan offers/claims and media where permitted. | NEEDS MANUAL TEST |
| 48 | Artist deletion | Tracks with active licences are retained privately; other media/profile/content is removed. | Posts/offers/claims cleanup added; legal records stay retained. | NEEDS MANUAL TEST |
| 49 | DJ deletion | Profile/crates removed; agreement evidence remains. | Existing retention boundary retained. | NEEDS MANUAL TEST |
| 50 | Fan deletion | Playlists/follows/likes/notifications were removed, but billing/support state was not. | Stripe and all supporter allocation/relationship records now cleaned. | NEEDS MANUAL TEST |
| 51 | Retention | Scheduled policies, admin settings and legal holds exist. | No retention guarantee is claimed without observing scheduled production runs. | NEEDS MANUAL TEST |
| 52 | Logout | Auth/cache cleared, but global audio queue could survive. | Player pauses and clears track/queue when the authenticated user logs out or changes. | PASS |
| 53 | Errors | Most forms surface errors; some subscription/listener callbacks still lack explicit error views. | Critical notification/player/delete actions now show errors. | FAIL |
| 54 | Empty states | Major lists use explicit empty states. | Placeholder future-search copy removed. | PASS |
| 55 | Loading states | Auth/profile/list screens have loading states. | Auth bootstrap now exits loading if profile initialization fails. | PASS |
| 56 | Mobile | Role bottom navigation and “More” sheet exist; top bar was role-confused. | Contextual top bar fixed. Full device/cutout/keyboard pass remains manual. | NEEDS MANUAL TEST |
| 57 | Tablet | Responsive breakpoints exist. | Real iPad portrait/landscape QA remains manual. | NEEDS MANUAL TEST |
| 58 | Desktop | Sidebars and responsive grids exist. | Browser matrix remains manual. | NEEDS MANUAL TEST |
| 59 | Music player | Persistent player, queue, next/previous and continuous playlist playback exist. | Access errors now notify; logout/account switch clears playback. | NEEDS MANUAL TEST |
| 60 | Multi-role | Add-role and dashboard switcher exist; fan surface is shared by every account. | Pricing add-role links now preserve artist vs DJ intent. | NEEDS MANUAL TEST |
| 61 | Role upgrade | “Upgrade” means adding a free creator role, not buying a creator plan. | No creator checkout or upgrade wall is exposed. | PASS |
| 62 | Verification | Artist/DJ requests and admin approval exist; badges follow approved state. | Existing server-owned status retained. | NEEDS MANUAL TEST |
| 63 | Search | Artist and public track-title prefix search works. Album, DJ and genre search are not implemented. | Misleading “later phase” copy removed; current scope stated accurately. | FAIL |
| 64 | Discovery | New releases/DJ-ready/genre feeds use real bounded queries. | No fake rankings found. | PASS |
| 65 | Payment failures | Stripe webhooks are authoritative and transaction IDs deduplicate invoice credits. | Cancel/failure/refund/dispute paths require Stripe test-mode events. | NEEDS MANUAL TEST |
| 66 | Supporter payment failure | Subscription status maps from Stripe; invalid status removes entitlement through relationship reconciliation. | Grace-period semantics depend on Stripe configuration. | NEEDS MANUAL TEST |
| 67 | Stripe Connect | Onboarding link is backend-created; readiness is webhook/account derived. | Return URL alone does not mark payout-ready. | NEEDS MANUAL TEST |
| 68 | Direct URL access | Protected, role and party gates exist. | Incorrect examples `/agreement/*`, `/conversation/*`, `/download/*` are not product routes; canonical routes are documented. | PASS |
| 69 | Browser refresh | Auth provider waits for Firebase and profile snapshots. | Bootstrap failure no longer leaves an endless loading screen. | NEEDS MANUAL TEST |
| 70 | Deep links | ProtectedRoute stores and restores intended location. | Notification and push links now use/navigate real destinations. | NEEDS MANUAL TEST |
| 71 | Session expiry | Firebase rejects protected writes/callables; ProtectedRoute reacts to auth loss. | Human-facing reauth behaviour across every open modal needs browser testing. | NEEDS MANUAL TEST |
| 72 | Firestore consistency | Some summary state is denormalised intentionally. | Authoritative records are documented above; webhook/callable ownership retained. | PASS |
| 73 | Status consistency | Typed request/agreement/subscription/copyright/verification statuses are handled in current UIs. | Legacy or operational edge states require seeded-data QA. | NEEDS MANUAL TEST |
| 74 | Dead buttons | Static handler/route inspection found broken notification navigation and role CTA query loss. | Those paths were fixed. A literal click of every stateful button requires seeded multi-role accounts. | NEEDS MANUAL TEST |
| 75 | Old plan logic | No creator checkout remains; admin seed retires creator plans. | UI consistently offers free artist/DJ access. | PASS |
| 76 | Copy consistency | Pricing correctly says creators free and fans optionally support. Search had future-phase copy. | Future-phase copy removed; fan supporter and per-licence DJ payment are distinguished. | PASS |
| 77 | Security preservation | Client writes cannot elevate admin/subscription/moderation/contract state. | New delete/playback paths moved to validating callables; Storage rules tightened. | PASS |
| 78 | Performance | Catalogue queries are bounded; media is compressed. Main JS still produces large chunk warnings. | No unbounded track/message/notification query found; route-level code splitting remains needed. | FAIL |
| 79 | Media cleanup | Track/account delete cleans main media; fixed profile filenames overwrite replacements. Failed mid-upload can leave orphan derivatives. | Track callable deletes all known derivatives/artwork. Abandoned upload cleanup remains missing. | FAIL |
| 80 | Automated coverage | Repository had no tests. | Added zero-dependency flow/rules contract tests. Full Firebase emulator and Stripe integration suites remain absent. | FAIL |
| 81 | Manual checklist | None existed. | This table is the requested executable checklist with honest results. | PASS |
| 82 | Product flow document | No single actual-behaviour document. | Added `PRODUCT_FLOW.md`. | PASS |
| 83 | Build check | No test scripts; rules emulator unavailable. | TypeScript/build, lint, functions compile and contract tests run. Emulator is blocked by missing Java and 100% disk. | NEEDS MANUAL TEST |
| 84 | Acceptance test | Cannot truthfully certify email, Stripe, push, PWA and two-party flows without test identities/external events. | Critical code breaks fixed; remaining manual acceptance sequence is below. | NEEDS MANUAL TEST |

## Manual acceptance checklist

- Visitor: landing → public artist → public sample → signup on phone/tablet/desktop.
- Fan: email + Google signup → verification → discover → follow → like/save → playlist → continuous play → supporter checkout → allocation → gated content → cancel.
- Artist: signup → profile → upload supported/unsupported formats → publish/private/takedown → Story types/visibility → share → offer/deal → revenue/Connect → delete content/account.
- DJ: signup → profile/verification → discovery filters → request → two-party chat → offer/counter → both signing orders → free/paid activation → download/history/expiry.
- Admin: direct-route denial for non-admin, then admin moderation, verification, copyright, fees, retention, legal hold, incident logging, install banner/settings.
- Recovery: wrong/expired links, cancelled checkout, failed invoice, duplicate webhook, refund/dispute, offline refresh, session expiry, denied push, PWA installed/dismissed, multiple accounts on one device.

## Verification performed

- `npm run build`: PASS.
- `npm run lint`: PASS with pre-existing React-effect/Fast Refresh warnings and no errors.
- `npm --prefix functions run build`: PASS.
- `npm test`: PASS after adding source-level journey/security invariants.
- Firebase rules compilation/deployment: required before release.
- Firebase emulator behavioural tests: NEEDS MANUAL TEST on a machine with Java; this host has no Java runtime and only 86 MiB free, so the Firebase test dependency/emulator could not be installed or started.
- Stripe/email/push/PWA/two-user flows: NEEDS MANUAL TEST with test accounts and providers.

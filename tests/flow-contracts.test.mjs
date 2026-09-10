import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public, fan, artist, DJ, agreement, and admin routes are registered', () => {
  const app = read('src/App.tsx')
  for (const route of ['/', '/pricing', '/sign-in', '/sign-up', '/app', '/dashboard/artist', '/dj', '/agreements', '/admin']) {
    assert.match(app, new RegExp(`path=["']${route.replace('/', '\\/')}["']`))
  }
})

test('artist annual pricing and role CTAs preserve their intent', () => {
  const pricing = read('src/pages/marketing/PricingPage.tsx')
  assert.match(pricing, /title="Artist Membership" price="£29\.99" suffix="\/year"/)
  assert.match(pricing, /About £2\.50 a month, billed once yearly/)
  assert.match(pricing, /title="DJ" price="Free"/)
  assert.match(pricing, /add-role\?role=artist/)
  assert.match(pricing, /add-role\?role=dj/)
  assert.match(pricing, /Up to 10 stored tracks/)
  assert.doesNotMatch(pricing, /unlimited/i)
  assert.doesNotMatch(pricing, /Artist Pro(?:\+|\b)|DJ Pro(?:\+|\b)|upgrade artist|upgrade DJ/i)
})

test('track storage allowance is shown before upload and enforced by Firestore', () => {
  const upload = read('src/pages/artist/dashboard/UploadTrackPage.tsx')
  const rules = read('firestore.rules')
  assert.match(upload, /MAX_STORED_TRACKS_PER_ARTIST/)
  assert.match(upload, /Stored track allowance/)
  assert.match(rules, /trackCount[\s\S]*?< 10/)
})

test('launch supporter pricing stays low-friction and legacy tiers are retired', () => {
  const seedPlans = read('functions/src/admin/seedPlans.ts')
  assert.match(seedPlans, /fan_supporter[\s\S]*?priceMinor: 499/)
  assert.match(seedPlans, /fan_super_supporter/)
  assert.doesNotMatch(read('src/pages/marketing/PricingPage.tsx'), /artificial limits/i)
})

test('revenue shares use net payment revenue and expose the launch percentages', () => {
  const webhook = read('functions/src/stripe/webhook.ts')
  const pricing = read('src/pages/marketing/PricingPage.tsx')
  assert.match(webhook, /net_after_tax_and_processing/)
  assert.match(webhook, /paymentDetailsForInvoice/)
  assert.match(webhook, /billingSettlements/)
  assert.match(webhook, /stripePaymentIntentIds/)
  assert.match(webhook, /newlyRefundedCustomerMinor/)
  assert.match(read('functions/src/payouts/promoteBalances.ts'), /netMinor - \(data\.refundedMinor \?\? 0\)/)
  assert.match(pricing, /80% of net membership revenue/)
  assert.match(pricing, /takes 15% of net transaction revenue/)
  assert.match(pricing, /available balance reaches £25/)
})

test('email signup cannot continue before verification', () => {
  const page = read('src/pages/auth/VerifyEmailPage.tsx')
  assert.match(page, /emailVerified/)
  assert.match(page, /not verified yet/)
})

test('install banner only shows once signed in, and first-time profiles are awaited', () => {
  const banner = read('src/components/pwa/InstallBanner.tsx')
  const signIn = read('src/pages/auth/SignInPage.tsx')
  const authContext = read('src/contexts/AuthContext.tsx')
  const users = read('src/services/userService.ts')
  assert.match(banner, /if \(!firebaseUser \|\| !isAuthenticatedRoute\(pathname\)\) return null/)
  assert.match(banner, /isAuthenticatedRoute\(pathname\)/)
  assert.match(banner, /pathname === prefix \|\| pathname\.startsWith/)
  assert.match(signIn, /await ensureUserDocument\(user\)/)
  // Email signup itself has no ensureUserDocument call — AuthContext's own onAuthStateChanged
  // listener calls it for every signed-in user regardless of entry point, so this isn't a gap.
  assert.match(authContext, /await ensureUserDocument\(user\)/)
  assert.match(authContext, /profileReadyUid !== firebaseUser\.uid/)
  assert.match(users, /getIdToken\(true\)/)
  assert.match(users, /permission-denied[\s\S]*?unavailable/)
})

test('installed PWA launches into the app with a branded iOS startup screen', () => {
  const app = read('src/App.tsx')
  const config = read('vite.config.ts')
  const html = read('index.html')
  const splash = read('src/components/pwa/PwaLaunchScreen.tsx')
  assert.match(config, /start_url: '\/launch'/)
  assert.match(app, /isStandaloneDisplayMode\(\) \? <Navigate to="\/launch" replace \/>/)
  assert.match(app, /workspaceHomeForRoles\(profile\.roles\)/)
  assert.match(html, /rel="apple-touch-startup-image"/)
  assert.match(splash, /pwa-launch-bg\.png/)
  assert.match(splash, /<BrandMark \/>/)
})

test('role-only accounts cannot enter another workspace or inherit its navigation', () => {
  const app = read('src/App.tsx')
  const roleRoute = read('src/components/auth/RoleRoute.tsx')
  const workspaceRoute = read('src/lib/workspaceRoute.ts')
  const signIn = read('src/pages/auth/SignInPage.tsx')
  assert.match(app, /<RoleRoute role="fan">[\s\S]*?<FanDashboardLayout \/>[\s\S]*?<\/RoleRoute>/)
  assert.match(roleRoute, /workspaceHomeForRoles\(profile\?\.roles \?\? \[\]\)/)
  assert.match(workspaceRoute, /roles\.includes\('admin'\)[\s\S]*?return '\/admin\/users'/)
  assert.match(signIn, /return workspaceHomeForRoles\(profile\.roles\)/)
})

test('installed app shell respects iPhone safe areas and cannot exceed the viewport', () => {
  const topBar = read('src/components/layout/TopBar.tsx')
  const appShell = read('src/components/layout/AppShell.tsx')
  const installBanner = read('src/components/pwa/InstallBanner.tsx')
  assert.match(topBar, /env\(safe-area-inset-top\)/)
  assert.match(topBar, /w-full min-w-0/)
  assert.match(appShell, /max-w-full[\s\S]*?overflow-x-hidden/)
  assert.match(appShell, /w-full min-w-0 flex-1 overflow-y-auto/)
  assert.match(installBanner, /if \(isStandalone \|\| dismissed\) return null/)
})

test('browser tab uses the approved BTV brand favicon', () => {
  const html = read('index.html')
  assert.match(html, /rel="icon"[^>]+backthevibes-favicon-48\.png\?v=4/)
  assert.match(html, /rel="icon"[^>]+backthevibes-favicon-96\.png\?v=4/)
  assert.match(html, /rel="shortcut icon"[^>]+favicon\.ico\?v=4/)
  assert.doesNotMatch(html, /href="\/backthevibes-mark\.svg"/)
})

test('the fan home feed does not repeat artists or releases across sections', () => {
  const home = read('src/pages/fan/HomePage.tsx')
  assert.match(home, /Stories from your artists/)
  assert.match(home, /new Map\(stories\.map\(\(story\) => \[story\.storyId, story\]\)\)/)
  assert.match(home, /followedReleaseIds/)
  assert.match(home, /otherNewReleases/)
  assert.doesNotMatch(home, /Stories from artists you support/)
})

test('fan offers include platform-wide offers and preserve relationship access', () => {
  const page = read('src/pages/fan/FanOffersPage.tsx')
  const service = read('src/services/fanOfferService.ts')
  assert.match(page, /subscribeEveryoneFanOffers\(setEveryoneOffers\)/)
  assert.match(page, /isFollowing: followedIds\.includes\(artistId\)/)
  assert.match(page, /isSupporting: supportedIds\.includes\(artistId\)/)
  assert.match(page, /new Map<string, FanOfferDoc>/)
  assert.match(service, /where\('audience', '==', 'everyone'\)/)
})

test('DJ requests page exposes the request flow instead of becoming a dead end', () => {
  const page = read('src/pages/dj/DJRequestsPage.tsx')
  assert.match(page, /My requests/)
  assert.match(page, /listArtistsSeekingDJExposure\(30, \{\}, true, true\)/)
  assert.match(page, /Tracks accepting requests/)
  assert.match(page, /DJ promos & deals/)
  assert.match(page, /getDealsByIds\(dealIds\)/)
  assert.match(read('src/services/dealService.ts'), /Math\.ceil\(uniqueIds\.length \/ 30\)/)
  assert.match(page, /Artist promo messages are turned off/)
  assert.match(page, /bulkOutreachOptIn: true/)
  assert.match(page, /Accept deal/)
  assert.match(page, /submitLicenceRequest/)
  assert.match(page, /Deal requested\. The artist will review it before the contract is created\./)
  assert.match(page, /Review & sign contract/)
  assert.match(page, /OfferCard/)
  assert.match(page, /Request access/)
  assert.match(page, /RequestDjAccessModal/)
  assert.doesNotMatch(page, /to=\{`\/track\/\$\{track\.trackId\}`\}/)
  assert.match(page, /to="\/dj\/discover"/)
  assert.match(page, /Requests could not be loaded/)
  assert.match(page, /getTrack\(request\.trackId\)/)
  const nav = read('src/components/layout/navConfig.ts')
  assert.match(nav, /Promos & requests/)
  assert.match(nav, /to: '\/dj\/notifications'/)
  assert.match(read('functions/src/messaging/bulkOutreach.ts'), /linkTo: `\/track\/\$\{trackId\}`/)
})

test('manual approval still lets DJs send a request without an artist deal', () => {
  const trackService = read('src/services/trackService.ts')
  const trackPage = read('src/pages/track/TrackPage.tsx')
  const requestBackend = read('functions/src/licensing/requests.ts')
  const settings = read('src/components/licence/TrackDealSettingsModal.tsx')
  assert.match(trackService, /if \(track\.djDealSettings\) return track\.djDealSettings\.acceptDjRequests/)
  assert.match(trackService, /filter\(isTrackAcceptingDjRequests\)/)
  assert.match(trackPage, /const acceptsDjRequests = isTrackAcceptingDjRequests\(track\)/)
  assert.match(trackPage, /Request DJ access/)
  assert.match(requestBackend, /dealSettings\s*\? dealSettings\.acceptDjRequests/)
  assert.match(settings, /DJs can send a request without choosing a deal/)
  assert.match(read('src/pages/artist/dashboard/DJRequestsPage.tsx'), /Approve & set contract terms/)
  assert.match(read('src/components/licence/OfferCard.tsx'), /Accept terms & create contract/)
})

test('notifications use Firestore IDs and navigate their deep links', () => {
  assert.match(read('src/services/notificationService.ts'), /notificationId: d\.id/)
  const page = read('src/pages/fan/NotificationsPage.tsx')
  const app = read('src/App.tsx')
  const topBar = read('src/components/layout/TopBar.tsx')
  const nav = read('src/components/layout/navConfig.ts')
  const push = read('src/services/pushNotificationService.ts')
  assert.match(page, /notification\.linkTo/)
  assert.match(page, /navigate\(notification\.linkTo\)/)
  assert.match(page, /PushNotificationControl/)
  assert.match(app, /path="notifications" element=\{<NotificationsPage \/>\}/)
  assert.match(topBar, /\/admin\/notifications/)
  assert.match(nav, /label: 'Notifications', to: '\/admin\/notifications'/)
  assert.match(push, /if \(!token\) throw new Error/)
})

test('DJ licensing has no chat page and ends in a signed downloadable contract', () => {
  const app = read('src/App.tsx')
  const requestBackend = read('functions/src/licensing/requests.ts')
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.doesNotMatch(app, /RequestDetailPage/)
  assert.match(app, /path="\/requests\/:requestId" element=\{<LegacyRequestRedirect \/>\}/)
  assert.doesNotMatch(requestBackend, /tx\.set\(conversationRef/)
  assert.match(requestBackend, /status: 'submitted'/)
  assert.match(requestBackend, /acceptExistingDeal/)
  assert.match(requestBackend, /selectedDealSnapshot/)
  assert.match(contract, /Sign agreement/)
  assert.match(contract, /createLicencePaymentSession/)
  assert.match(contract, /Download track/)
  assert.match(contract, /downloadLicensedTrack/)
})

test('account deletion cancels BOTH the fan and artist Stripe subscriptions (user-reported gap: an artist who deleted their account kept being billed for Artist Membership with no account left)', () => {
  const source = read('functions/src/account/deleteAccount.ts')
  assert.match(source, /subscriptions\.cancel/)
  // A deleted artist has an entirely separate recurring subscription from any fan
  // membership — both doc ids must be cancelled and cleaned up, not just one.
  assert.match(source, /db\.collection\('subscriptions'\)\.doc\(`\$\{uid\}_fan`\)/)
  assert.match(source, /db\.collection\('subscriptions'\)\.doc\(`\$\{uid\}_artist`\)/)
  assert.match(source, /fanSubscriptionRef\.delete\(\)/)
  assert.match(source, /artistSubscriptionRef\.delete\(\)/)
  for (const collection of ['subscriptions', 'supportAllocations', 'supportRelationships', 'fanOffers', 'fanOfferClaims', 'artistPosts']) {
    assert.match(source, new RegExp(collection))
  }
})

test('playback and track deletion are server-authorised', () => {
  const functions = read('functions/src/tracks.ts')
  assert.match(functions, /getTrackPlaybackUrl/)
  assert.match(functions, /deleteTrack/)
  assert.match(functions, /takenDown/)
  assert.match(functions, /restrictedCapabilities/)
  assert.match(functions, /active licence/)
  const storage = read('storage.rules')
  assert.match(storage, /match \/artists\/\{artistId\}\/previews\/\{fileName\}[\s\S]*?allow read: if isOwner\(artistId\)/)
})

test('copyright-restricted tracks are gated out of new DJ requests, contracts, payments, and downloads', () => {
  const requests = read('functions/src/licensing/requests.ts')
  const offers = read('functions/src/licensing/offers.ts')
  const payment = read('functions/src/stripe/licencePayment.ts')
  const downloads = read('functions/src/licensing/downloads.ts')
  assert.match(requests, /dj_licensing/)
  assert.match(offers, /dj_licensing/)
  assert.match(payment, /dj_licensing/)
  assert.match(downloads, /dj_licensing/)
  assert.match(requests, /not available for new DJ requests/)
  assert.match(offers, /no new contract can be generated/)
  assert.match(payment, /payment is temporarily unavailable/)
  assert.match(downloads, /downloads are temporarily unavailable/)
  // A restricted/removed track's existing signed history is never deleted by this gating.
  assert.doesNotMatch(downloads, /\.delete\(\)/)
})

test('reporting an agreement problem never rewrites the contract and reaches an audited admin action', () => {
  const contract = read('src/pages/agreements/ContractPage.tsx')
  const reports = read('functions/src/admin/reports.ts')
  const adminReportsPage = read('src/pages/admin/AdminReportsPage.tsx')
  const moderationTypes = read('src/types/moderation.ts')
  assert.match(contract, /Report a problem with this agreement/)
  assert.match(contract, /targetType: 'agreement'/)
  const reportModalBody = contract.slice(contract.indexOf('function ReportAgreementModal'))
  assert.doesNotMatch(reportModalBody, /signAgreement|voidAgreement|acceptOffer/)
  assert.match(reports, /'agreement'/)
  assert.match(moderationTypes, /'agreement'/)
  assert.match(adminReportsPage, /Place legal hold/)
  assert.match(adminReportsPage, /adminSetLegalHold/)
  assert.match(read('functions/src/admin/retentionSettings.ts'), /writeAuditLog\(adminId, 'set_legal_hold'/)
})

test('the DJ<->artist request timeline replaces chat with a real backend-event activity feed', () => {
  const app = read('src/App.tsx')
  const page = read('src/pages/agreements/RequestTimelinePage.tsx')
  assert.match(app, /path="\/dj-requests\/:requestId"/)
  assert.match(page, /subscribeOffersForRequest/)
  assert.match(page, /subscribeRequestEvents/)
  assert.match(read('functions/src/licensing/events.ts'), /Append-only, server-owned audit event/)
  assert.match(page, /NextActionBanner/)
  assert.match(page, /Your action required/)
  assert.match(page, /Waiting for the/)
  assert.doesNotMatch(page, /<textarea|sendMessage|conversationId/)
  // Every state the NextActionBanner can announce must have a corresponding action on this same
  // page — otherwise it tells a user to do something with no way to actually do it.
  assert.match(page, /mode="send"/)
  assert.match(page, /setShowSendOffer\(true\)/)
  assert.match(read('src/services/licenceService.ts'), /subscribeOffersForRequest/)
  assert.match(read('src/pages/dj/DJRequestsPage.tsx'), /\/dj-requests\/\$\{request\.requestId\}/)
  assert.match(read('src/pages/artist/dashboard/DJRequestsPage.tsx'), /\/dj-requests\/\$\{request\.requestId\}/)
})

test('a single multi-role test account can complete the artist and DJ sides independently', () => {
  const party = read('functions/src/licensing/party.ts')
  const offers = read('functions/src/licensing/offers.ts')
  const agreements = read('functions/src/licensing/agreements.ts')
  const requestPage = read('src/pages/agreements/RequestTimelinePage.tsx')
  const contractPage = read('src/pages/agreements/ContractPage.tsx')
  assert.match(party, /Choose whether you are acting as the artist or the DJ/)
  assert.match(offers, /previous\.createdByRole === actingRole/)
  assert.match(offers, /offer\.createdByRole === actingRole/)
  assert.match(agreements, /`\$\{agreementId\}_\$\{actingRole\}_\$\{uid\}`/)
  assert.match(requestPage, /Artist side/)
  assert.match(requestPage, /DJ side/)
  assert.match(contractPage, /Each side|both sides/i)
  assert.match(contractPage, /actingRole/)
})

test('offers may carry an optional acceptance deadline: cannot accept once expired, artist may reissue', () => {
  const offersFn = read('functions/src/licensing/offers.ts')
  const offerType = read('src/types/licence.ts')
  const form = read('src/components/licence/OfferFormModal.tsx')
  const card = read('src/components/licence/OfferCard.tsx')
  assert.match(offerType, /offerExpiresAt: Timestamp \| null/)
  assert.match(offersFn, /offerExpiresAt\?: string \| null/)
  // acceptOffer must reject an expired offer instead of generating a contract from stale terms.
  assert.match(offersFn, /acceptOfferExpiresAt[\s\S]*?This offer has expired and can no longer be accepted/)
  // counterOffer must reject countering an already-expired offer.
  assert.match(offersFn, /previousExpiresAt[\s\S]*?This offer has expired and can no longer be countered/)
  // sendOffer's "one offer at a time" guard must relax specifically when the existing offer expired unaccepted.
  assert.match(offersFn, /existingExpired/)
  assert.match(offersFn, /use counterOffer instead/)
  assert.match(form, /Offer expires \(optional\)/)
  assert.match(card, /Offer Expired/)
  assert.match(card, /onSendNew/)
})

test('an active contract past its own licence expiryDate transitions to expired and notifies both parties', () => {
  const cleanup = read('functions/src/retention/cleanup.ts')
  const index = read('functions/src/index.ts')
  assert.match(cleanup, /export const expireActiveContracts = onSchedule/)
  assert.match(cleanup, /status: 'expired'/)
  assert.match(cleanup, /type: 'contract_expired'/)
  assert.match(index, /expireActiveContracts/)
})

test('negotiation and contract forms stack to one column on phone widths instead of squeezing two-up', () => {
  // grid-cols-2 with no sm: prefix forces two columns even at 320-375px, which crushes an
  // Input+currency-<select> pair (e.g. price fields) into an unusable ~140px each. Every
  // form/field grid in the offer, deal-creation, and contract-review UI must be responsive.
  for (const path of [
    'src/components/licence/OfferFormModal.tsx',
    'src/pages/artist/dashboard/DjDealsPage.tsx',
    'src/pages/agreements/RequestTimelinePage.tsx',
    'src/pages/agreements/ContractPage.tsx',
  ]) {
    const src = read(path)
    assert.doesNotMatch(src, /className="grid grid-cols-2 gap-3"/, `${path}: a field-pair grid is not responsive`)
  }
})

test('the offer-history query is self-restricting so Firestore does not reject it as a list rule violation', () => {
  // Firestore evaluates a list query's security rule against the QUERY SHAPE, not just each
  // returned document — a bare where('requestId','==',id) with no uid-matching clause is
  // rejected outright (permission-denied) even when every real matching doc would individually
  // satisfy djId==uid || artistId==uid. The query itself must encode that restriction.
  const service = read('src/services/licenceService.ts')
  const page = read('src/pages/agreements/RequestTimelinePage.tsx')
  assert.match(service, /and\(where\('requestId', '==', requestId\), or\(where\('djId', '==', uid\), where\('artistId', '==', uid\)\)\)/)
  assert.match(page, /subscribeOffersForRequest\(requestId, firebaseUser\.uid, setOffers\)/)
  const indexes = JSON.parse(read('firestore.indexes.json'))
  const offerIndexes = indexes.indexes.filter((i) => i.collectionGroup === 'licenceOffers')
  assert.ok(offerIndexes.some((i) => i.fields.some((f) => f.fieldPath === 'djId')), 'missing requestId+djId+version index')
  assert.ok(offerIndexes.some((i) => i.fields.some((f) => f.fieldPath === 'artistId')), 'missing requestId+artistId+version index')
})

test('the contract page states the DJ receives only the listed rights, not ownership', () => {
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /no ownership, resale,\s*\n\s*redistribution, remix, synchronisation, publishing, or master-recording rights/)
  assert.match(contract, /REQUIRES QUALIFIED MUSIC\/IP LEGAL\s*\n\s*REVIEW BEFORE PRODUCTION/)
})

test('a drawn signature upload never calls getDownloadURL on a read-denied Storage path', () => {
  // storage.rules sets `allow read: if false` on licenceSignatures/{agreementId}/{fileName}
  // deliberately (nothing displays the image back). getDownloadURL() requires a read-permission
  // check under the hood, so calling it here is rejected with a 403 even though the upload
  // itself succeeds — every drawn-signature sign attempt failed before this fix.
  const service = read('src/services/licenceService.ts')
  assert.doesNotMatch(service, /import \{[^}]*getDownloadURL/)
  assert.match(service, /return snap\.ref\.fullPath/)
  const rules = read('storage.rules')
  assert.match(rules, /match \/licenceSignatures\/\{agreementId\}\/\{fileName\}[\s\S]*?allow read: if false/)
})

test('player clears user-bound state on logout or account switch', () => {
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /previousUserId && previousUserId !== nextUserId/)
  assert.match(player, /setCurrentTrack\(null\)/)
  assert.match(player, /setQueue\(\[\]\)/)
})

test('the contract page has a real back button and shows drawn signature images', () => {
  const contract = read('src/pages/agreements/ContractPage.tsx')
  const service = read('src/services/licenceService.ts')
  const agreementsFn = read('functions/src/licensing/agreements.ts')
  assert.match(contract, /useSmartBack\('\/agreements'\)/)
  assert.match(contract, /getSignatureImageUrls/)
  assert.match(contract, /signatureImageUrl/)
  assert.match(service, /getSignatureImageUrls/)
  assert.match(agreementsFn, /export const getSignatureImageUrls = onCall/)
  assert.match(read('functions/src/index.ts'), /getSignatureImageUrls/)
})

test('a rejected/cancelled/expired request stops showing a live actionable offer card', () => {
  const timeline = read('src/pages/agreements/RequestTimelinePage.tsx')
  const djList = read('src/pages/dj/DJRequestsPage.tsx')
  const artistList = read('src/pages/artist/dashboard/DJRequestsPage.tsx')
  assert.match(timeline, /isTerminal \? null : licenceRequest\.currentOfferId/)
  assert.match(djList, /\['rejected', 'cancelled', 'expired'\]\.includes\(request\.status\) \? null : request\.currentOfferId/)
  assert.match(artistList, /\['rejected', 'expired', 'cancelled'\]\.includes\(request\.status\) \? null : request\.currentOfferId/)
})

test('a fully completed licence request reads as Active, not the internal "approved" status name', () => {
  const djPage = read('src/pages/dj/DJRequestsPage.tsx')
  const artistPage = read('src/pages/artist/dashboard/DJRequestsPage.tsx')
  assert.match(djPage, /approved: 'Active'/)
  assert.match(artistPage, /status: \['approved'\], label: 'Active'/)
})

test('the DJ requests list can be filtered so closed requests stop cluttering it by default (user-reported)', () => {
  const page = read('src/pages/dj/DJRequestsPage.tsx')
  assert.match(page, /const CLOSED_STATUSES = \['rejected', 'cancelled', 'expired'\]/)
  assert.match(page, /useState<\(typeof REQUEST_FILTERS\)\[number\]\['key'\]>\('open'\)/)
  assert.match(page, /No \$\{requestFilter\} requests/)
})

test('a DJ can delete a closed request from their own list without erasing the artist\'s copy (user-reported)', () => {
  const backend = read('functions/src/licensing/requests.ts')
  const service = read('src/services/licenceService.ts')
  const page = read('src/pages/dj/DJRequestsPage.tsx')
  assert.match(backend, /export const dismissLicenceRequest = onCall/)
  // Must only ever touch the calling party's own visibility, never delete the shared doc itself.
  assert.match(backend, /dismissedBy: FieldValue\.arrayUnion\(uid\)/)
  assert.doesNotMatch(backend, /ref\.delete\(\)/)
  assert.match(backend, /DISMISSIBLE_STATUSES = \['rejected', 'cancelled', 'expired'\]/)
  assert.match(service, /dismissLicenceRequest = callable/)
  assert.match(page, /dismissedBy\?\.includes\(firebaseUser\?\.uid/)
  assert.match(page, /void deleteRequest\(\)/)
  assert.match(read('functions/src/index.ts'), /dismissLicenceRequest/)
})

test('the artist-side DJ requests page can also filter and delete closed requests (user-reported)', () => {
  const page = read('src/pages/artist/dashboard/DJRequestsPage.tsx')
  assert.match(page, /showClosed \? 'Hide' : 'Show'/)
  assert.match(page, /isClosedGroup && !showClosed/)
  assert.match(page, /dismissedBy\?\.includes\(firebaseUser\?\.uid/)
  assert.match(page, /void deleteRequest\(request\.requestId\)/)
  assert.match(page, /dismissLicenceRequest\(\{ requestId \}\)/)
})

test('My Agreements opens on the first tab that actually has something in it, not always Awaiting Signature (user-reported)', () => {
  const page = read('src/pages/agreements/MyAgreementsPage.tsx')
  assert.match(page, /useState<number \| null>\(null\)/)
  assert.match(page, /const defaultTab = grouped\.findIndex\(\(tab\) => tab\.items\.length > 0\)/)
  assert.match(page, /const effectiveTab = activeTab \?\? \(defaultTab === -1 \? 0 : defaultTab\)/)
  assert.doesNotMatch(page, /useState\(0\)/)
})

test('downloading the licensed track forces an actual download with zero page navigation (user-reported, confirmed live: responseDisposition alone was not honoured)', () => {
  // A Storage-signed URL's responseDisposition hint is not reliably honoured by the browser —
  // confirmed live: the browser still opened its native audio player. This project's GCP
  // identity also lacks IAM permission to configure the bucket's CORS policy, which a
  // client-side fetch()-of-the-signed-URL workaround would have needed. The reliable fix
  // streams the file through this function's own response, whose headers it sets directly, and
  // whose CORS is this function's own to control — not GCS's.
  const downloads = read('functions/src/licensing/downloads.ts')
  assert.match(downloads, /export const downloadLicensedTrack = onRequest/)
  assert.match(downloads, /res\.set\('Content-Disposition', `attachment; filename="\$\{safeTitle\}\.\$\{extension\}"`\)/)
  assert.match(downloads, /file\.createReadStream\(\)/)
  assert.match(downloads, /verifyIdToken/)
  // Forcing application/octet-stream made the browser fall back to a generic document
  // association on download instead of recognising it as audio — the real stored contentType
  // (set at upload time from the original file's own MIME type) must be used instead.
  assert.doesNotMatch(downloads, /'application\/octet-stream'/)
  assert.match(downloads, /res\.set\('Content-Type', contentType\)/)
  assert.match(downloads, /file\.getMetadata\(\)/)
  const service = read('src/services/licenceService.ts')
  assert.match(service, /export async function downloadLicensedTrack/)
  assert.match(service, /link\.download = filename/)
  assert.doesNotMatch(service, /export const getSecureDownloadUrl/)
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /await downloadLicensedTrack\(agreement!\.agreementId, actingRole\)/)
})

test('drawn signatures export on an opaque white background and degrade gracefully if the image fails to load (user-reported)', () => {
  // canvas.toBlob only captures actual drawing operations, not the surrounding CSS background —
  // a stroke drawn on an untouched canvas exports transparent, invisible once shown elsewhere
  // against anything light. Confirmed from the user's screenshot: both signature boxes were
  // blank/broken on the contract page.
  const pad = read('src/components/licence/SignaturePad.tsx')
  assert.match(pad, /ctx\.fillStyle = '#ffffff'/)
  assert.match(pad, /ctx\.fillRect\(0, 0, canvas\.width, canvas\.height\)/)
  assert.match(pad, /ctx\.strokeStyle = '#000000'/)
  assert.match(pad, /useEffect\(fillWhite, \[\]\)/)
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /onError=\{\(\) => setImageFailed\(true\)\}/)
})

test('Download PDF waits for signature images to be ready before printing (user-reported)', () => {
  // window.print() fires synchronously on click; if the signature <img> src hasn't even been
  // assigned yet (the getSignatureImageUrls fetch is still pending), the printed contract has
  // no signature there at all — a real problem for what is meant to be the legal document.
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /const awaitingSignatureImages = Boolean\(\(agreement\.artistAcceptedAt \|\| agreement\.djAcceptedAt\) && !signaturesReady\)/)
  assert.match(contract, /disabled=\{awaitingSignatureImages\}/)
  assert.match(contract, /\.finally\(\(\) => setSignaturesReady\(true\)\)/)
})

test('the DJ access request modal closes on success even when opened from /dj/requests itself (user-reported)', () => {
  // navigate('/dj/requests') is a no-op when already on that route (the modal is opened from
  // its own "DJ promos & deals" section) — with no onClose() call, the form just stayed open
  // with no visible confirmation the request went through.
  const modal = read('src/components/track/RequestDjAccessModal.tsx')
  const submitBody = modal.slice(modal.indexOf('async function handleSubmit'), modal.indexOf('async function handleSubmit') + 900)
  assert.match(submitBody, /onClose\(\)/)
  assert.match(submitBody, /navigate\('\/dj\/requests'\)/)
})

test('a signed party shows exactly one signature — the drawn image when it loads, the cursive fallback otherwise, never both (user-reported)', () => {
  // A typed signature never has a drawn image at all, and a drawn one can genuinely fail to
  // load — either way, something must still read as a signature. But showing the cursive
  // fallback text *and* a successfully-loaded drawn image at once looks like two different
  // signatures for the same party, which is exactly what was reported.
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /fontFamily: "'Caveat', cursive"/)
  assert.match(contract, /\{signedAt && !showImage \? \(/)
  const html = read('index.html')
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Caveat/)
})

test('the CSP allows the fonts and signed-URL image domains this app actually loads from (user-reported, console errors)', () => {
  // storage.googleapis.com is what @google-cloud/storage's getSignedUrl() actually returns
  // (not firebasestorage.googleapis.com) — every signature image was silently CSP-blocked
  // regardless of any application code fix. Same for the Caveat font stylesheet/font files.
  const headers = read('public/_headers')
  assert.match(headers, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/)
  assert.match(headers, /font-src 'self' data: https:\/\/fonts\.gstatic\.com/)
  assert.match(headers, /img-src 'self' data: blob: https:\/\/firebasestorage\.googleapis\.com https:\/\/storage\.googleapis\.com https:\/\/lh3\.googleusercontent\.com/)
})

test('admin verification review shows the actual profile and the requester\'s case, not just a raw uid (user-reported)', () => {
  // The admin page previously rendered only req.userId and req.profileType — a raw uid and a
  // role string, nothing that helps decide whether an account is genuinely worth verifying.
  const backend = read('functions/src/admin/verification.ts')
  assert.match(backend, /note\.length < 10/)
  assert.match(backend, /note,\n/)
  const page = read('src/pages/admin/AdminVerificationPage.tsx')
  assert.match(page, /getArtistProfile/)
  assert.match(page, /getDJProfile/)
  assert.match(page, /View public profile/)
  assert.match(page, /Requester's case/)
  assert.match(page, /\{req\.note/)
  const djPage = read('src/pages/dj/DJProfilePage.tsx')
  const artistPage = read('src/pages/artist/dashboard/ArtistSettingsPage.tsx')
  for (const page2 of [djPage, artistPage]) {
    assert.match(page2, /verificationNote\.trim\(\)\.length < 10/)
    assert.match(page2, /note: verificationNote\.trim\(\)/)
  }
})

test('the Revenue page download history can be filtered by track and shows real titles, not raw ids (user-reported)', () => {
  const page = read('src/pages/artist/dashboard/RevenuePage.tsx')
  assert.match(page, /downloadTrackFilter/)
  assert.match(page, /<option value="all">All tracks<\/option>/)
  assert.match(page, /downloads\.filter\(\(d\) => d\.trackId === downloadTrackFilter\)/)
  assert.match(page, /trackTitles\[d\.trackId\] \?\? 'Track'/)
})

test('the Google sign-in/sign-up button is removed from both auth pages', () => {
  const signIn = read('src/pages/auth/SignInPage.tsx')
  const signUp = read('src/pages/auth/SignUpPage.tsx')
  for (const page of [signIn, signUp]) {
    assert.doesNotMatch(page, /Continue with Google/)
    assert.doesNotMatch(page, /signInWithGoogle/)
  }
  // Google auth itself stays — DeleteAccountModal still uses reauthenticateWithGoogle for
  // Google-only accounts to reauthenticate, a different use case from the login/signup entry
  // points that were asked to be removed.
  assert.match(read('src/services/authService.ts'), /export async function signInWithGoogle/)
  assert.match(read('src/components/account/DeleteAccountModal.tsx'), /reauthenticateWithGoogle/)
})

test('an admin can fully delete another account, reusing the same audited deletion logic and gated by a typed confirmation', () => {
  const backend = read('functions/src/account/deleteAccount.ts')
  assert.match(backend, /export const adminDeleteAccount = onCall/)
  assert.match(backend, /requireAdmin\(request\)/)
  // Must reuse the same core logic as the self-service flow, not a second/divergent implementation.
  assert.match(backend, /async function performAccountDeletion\(uid: string\)/)
  const performBody = backend.slice(backend.indexOf('async function performAccountDeletion'), backend.indexOf('export const deleteAccount'))
  assert.match(performBody, /getAuth\(\)\.deleteUser\(uid\)/)
  assert.match(backend, /await performAccountDeletion\(uid\)/)
  assert.match(backend, /await performAccountDeletion\(userId\)/)
  assert.match(backend, /writeAuditLog\(adminId, 'admin_delete_account'/)
  assert.match(read('functions/src/index.ts'), /adminDeleteAccount/)
  const page = read('src/pages/admin/AdminUsersPage.tsx')
  assert.match(page, /disabled=\{confirmText !== 'DELETE'\}/)
  assert.match(page, /adminDeleteAccount\(\{ userId: user\.uid \}\)/)
})

test('stories always expire after exactly 24 hours, not an artist-configurable duration (user-reported: "like Instagram")', () => {
  const backend = read('functions/src/stories/stories.ts')
  const client = read('src/pages/artist/dashboard/StoriesPage.tsx')
  const config = read('src/constants/mediaConfig.ts')
  assert.match(backend, /const STORY_DURATION_HOURS = 24/)
  assert.match(backend, /new Date\(Date\.now\(\) \+ STORY_DURATION_HOURS \* 60 \* 60 \* 1000\)/)
  assert.doesNotMatch(backend, /expiresInHours/)
  assert.doesNotMatch(client, /expiresInHours/)
  assert.match(config, /STORY_DURATION_HOURS = 24/)
  // Highlights stay the one documented way to keep a story past 24h — not touched by this change.
  assert.match(read('src/services/storyService.ts'), /isHighlight/)
})

test('story playback prefetches the next story\'s media URL instead of fetching cold on every advance (user-reported delay)', () => {
  const viewer = read('src/components/stories/StoryViewer.tsx')
  assert.match(viewer, /const \[mediaUrls, setMediaUrls\] = useState<Record<string, string>>\(\{\}\)/)
  assert.match(viewer, /function resolveMediaUrl\(target: StoryDoc \| undefined\)/)
  assert.match(viewer, /const nextInGroup = group\?\.stories\[storyIndex \+ 1\]/)
  assert.match(viewer, /resolveMediaUrl\(nextStory\)/)
})

test('the persistent player can be fully dismissed', () => {
  const player = read('src/contexts/PlayerContext.tsx')
  const bar = read('src/components/player/PlayerBar.tsx')
  assert.match(player, /closePlayer: \(\) => void/)
  assert.match(player, /audio\.removeAttribute\('src'\)/)
  assert.match(player, /setCurrentTrack\(null\)/)
  assert.match(bar, /aria-label="Close player"/)
  assert.match(bar, /onClick=\{closePlayer\}/)
})

test('Follow/Support CTAs preserve intent through the full auth funnel (returnTo)', () => {
  const returnTo = read('src/utils/returnTo.ts')
  assert.match(returnTo, /export function isSafeReturnPath/)
  assert.match(returnTo, /path\.startsWith\('\/\/'\) \|\| path\.startsWith\('\/\\\\'\)/)

  const follow = read('src/components/music/FollowButton.tsx')
  assert.match(follow, /const PENDING_FOLLOW_KEY = 'pendingFollowArtistId'/)
  assert.match(follow, /sessionStorage\.setItem\(PENDING_FOLLOW_KEY, artistId\)/)
  assert.match(follow, /navigate\(`\/sign-in\?returnTo=\$\{encodeURIComponent\(returnTo\)\}`, \{ state: \{ from: location \} \}\)/)

  assert.match(read('src/pages/auth/SignInPage.tsx'), /isSafeReturnPath\(returnToParam\)/)
  assert.match(read('src/pages/auth/SignUpPage.tsx'), /isSafeReturnPath/)
  assert.match(read('src/pages/auth/VerifyEmailPage.tsx'), /isSafeReturnPath/)
  const onboarding = read('src/pages/onboarding/OnboardingPage.tsx')
  assert.match(onboarding, /if \(isSafeReturnPath\(returnToParam\)\)/)
  assert.match(onboarding, /navigate\(returnToParam\)/)

  const support = read('src/components/music/SupportButton.tsx')
  assert.match(support, /const subscriptionPath = artistId \? `\/app\/subscription\?artist=\$\{encodeURIComponent\(artistId\)\}` : '\/app\/subscription'/)
  // Regression guard: an earlier draft navigated to /sign-in with router state
  // pointing back at /sign-in itself, which would have been a redirect loop.
  assert.doesNotMatch(support, /pathname: '\/sign-in'/)
})

test('new artist profiles cannot claim reserved/impersonation-prone URLs like /artist/admin or /artist/support', () => {
  const slugUtil = read('src/utils/slug.ts')
  assert.match(slugUtil, /export const RESERVED_ARTIST_SLUGS = new Set\(\[/)
  assert.match(slugUtil, /'admin',/)
  assert.match(slugUtil, /'support',/)
  assert.match(slugUtil, /'spotify',/)

  // Slug generation now happens server-side (createArtistProfile Cloud
  // Function, inside its create-profile transaction) rather than in a
  // client transaction — firestore.rules' artistProfiles/artistSlugs
  // create rules are both `if false`, so this is the only place it can
  // happen. functions/src/slug.ts mirrors the client's reserved-word list by hand.
  const slugFn = read('functions/src/slug.ts')
  assert.match(slugFn, /export const RESERVED_ARTIST_SLUGS = new Set\(\[/)
  assert.match(slugFn, /'admin', 'administrator',/)

  const profiles = read('functions/src/profiles.ts')
  assert.match(profiles, /if \(!RESERVED_ARTIST_SLUGS\.has\(candidate\)\) \{/)
  // A reserved word falls through to the same numbered-suffix path as a
  // taken slug — never a hard rejection of the whole signup.
  assert.match(profiles, /candidate = `\$\{baseSlug\}-\$\{attempt \+ 1\}`/)
})

test('tracks get a clean per-artist-unique share slug; old trackId-based links keep resolving forever', () => {
  assert.match(read('src/types/track.ts'), /trackSlug\?: string/)

  const trackService = read('src/services/trackService.ts')
  assert.match(trackService, /function trackSlugRef\(artistId: string, slug: string\)/)
  assert.match(trackService, /export async function getTrackIdForSlug/)

  const rules = read('firestore.rules')
  assert.match(rules, /match \/trackSlugs\/\{registryId\}/)
  assert.match(rules, /request\.resource\.data\.get\('trackSlug', null\) == resource\.data\.get\('trackSlug', null\)/)

  const trackPage = read('src/pages/track/TrackPage.tsx')
  assert.match(trackPage, /const viaSlug = await getTrackIdForSlug\(artistId, rawParam\)/)
  assert.match(trackPage, /setResolvedTrackId\(viaSlug \?\? rawParam\)/)

  assert.match(read('worker/share-og.ts'), /trackSlugs\/\$\{artistId\}_\$\{trackParam\}/)
})

test('profile/track views are real server-recorded counters (not client-writable) with a capped, sanitized referral breakdown', () => {
  const analytics = read('functions/src/analytics.ts')
  assert.match(analytics, /export const recordProfileView = onCall/)
  assert.match(analytics, /export const recordTrackView = onCall/)
  assert.match(analytics, /enforceRateLimit\(`recordProfileView_\$\{artistId\}`, 120, 60\)/)
  assert.match(analytics, /enforceRateLimit\(`recordTrackView_\$\{trackId\}`, 120, 60\)/)
  assert.match(analytics, /const MAX_REFERRAL_SOURCES = 20/)
  assert.match(analytics, /const REF_PATTERN = \/\^\[a-z0-9_-\]\{1,32\}\$\//)
  assert.match(analytics, /: 'other'/)

  const rules = read('firestore.rules')
  assert.match(rules, /request\.resource\.data\.get\('profileViews', 0\) == resource\.data\.get\('profileViews', 0\)/)
  assert.match(rules, /request\.resource\.data\.get\('referralViews', \{\}\) == resource\.data\.get\('referralViews', \{\}\)/)
  assert.match(rules, /request\.resource\.data\.get\('viewCount', 0\) == resource\.data\.get\('viewCount', 0\)/)

  assert.match(read('functions/src/index.ts'), /export \{ recordProfileView, recordTrackView \} from '\.\/analytics\.js'/)
})

test('the artist Share & Growth dashboard shows real numbers pulled from live data, not placeholders', () => {
  const growth = read('src/pages/artist/dashboard/GrowthPage.tsx')
  assert.match(growth, /formatCount\(artist\.profileViews \?\? 0\)/)
  assert.match(growth, /formatCount\(artist\.followerCount\)/)
  assert.match(growth, /formatCount\(djRequests\.length\)/)
  assert.match(growth, /const referralEntries = Object\.entries\(artist\.referralViews \?\? \{\}\)/)
  assert.match(growth, /subscribeRequestsForArtist\(firebaseUser\.uid, setDjRequests\)/)

  assert.match(read('src/App.tsx'), /<Route path="growth" element=\{<GrowthPage \/>\} \/>/)
  assert.match(read('src/components/layout/navConfig.ts'), /label: 'Share & Growth', to: '\/dashboard\/artist\/growth'/)
})

test('a taken-down or streaming-restricted track shows a clear unavailable state instead of a silently broken player', () => {
  const trackPage = read('src/pages/track/TrackPage.tsx')
  assert.match(trackPage, /if \(track\.takenDown\) \{/)
  assert.match(trackPage, /This track is no longer available/)
  assert.match(trackPage, /const streamingRestricted = track\.restrictedCapabilities\?\.includes\('streaming'\) \?\? false/)
  assert.match(trackPage, /disabled=\{streamingRestricted \|\| previewUnavailable\}/)
  assert.match(trackPage, /Streaming is temporarily restricted while this track is under review\./)

  // The "Open for DJ promotion" badge and DJ request flow must agree with
  // the takedown/restriction state — not show a CTA the server would reject.
  assert.match(read('src/services/trackService.ts'), /if \(track\.takenDown \|\| track\.restrictedCapabilities\?\.includes\('dj_licensing'\)\) return false/)
})

test('a fan can report an artist profile, and an admin reviewing reports sees an actual clickable subject, not just a raw id', () => {
  const modal = read('src/components/track/ReportArtistModal.tsx')
  assert.match(modal, /submitReport\(\{ targetType: 'artist', targetId: artistId, reason, description \}\)/)

  const profilePage = read('src/pages/artist/ArtistPublicProfilePage.tsx')
  assert.match(profilePage, /onClick=\{\(\) => setShowReport\(true\)\}/)
  assert.match(profilePage, /<ReportArtistModal artistId=\{artist\.artistId\} onClose=\{\(\) => setShowReport\(false\)\} \/>/)

  const adminReports = read('src/pages/admin/AdminReportsPage.tsx')
  assert.match(adminReports, /void getArtistProfile\(report\.targetId\)\.then/)
  assert.match(adminReports, /void getTrack\(report\.targetId\)\.then/)
  assert.match(adminReports, /Subject not found — may already have been removed\./)
})

test("an admin can change an artist's slug, and every URL that artist has ever used redirects to the new one in a single hop", () => {
  const fn = read('functions/src/admin/artistSlug.ts')
  assert.match(fn, /export const adminChangeArtistSlug = onCall/)
  assert.match(fn, /const adminId = await requireAdmin\(request\)/)
  assert.match(fn, /RESERVED_ARTIST_SLUGS\.has\(newSlug\)/)
  assert.match(fn, /redirectTo: newSlug/)
  assert.match(fn, /db\.collection\('artistSlugs'\)\.where\('artistId', '==', artistId\)\.get\(\)/)
  assert.match(fn, /writeAuditLog\(adminId, 'change_artist_slug', \{ artistId, oldSlug, newSlug \}\)/)

  assert.match(read('src/services/artistService.ts'), /if \(typeof data\.redirectTo === 'string'\) \{/)
  assert.match(read('worker/share-og.ts'), /async function resolveArtistId/)

  const usersPage = read('src/pages/admin/AdminUsersPage.tsx')
  assert.match(usersPage, /adminChangeArtistSlug\(\{ artistId: user\.uid, newSlug: slugify\(newSlug\) \}\)/)

  assert.match(read('functions/src/index.ts'), /export \{ adminChangeArtistSlug \} from '\.\/admin\/artistSlug\.js'/)
})

test('shared artist/track crawler pages carry Schema.org structured data, not just Open Graph tags', () => {
  const worker = read('worker/share-og.ts')
  assert.match(worker, /'@type': 'MusicGroup'/)
  assert.match(worker, /'@type': 'MusicRecording'/)
  assert.match(worker, /byArtist: \{ '@type': 'MusicGroup', name: artistName \}/)
  assert.match(worker, /\$\{jsonLd \? `<script type="application\/ld\+json">/)
})

test('end-to-end scenario: a fan follows a shared track link, plays the sample, and Follow survives a full sign-up detour back to the same track', () => {
  const trackPage = read('src/pages/track/TrackPage.tsx')
  // Arrives via a tagged share link and the view is genuinely counted.
  assert.match(trackPage, /void recordTrackView\(resolvedTrackId, searchParams\.get\('ref'\)\)/)
  // Can hear the sample without being signed in — no auth gate on preview playback.
  assert.match(trackPage, /playTrack\(track\)/)
  assert.match(trackPage, /<FollowButton artistId=\{artist\.artistId\} \/>/)

  const follow = read('src/components/music/FollowButton.tsx')
  assert.match(follow, /const returnTo = `\$\{location\.pathname\}\$\{location\.search\}`/)

  // The detour: sign-up needs email verification before onboarding, and
  // onboarding is the step that finally honours returnTo and lands the fan
  // back where they started — with the Follow completed automatically.
  assert.match(read('src/pages/auth/VerifyEmailPage.tsx'), /isSafeReturnPath/)
  const onboarding = read('src/pages/onboarding/OnboardingPage.tsx')
  assert.match(onboarding, /const returnToParam = searchParams\.get\('returnTo'\)/)
  assert.match(follow, /sessionStorage\.getItem\(PENDING_FOLLOW_KEY\) !== artistId/)
})

test('end-to-end scenario: a DJ finds a track through a shared link and can request a licence straight from that page', () => {
  const trackPage = read('src/pages/track/TrackPage.tsx')
  assert.match(trackPage, /const acceptsDjRequests = isTrackAcceptingDjRequests\(track\)/)
  assert.match(trackPage, /<RequestDjAccessModal/)
  // A DJ without a DJ profile yet is offered the path to add one, not a dead end.
  assert.match(trackPage, /\/onboarding\/add-role\?role=dj/)

  // The request -> offer -> signed contract -> unlocked download pipeline
  // this lands the DJ in is the same one this session already hardened
  // (separately tested) — this scenario only needs the entry point to be real.
  assert.match(read('src/services/trackService.ts'), /export function isTrackAcceptingDjRequests/)
})

test('the dashboard workspace switcher only lists roles the account actually has (user-reported: an artist-only account should not also be "the fan")', () => {
  const switcher = read('src/components/layout/DashboardSwitcher.tsx')
  assert.match(switcher, /const workspaces: Workspace\[\] = \[\]/)
  assert.match(switcher, /if \(hasRole\('fan'\)\) \{/)
  assert.match(switcher, /workspaces\.push\(\{ label: 'Fan'/)
  // Fan must be gated the same way as artist/dj/admin, not unconditionally present.
  assert.doesNotMatch(switcher, /const workspaces: Workspace\[\] = \[\s*\{ label: 'Fan'/)
})

test('password reset, email verification, and email-change-revert links resolve on our own domain instead of the default firebaseapp.com action page', () => {
  const action = read('src/pages/auth/AuthActionPage.tsx')
  assert.match(action, /export function AuthActionPage/)
  assert.match(action, /const mode = searchParams\.get\('mode'\)/)
  assert.match(action, /const oobCode = searchParams\.get\('oobCode'\)/)
  assert.match(action, /if \(mode === 'resetPassword'\) return <ResetPasswordAction/)
  assert.match(action, /if \(mode === 'verifyEmail'\) return <VerifyEmailAction/)
  assert.match(action, /if \(mode === 'recoverEmail'\) return <RecoverEmailAction/)
  assert.match(action, /verifyPasswordResetCode\(auth, oobCode\)/)
  assert.match(action, /await confirmPasswordReset\(auth, oobCode, password\)/)
  assert.match(action, /applyActionCode\(auth, oobCode\)/)

  assert.match(read('src/App.tsx'), /<Route path="\/auth\/action" element=\{<AuthActionPage \/>\} \/>/)
})

test('the workspace switcher stays visible whenever there is somewhere else to go, even with only one other workspace (user-reported: stuck on the fan side with no way back to Artist)', () => {
  const switcher = read('src/components/layout/DashboardSwitcher.tsx')
  assert.match(switcher, /if \(!workspaces\.some\(\(w\) => !w\.isActive\(location\.pathname\)\)\) return null/)
  // The old length-based guard hid the switcher entirely for a single-role
  // account sitting outside its one workspace — must not regress to that.
  assert.doesNotMatch(switcher, /workspaces\.length < 2/)
})

test('signed-in users can send a support message, an admin gets notified and can reply, and the user gets notified with that reply (user-reported: submitting a support message never notified anyone in either direction)', () => {
  const fn = read('functions/src/support.ts')
  assert.match(fn, /export const submitSupportMessage = onCall/)
  assert.match(fn, /export const resolveSupportMessage = onCall/)
  assert.match(fn, /await requireActiveUser\(request\.auth\.uid\)/)
  assert.match(fn, /enforceRateLimit\(`submitSupportMessage_\$\{request\.auth\.uid\}`, 5, 3600\)/)
  assert.match(fn, /const adminId = await requireAdmin\(request\)/)
  assert.match(fn, /writeAuditLog\(adminId, 'resolve_support_message'/)
  // Submitting notifies every admin — not just leaving it for one to stumble onto in the Reports page.
  assert.match(fn, /db\.collection\('users'\)\.where\('roles', 'array-contains', 'admin'\)\.get\(\)/)
  assert.match(fn, /type: 'support_message'/)
  assert.match(fn, /linkTo: '\/admin\/reports'/)
  // Resolving requires an actual reply (not a content-free status flip) and notifies the original user with it.
  assert.match(fn, /if \(reply\.length < MIN_REPLY_LENGTH \|\| reply\.length > MAX_REPLY_LENGTH\)/)
  assert.match(fn, /type: 'support_reply'/)
  assert.match(fn, /body: reply\.slice\(0, 140\)/)
  assert.match(fn, /linkTo: '\/support'/)
  assert.match(fn, /userId: supportMessage\.userId/)

  const rules = read('firestore.rules')
  assert.match(rules, /match \/supportMessages\/\{docId\} \{/)
  assert.match(rules, /resource\.data\.userId == request\.auth\.uid \|\| isAdmin\(\)/)
  // Notifications remain Cloud-Function-only create — nothing new needed for a client to fake either of these.
  assert.match(rules, /match \/notifications\/\{notificationId\} \{\s*allow read: if isSignedIn\(\) && resource\.data\.userId == request\.auth\.uid;/)

  const page = read('src/pages/support/SupportPage.tsx')
  assert.match(page, /submitSupportMessage\(\{ subject: subject\.trim\(\), message: message\.trim\(\) \}\)/)
  // The fan can see their own still-open messages — not just a one-shot form into a void. A
  // resolved message drops out of this list entirely (user-reported: it used to stick around
  // after being resolved) since the reply already arrived via notification, not this page.
  assert.match(page, /subscribeMySupportMessages\(firebaseUser\.uid, setOpenMessages\)/)
  assert.doesNotMatch(page, /msg\.reply/)
  assert.doesNotMatch(page, /'resolved'/)

  const helpService = read('src/services/helpService.ts')
  assert.match(helpService, /export function subscribeMySupportMessages\(/)
  assert.match(helpService, /where\('userId', '==', uid\)/)
  assert.match(helpService, /where\('status', '==', 'open'\)/)

  const admin = read('src/pages/admin/AdminReportsPage.tsx')
  assert.match(admin, /listOpenSupportMessages\(\)\.then\(setSupportMessages\)/)
  assert.match(admin, /resolveSupportMessage\(\{ supportMessageId: id, reply \}\)/)
  // The admin has to actually type something before the button is even clickable.
  assert.match(admin, /disabled=\{\(replyDrafts\[msg\.supportMessageId\] \?\? ''\)\.trim\(\)\.length < 3\}/)

  const indexes = read('firestore.indexes.json')
  assert.match(
    indexes,
    /"collectionGroup": "supportMessages"[\s\S]*?"fieldPath": "userId", "order": "ASCENDING" \}[\s\S]*?"fieldPath": "status", "order": "ASCENDING" \}[\s\S]*?"fieldPath": "createdAt", "order": "DESCENDING"/,
  )

  assert.match(read('src/App.tsx'), /<Route\s+path="\/support"/)
  assert.match(read('src/components/layout/navConfig.ts'), /label: 'Support', to: '\/support'/)
  assert.match(read('functions/src/index.ts'), /export \{ submitSupportMessage, resolveSupportMessage \} from '\.\/support\.js'/)
})

test('music access ladder: everyone can hear the preview regardless of a track\'s full-stream tier, but the full stream stays strictly gated (user-reported: the player never actually streamed the full track to entitled listeners)', () => {
  const fn = read('functions/src/tracks.ts')

  // Preview access is permissive — a followers/supporters-tier track's
  // preview must not be gated the same way its full stream is, or the
  // preview -> follow -> unlock funnel never gets off the ground.
  assert.match(fn, /async function canPreviewTrack\(uid: string \| null, track: FirebaseFirestore\.DocumentData\): Promise<boolean> \{/)
  assert.match(fn, /return true\n\}/)

  // Full-stream access keeps the strict ladder, plus a real fix: a
  // supportRelationships doc alone isn't proof of a *currently active*
  // subscription (it isn't cleaned up the instant Stripe cancels one).
  assert.match(fn, /async function canStreamFullTrack\(uid: string \| null, track: FirebaseFirestore\.DocumentData\): Promise<boolean> \{/)
  assert.match(fn, /db\.collection\('subscriptions'\)\.doc\(`\$\{uid\}_fan`\)\.get\(\)/)
  assert.match(fn, /return status === 'active' \|\| status === 'trialing'/)

  // getTrackPlaybackUrl must route to the matching check per kind — using
  // the same strict check for both would silently re-break the split above.
  assert.match(fn, /kind === 'dj_preview'[\s\S]*?await canPlayDjPreview\(uid, track\)[\s\S]*?await canStreamFullTrack\(uid, track\)/)

  // Analytics stay honest: preview and full-stream plays are separate
  // counters, further broken down by DJ-preview and supporter-tier plays —
  // never summed into one inflated "plays" figure.
  assert.match(fn, /export const recordTrackPlay = onCall/)
  assert.match(fn, /update\.playCount = FieldValue\.increment\(1\)/)
  assert.match(fn, /update\.fullPlayCount = FieldValue\.increment\(1\)/)
  assert.match(fn, /update\.djPreviewCount = FieldValue\.increment\(1\)/)
  assert.match(fn, /update\.supporterPlayCount = FieldValue\.increment\(1\)/)

  // The player must actually request the full stream first and only fall
  // back to the preview when the server itself says no — never decide
  // client-side who is "probably" entitled.
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /url = await getStreamPlaybackURL\(track\)/)
  assert.match(player, /streamError instanceof FirebaseError && streamError\.code === 'functions\/permission-denied'/)
  assert.match(player, /url = await getPreviewPlaybackURL\(track\)/)
  assert.match(player, /void recordTrackPlay\(track\.trackId, kind\)/)

  // Firestore rules: track metadata (never audio) is visible for a locked
  // followers/supporters/early_access track too, so the public profile can
  // show it locked-with-a-CTA instead of hiding it outright — the real
  // gate stays entirely in getTrackPlaybackUrl + storage.rules.
  const rules = read('firestore.rules')
  assert.match(rules, /resource\.data\.visibility == 'followers'\n {8}\|\| resource\.data\.visibility == 'supporters'/)
  assert.match(rules, /request\.resource\.data\.get\('fullPlayCount', 0\) == resource\.data\.get\('fullPlayCount', 0\)/)
  assert.match(rules, /request\.resource\.data\.get\('supporterPlayCount', 0\) == resource\.data\.get\('supporterPlayCount', 0\)/)
  assert.match(rules, /request\.resource\.data\.get\('djPreviewCount', 0\) == resource\.data\.get\('djPreviewCount', 0\)/)

  // Storage stays the real backstop regardless of the Firestore doc-read
  // relaxation above — previews/streaming/originals are all owner-only,
  // full stop, no visibility-based branch to accidentally get wrong.
  const storage = read('storage.rules')
  assert.match(storage, /match \/artists\/\{artistId\}\/previews\/\{fileName\} \{\s*\/\/[\s\S]*?allow read: if isOwner\(artistId\);/)
  assert.match(storage, /match \/artists\/\{artistId\}\/streaming\/\{fileName\} \{[\s\S]*?allow read: if isOwner\(artistId\);/)
  assert.match(storage, /match \/artists\/\{artistId\}\/originals\/\{fileName\} \{[\s\S]*?allow read: if isOwner\(artistId\);/)
})

test('the public artist profile shows locked followers/supporters/early-access tracks with a lock + CTA instead of hiding them, and the track page shows accurate play-button/access copy per viewer', () => {
  const artistService = read('src/services/artistService.ts')
  assert.match(artistService, /where\('visibility', 'in', \['public', 'followers', 'supporters', 'early_access'\]\)/)

  const access = read('src/utils/trackAccess.ts')
  assert.match(access, /export const TRACK_ACCESS_LABEL: Record<TrackVisibility, string> = \{/)
  assert.match(access, /export function describeTrackAccess/)
  assert.match(access, /viewer\.isFollowing/)
  assert.match(access, /viewer\.isSupporting/)

  const card = read('src/components/music/TrackCard.tsx')
  assert.match(card, /locked\?: boolean/)
  assert.match(card, /TRACK_ACCESS_LABEL\[track\.visibility\]/)
  assert.match(card, /<Lock className="h-3 w-3" \/>/)

  const trackPage = read('src/pages/track/TrackPage.tsx')
  assert.match(trackPage, /const access = describeTrackAccess\(track, \{/)
  assert.match(trackPage, /access\.lockedMessage \? <p/)
  assert.match(trackPage, /subscribeIsFollowing\(firebaseUser\.uid, track\.artistId, setIsFollowing\)/)
  assert.match(trackPage, /subscribeIsSupporting\(firebaseUser\.uid, track\.artistId, setIsSupporting\)/)

  const profile = read('src/pages/artist/ArtistPublicProfilePage.tsx')
  assert.match(profile, /const hasLockedTracks = publicTracks\.some/)
  assert.match(profile, /locked=\{/)
})

test('early access tracks: supporters get the full track immediately, followers/public unlock automatically on a server-timestamp date, not the caller\'s clock (spec scenario: third test track)', () => {
  const fn = read('functions/src/tracks.ts')
  // Public release date is checked before the signed-in guard, so it also
  // applies to an anonymous visitor once it passes — not just accounts.
  assert.match(fn, /if \(track\.visibility === 'early_access'\) \{\s*\/\/ The public-release date/)
  assert.match(fn, /const publicAt = \(track\.publicReleaseAt as FirebaseFirestore\.Timestamp \| null \| undefined\)\?\.toMillis\(\)/)
  assert.match(fn, /if \(publicAt !== undefined && Date\.now\(\) >= publicAt\) return true/)
  // Supporters unlock unconditionally; followers need both the relationship and the date.
  assert.match(fn, /if \(await isActiveSupporter\(uid, track\.artistId\)\) return true/)
  assert.match(fn, /const followerAt = \(track\.followerReleaseAt as FirebaseFirestore\.Timestamp \| null \| undefined\)\?\.toMillis\(\)/)
  assert.match(fn, /if \(followerAt !== undefined && Date\.now\(\) >= followerAt\) \{/)

  assert.match(read('src/types/track.ts'), /followerReleaseAt\?: Timestamp \| null/)
  assert.match(read('src/types/track.ts'), /publicReleaseAt\?: Timestamp \| null/)

  const upload = read('src/pages/artist/dashboard/UploadTrackPage.tsx')
  assert.match(upload, /visibility === 'early_access' \? \(/)
  assert.match(upload, /Field label="Followers get full access on"/)
  assert.match(upload, /followerReleaseAt: visibility === 'early_access' && followerReleaseDate \? new Date\(followerReleaseDate\) : null/)
  // The artist sees exactly what each audience gets before publishing — never a fabricated/generic summary.
  assert.match(upload, /import \{ ACCESS_SUMMARY, VISIBILITY_OPTIONS \} from '@\/utils\/trackAccess'/)
  assert.match(read('src/utils/trackAccess.ts'), /export const ACCESS_SUMMARY: Record<TrackVisibility/)

  const access = read('src/utils/trackAccess.ts')
  assert.match(access, /if \(track\.visibility === 'early_access'\) \{/)
  assert.match(access, /if \(viewer\.isSupporting\) return \{ fullAccess: true/)
})

test('artists can edit a track\'s fan-facing access settings after upload, kept entirely separate from DJ licensing so changing it can never silently affect a signed licence', () => {
  const modal = read('src/components/track/TrackAccessSettingsModal.tsx')
  assert.match(modal, /export function TrackAccessSettingsModal/)
  assert.match(modal, /await updateTrackAccessSettings\(track\.trackId, \{/)
  assert.match(modal, /deliberately separate from TrackDjAccessModal/)

  const service = read('src/services/trackService.ts')
  assert.match(service, /export async function updateTrackAccessSettings/)
  assert.match(service, /await updateDoc\(trackRef\(trackId\), \{\s*visibility: input\.visibility,/)

  // DJ downloads never read track.visibility — the actual proof this separation is real, not just naming.
  assert.doesNotMatch(read('functions/src/licensing/downloads.ts'), /visibility/)

  const musicPage = read('src/pages/artist/dashboard/MusicPage.tsx')
  assert.match(musicPage, /setAccessSettingsTrack\(track\)/)
  assert.match(musicPage, /<TrackAccessSettingsModal track=\{accessSettingsTrack\}/)
})

test('the default preview length and default track visibility for new uploads are admin-configurable, not hard-coded (spec: "make this configurable")', () => {
  const settingsFn = read('functions/src/admin/settings.ts')
  assert.match(settingsFn, /defaultTrackVisibility,\s*\n\s*defaultPreviewDurationSec,/)
  assert.match(settingsFn, /update\.defaultTrackVisibility = defaultTrackVisibility/)
  assert.match(settingsFn, /update\.defaultPreviewDurationSec = defaultPreviewDurationSec/)

  const adminPage = read('src/pages/admin/AdminSettingsPage.tsx')
  assert.match(adminPage, /handleSaveTrackDefaults/)
  assert.match(adminPage, /Default visibility for new uploads/)
  assert.match(adminPage, /Default preview duration \(seconds\)/)

  const upload = read('src/pages/artist/dashboard/UploadTrackPage.tsx')
  assert.match(upload, /if \(settings\.defaultTrackVisibility\) setVisibility\(settings\.defaultTrackVisibility\)/)
  assert.match(upload, /if \(settings\.defaultPreviewDurationSec\) setPreviewDurationSec\(settings\.defaultPreviewDurationSec\)/)
  assert.match(upload, /if \(settings\.allowedPreviewDurationsSec\?\.length\) setSuggestedPreviewDurations\(settings\.allowedPreviewDurationsSec\)/)
})

test('follow/support conversions are counted from a real per-fan preview signal, not fabricated or assumed from every follow/support', () => {
  const tracksFn = read('functions/src/tracks.ts')
  assert.match(tracksFn, /if \(\(kind === 'preview' \|\| kind === 'dj_preview'\) && uid && uid !== track\.artistId\) \{/)
  assert.match(tracksFn, /db\.collection\('previewSessions'\)\.doc\(`\$\{uid\}_\$\{track\.artistId\}`\)\.set\(/)

  const followsFn = read('functions/src/follows.ts')
  assert.match(followsFn, /const RECENT_PREVIEW_WINDOW_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(followsFn, /if \(lastPreviewAt && Date\.now\(\) - lastPreviewAt\.toMillis\(\) <= RECENT_PREVIEW_WINDOW_MS\) \{/)
  assert.match(followsFn, /update\.followConversions = FieldValue\.increment\(1\)/)

  const supportTriggersFn = read('functions/src/support/triggers.ts')
  assert.match(supportTriggersFn, /update\.supportConversions = FieldValue\.increment\(1\)/)

  const rules = read('firestore.rules')
  assert.match(rules, /match \/previewSessions\/\{sessionId\} \{\s*allow read, write: if false;/)
  assert.match(rules, /request\.resource\.data\.get\('followConversions', 0\) == resource\.data\.get\('followConversions', 0\)/)
  assert.match(rules, /request\.resource\.data\.get\('supportConversions', 0\) == resource\.data\.get\('supportConversions', 0\)/)

  const growth = read('src/pages/artist/dashboard/GrowthPage.tsx')
  assert.match(growth, /label="Follow conversions" value=\{formatCount\(artist\.followConversions \?\? 0\)\}/)
  assert.match(growth, /label="Support conversions" value=\{formatCount\(artist\.supportConversions \?\? 0\)\}/)
})

test('music access ALLOW/DENY matrix — every row of the spec, traced to the code that actually enforces it', () => {
  const tracksFn = read('functions/src/tracks.ts')
  const rules = read('firestore.rules')
  const storage = read('storage.rules')
  const downloads = read('functions/src/licensing/downloads.ts')

  // 1. Public user reads public track metadata -> ALLOW.
  assert.match(rules, /resource\.data\.visibility == 'public'/)

  // 2. Public user (signed out, uid === null) accesses the preview -> ALLOW.
  //    canPreviewTrack's base case (public/followers/supporters/early_access)
  //    falls through to an unconditional `return true`. A signed-out caller's
  //    roles resolve to [] (no Firestore lookup), so `roles.includes('dj')`
  //    correctly denies dj_only without a separate uid check.
  assert.match(tracksFn, /async function canPreviewTrack\(uid: string \| null, track: FirebaseFirestore\.DocumentData\): Promise<boolean> \{/)
  assert.match(tracksFn, /const roles = uid \? await getRoles\(uid\) : \[\]/)
  assert.match(tracksFn, /if \(track\.visibility === 'dj_only'\) return roles\.includes\('dj'\)/)

  // 3. Public user (no uid) accesses a followers-tier full stream -> DENY.
  //    canStreamFullTrack hits `if (!uid) return false` before any tier check
  //    can grant access (the public-visibility and early_access-public-date
  //    checks are the only paths before that guard, and neither applies here).
  assert.match(tracksFn, /if \(track\.visibility === 'public'\) return true/)
  assert.match(tracksFn, /if \(!uid\) return false/)

  // 4. A real follower accesses that eligible full stream -> ALLOW (a genuine follows/{uid_artistId} doc exists).
  assert.match(tracksFn, /if \(track\.visibility === 'followers'\) \{\s*const follow = await db\.collection\('follows'\)\.doc\(`\$\{uid\}_\$\{track\.artistId\}`\)\.get\(\)\s*return follow\.exists \|\| isActiveSupporter/)

  // 5. That same follower (no supportRelationships doc) accesses a supporters-only full stream -> DENY.
  //    isActiveSupporter returns false immediately when the relationship doc doesn't exist.
  assert.match(tracksFn, /async function isActiveSupporter\(uid: string, artistId: string\): Promise<boolean> \{/)
  assert.match(tracksFn, /if \(!relSnap\.exists\) return false/)

  // 6. A supporter with an active/trialing subscription accesses that supporters-only track -> ALLOW.
  assert.match(tracksFn, /return status === 'active' \|\| status === 'trialing'/)

  // 7. "Other user's fake follow state" -> DENY. There is no channel for a
  //    client to assert isFollowing/isSupporting to the server at all — the
  //    callable only ever accepts trackId/kind, and every entitlement check
  //    is a live Firestore doc read the caller cannot influence.
  assert.match(tracksFn, /const \{ trackId, kind \} = request\.data/)
  assert.doesNotMatch(tracksFn, /request\.data\?\.isFollowing|request\.data\?\.isSupporting/)

  // 8/9/10. Public, follower, and supporter all DENY on the master —
  // originals/ is owner-only at Storage regardless of visibility tier or
  // relationship, and neither canPreviewTrack nor canStreamFullTrack (nor
  // anything else fan-facing) ever touches originalAudioPath.
  assert.match(storage, /match \/artists\/\{artistId\}\/originals\/\{fileName\} \{\s*allow read: if isOwner\(artistId\);/)
  // getTrackPlaybackUrl only ever signs previewAudioPath or streamAudioPath — never originalAudioPath.
  assert.match(tracksFn, /const path = kind === 'preview' \? track\.previewAudioPath : kind === 'dj_preview' \? track\.djPreviewAudioPath : track\.streamAudioPath/)

  // 11. A DJ with no signed licence agreement for this track -> DENY —
  // downloadLicensedTrack requires an active, non-revoked, non-legal-held
  // agreement, not just the dj role.
  assert.match(downloads, /if \(agreement\.status !== 'active'\)/)
  assert.match(downloads, /if \(agreement\.legalHold\)/)
  assert.match(downloads, /if \(agreement\.downloadRevoked\)/)

  // 12. An approved DJ with a valid agreement -> ALLOW, through the signed,
  // short-lived download URL flow (never a permanent Storage URL).
  assert.match(downloads, /resolveLicencePartyRole\(agreement, djId,/)
})

test('music derivatives fail closed and use real audio metadata', () => {
  const processing = read('src/services/audioProcessing.ts')
  const upload = read('src/pages/artist/dashboard/UploadTrackPage.tsx')
  const trackType = read('src/types/track.ts')
  assert.match(processing, /export async function readAudioMetadata/)
  assert.match(processing, /throw new Error\('Audio processing failed\. Nothing was published and the full track was not used as a preview\.'\)/)
  assert.doesNotMatch(processing, /preview: \{ file: master/)
  assert.match(upload, /previewStartSec \+ previewDurationSec > metadata\.durationSeconds/)
  assert.match(upload, /durationSeconds: metadata\.durationSeconds/)
  assert.match(trackType, /durationSeconds: number/)
  assert.match(trackType, /durationFormatted: string/)
})

test('DJ role never grants a full stream and the licensed master path is exact', () => {
  const tracksFn = read('functions/src/tracks.ts')
  const downloads = read('functions/src/licensing/downloads.ts')
  assert.match(tracksFn, /if \(track\.visibility === 'dj_only'\) return false/)
  assert.match(downloads, /expectedOriginalPrefix = `artists\/\$\{track\.artistId\}\/originals\/\$\{agreement\.trackId\}\.`/)
  assert.match(downloads, /track\.originalAudioPath\.startsWith\(expectedOriginalPrefix\)/)
})

test('the persistent player starts trimmed previews at zero, reports completions, and revalidates access', () => {
  const player = read('src/contexts/PlayerContext.tsx')
  const bar = read('src/components/player/PlayerBar.tsx')
  assert.match(player, /audio\.currentTime = 0/)
  assert.match(player, /recordTrackPlay\(current\.trackId, completedKind, 'completion'\)/)
  assert.match(player, /window\.setInterval\(\(\) => void revalidate\(\), 60_000\)/)
  assert.match(bar, /Want to hear the full/)
  assert.match(bar, /FollowButton/)
  assert.match(bar, /SupportButton/)
})

test('new releases default to follower access with a 45-second preview', () => {
  const upload = read('src/pages/artist/dashboard/UploadTrackPage.tsx')
  const media = read('src/constants/mediaConfig.ts')
  assert.match(upload, /useState<TrackVisibility>\('followers'\)/)
  assert.match(media, /PREVIEW_DEFAULT_DURATION_SEC = 45/)
})

test('a signed-in user can report another account (e.g. a DJ), and an admin reviewing it sees who it actually is (user-reported: report-a-user had no UI at all despite the backend supporting it)', () => {
  const modal = read('src/components/track/ReportUserModal.tsx')
  assert.match(modal, /export function ReportUserModal/)
  assert.match(modal, /submitReport\(\{ targetType: 'user', targetId: userId, reason, description \}\)/)

  const djPage = read('src/pages/dj/DJPublicProfilePage.tsx')
  assert.match(djPage, /onClick=\{\(\) => setShowReport\(true\)\}/)
  assert.match(djPage, /<ReportUserModal userId=\{profile\.djId\} subjectLabel=\{profile\.name\} onClose=\{\(\) => setShowReport\(false\)\} \/>/)

  const admin = read('src/pages/admin/AdminReportsPage.tsx')
  assert.match(admin, /else if \(report\.targetType === 'user'\) \{/)
  assert.match(admin, /void getUserProfile\(report\.targetId\)\.then/)
  assert.match(admin, /report\.targetType === 'artist' \|\| report\.targetType === 'track' \|\| report\.targetType === 'user'/)
  // No generic public page exists for a plain account, so a 'user' subject renders as text, not a dead/wrong link.
  assert.match(admin, /Account: \{subjects\[report\.reportId\]!\.label\}/)
})

test('public mobile pages respect the device safe area and cannot widen the viewport', () => {
  const css = read('src/index.css')
  const artistProfile = read('src/pages/artist/ArtistPublicProfilePage.tsx')
  const landing = read('src/pages/marketing/LandingPage.tsx')

  assert.match(css, /html,\s*body,\s*#root \{[\s\S]*max-width: 100%;[\s\S]*overflow-x: hidden;/)
  assert.match(artistProfile, /env\(safe-area-inset-top\)/)
  assert.match(artistProfile, /flex min-w-0 flex-wrap gap-2/)
  assert.match(landing, /env\(safe-area-inset-top\)/)
})

test('the shared mobile navigation keeps home-indicator clearance without a double-height footer', () => {
  const nav = read('src/components/layout/MobileNav.tsx')
  assert.match(nav, /calc\(env\(safe-area-inset-bottom\)-1rem\)/)
  assert.match(nav, /flex flex-1 translate-y-1 flex-col/)
  assert.doesNotMatch(nav, /style=\{\{ paddingBottom: 'env\(safe-area-inset-bottom\)' \}\}/)
})

test('an admin can never suspend or delete their own account (user-reported: appeared in the Users list like any other account, with working Suspend/Delete buttons on themselves)', () => {
  const page = read('src/pages/admin/AdminUsersPage.tsx')
  assert.match(page, /listUsers\(\)\.then\(\(rows\) => setUsers\(rows\.filter\(\(u\) => u\.uid !== firebaseUser\?\.uid\)\)\)/)

  const suspension = read('functions/src/admin/moderation.ts')
  assert.match(suspension, /if \(userId === adminId\) \{\s*throw new HttpsError\('failed-precondition', 'You cannot suspend your own account\.'\)/)

  const deletion = read('functions/src/account/deleteAccount.ts')
  assert.match(deletion, /if \(userId === adminId\) \{\s*throw new HttpsError\('failed-precondition', 'Use account settings to delete your own account/)
})

test('only an admin account can change its own roles after signup (add or remove, going invisible in the process) — a regular fan/artist/dj account is frozen at whatever roles it picked during onboarding (user-reported: "no users should not be able to do this only admin")', () => {
  const rules = read('firestore.rules')
  // Denormalized field, not a live cross-document roleActiveFor() check —
  // see the dedicated "a fan can not see artist profile cards" regression
  // test below for why that check was replaced.
  assert.match(rules, /allow read: if resource\.data\.get\('roleActive', true\) == true \|\| isSelf\(artistId\) \|\| isAdmin\(\);/)
  assert.match(rules, /allow read: if resource\.data\.get\('roleActive', true\) == true \|\| isSelf\(djId\) \|\| isAdmin\(\);/)
  assert.match(rules, /resource\.data\.get\('artistRoleActive', true\) == true/)

  // A non-admin account may only ever set its own roles ONCE, at initial
  // signup (roles still []) — after that, this path freezes roles exactly
  // as-is, so it can never add a later role or step back from one on its own.
  const usersUpdateRule = rules.slice(rules.indexOf('allow update: if isSelf(userId)'), rules.indexOf('allow update: if isSelf(userId)') + 2000)
  assert.match(usersUpdateRule, /resource\.data\.roles\.size\(\) == 0 && request\.resource\.data\.roles\.hasOnly\(\['fan', 'artist', 'dj'\]\)/)
  assert.match(usersUpdateRule, /resource\.data\.roles\.hasOnly\(\['fan', 'artist', 'dj'\]\) && request\.resource\.data\.roles == resource\.data\.roles/)
  // An admin account, by contrast, can add or remove its own fan/artist/dj roles at any time, but never grant/revoke 'admin' via this client-writable path.
  assert.match(usersUpdateRule, /resource\.data\.roles\.removeAll\(\['admin'\]\)\.hasOnly\(\['fan', 'artist', 'dj'\]\)/)

  // Adding a role after signup (e.g. a fan becoming an artist too) is
  // legitimate self-service for any account, not admin-only — AddRolePage
  // requests the named action via the trusted createArtistProfile/
  // createDJProfile Cloud Functions instead of writing roles directly, so
  // it's unrestricted by account type, only by the backend's own checks.
  const addRolePage = read('src/pages/onboarding/AddRolePage.tsx')
  assert.doesNotMatch(addRolePage, /This isn't self-service/)
  assert.match(addRolePage, /createArtistProfile\(\{ name, bio, genres: genreList, location \}\)/)
  assert.match(addRolePage, /createDJProfile\(\{ name, bio, genres: genreList, country: location, city \}\)/)

  const functions = read('functions/src/tracks.ts')
  assert.match(functions, /async function artistRoleActive\(artistId: string\): Promise<boolean> \{/)
  // Every entitlement check must gate on the artist's live role, and must do so AFTER its own admin-bypass check,
  // so an admin never loses the ability to preview/play/stream while investigating an account that has gone dark.
  for (const fn of ['canPreviewTrack', 'canPlayDjPreview', 'canStreamFullTrack']) {
    const start = functions.indexOf(`async function ${fn}(`)
    const end = functions.indexOf('\n}', start)
    const body = functions.slice(start, end)
    const adminCheckIndex = body.indexOf("roles.includes('admin')")
    const roleActiveCheckIndex = body.indexOf('artistRoleActive(track.artistId)')
    assert.ok(adminCheckIndex !== -1, `${fn} should bypass for admins`)
    assert.ok(roleActiveCheckIndex !== -1, `${fn} should gate on artistRoleActive`)
    assert.ok(adminCheckIndex < roleActiveCheckIndex, `${fn} must check admin bypass before the artist role-active gate`)
  }

  const userService = read('src/services/userService.ts')
  assert.match(userService, /export async function removeRole\(uid: string, role: Exclude<UserRole, 'admin'>\): Promise<void> \{/)
  assert.match(userService, /roles: arrayRemove\(role\)/)

  for (const [page, label] of [
    ['src/pages/artist/dashboard/ArtistSettingsPage.tsx', 'Remove artist role'],
    ['src/pages/dj/DJProfilePage.tsx', 'Remove DJ role'],
    ['src/pages/fan/SettingsPage.tsx', 'Remove fan role'],
  ]) {
    const src = read(page)
    assert.match(src, /removeRole/)
    assert.match(src, new RegExp(label))
    // The button only renders for admin accounts — a regular user never sees it at all.
    assert.match(src, /hasRole\('admin'\)/)
  }

  // A visitor blocked by the live-role gate sees a clean "not found," not a generic error screen.
  const artistPublic = read('src/pages/artist/ArtistPublicProfilePage.tsx')
  assert.match(artistPublic, /\.code === 'permission-denied'/)
  const djPublic = read('src/pages/dj/DJPublicProfilePage.tsx')
  assert.match(djPublic, /\.code === 'permission-denied'/)
})

test('fan -> artist and fan -> DJ self-service upgrades work through trusted backend actions, never a client role write (user-reported: freezing roles broke "+ Add an artist profile" / "Start free trial" / "+ Add a DJ profile" / "Create DJ profile")', () => {
  const rules = read('firestore.rules')
  // The only legitimate way to create these profiles is now Cloud-Function-only —
  // a direct client create is refused outright, regardless of who's asking.
  const artistBlock = rules.slice(rules.indexOf('match /artistProfiles/{artistId}'), rules.indexOf('match /artistSlugs/{slug}'))
  assert.match(artistBlock, /allow create: if false;/)
  const slugBlock = rules.slice(rules.indexOf('match /artistSlugs/{slug}'), rules.indexOf('match /djProfiles/{djId}'))
  assert.match(slugBlock, /allow create: if false;/)
  const djBlock = rules.slice(rules.indexOf('match /djProfiles/{djId}'), rules.indexOf('match /tracks/{trackId}'))
  assert.match(djBlock, /allow create: if false;/)

  const profiles = read('functions/src/profiles.ts')
  assert.match(profiles, /export const createArtistProfile = onCall/)
  assert.match(profiles, /export const createDJProfile = onCall/)
  // Both must act only on the authenticated caller — never a client-supplied id — and never
  // let the client name the role being granted (no request.data.role/roles/uid/artistId/djId anywhere).
  assert.doesNotMatch(profiles, /request\.data\?\.(role|roles|uid|artistId|djId)\b/)
  assert.match(profiles, /const uid = request\.auth\.uid/)
  // The granted role is a hardcoded literal in server code, not derived from client input.
  assert.match(profiles, /FieldValue\.arrayUnion\('artist'\)/)
  assert.match(profiles, /FieldValue\.arrayUnion\('dj'\)/)
  assert.match(profiles, /if \(!request\.auth\) throw new HttpsError\('unauthenticated', 'Sign in required\.'\)/)
  assert.match(profiles, /await requireActiveUser\(uid\)/)
  assert.match(profiles, /await enforceRateLimit\(`createArtistProfile_\$\{uid\}`, 5, 60 \* 60\)/)
  assert.match(profiles, /await enforceRateLimit\(`createDJProfile_\$\{uid\}`, 5, 60 \* 60\)/)
  // Idempotent: an account (or a retried call) that already has the profile
  // just gets the role re-affirmed, never a second profile / a hard error.
  assert.match(profiles, /if \(existingProfile\.exists\) \{\s*tx\.update\(userRef, \{ roles: FieldValue\.arrayUnion\('artist'\)/)
  assert.match(profiles, /if \(existingProfile\.exists\) \{\s*tx\.update\(userRef, \{ roles: FieldValue\.arrayUnion\('dj'\)/)

  assert.match(read('functions/src/index.ts'), /export \{ createArtistProfile, createDJProfile \} from '\.\/profiles\.js'/)

  // Client services request the named action and can never pass a uid —
  // there's no parameter for one, so nothing the caller sends can target another account.
  const artistService = read('src/services/artistService.ts')
  assert.match(artistService, /export async function createArtistProfile\(input: CreateArtistProfileInput\): Promise<string> \{/)
  assert.match(artistService, /callable<CreateArtistProfileInput, \{ slug: string \}>\('createArtistProfile'\)/)
  const djService = read('src/services/djService.ts')
  assert.match(djService, /export async function createDJProfile\(input: CreateDJProfileInput\): Promise<void> \{/)
  assert.match(djService, /callable<CreateDJProfileInput, \{ ok: true \}>\('createDJProfile'\)/)

  // Pricing's "Start free trial" / "Create DJ profile" and Settings' "+ Add…"
  // links still point at the self-service onboarding/add-role screen —
  // restored to working (not gated behind admin / a "contact support" wall).
  const pricing = read('src/pages/marketing/PricingPage.tsx')
  assert.match(pricing, /\/onboarding\/add-role\?role=artist/)
  assert.match(pricing, /\/onboarding\/add-role\?role=dj/)
  const settings = read('src/pages/fan/SettingsPage.tsx')
  assert.match(settings, /\+ Add an artist profile/)
  assert.match(settings, /\+ Add a DJ profile/)
})

test('restricted-tier Story media never persists a permanent, Storage-rules-bypassing download URL on the document (a currently-entitled viewer reading the raw doc must not keep working access forever after losing entitlement)', () => {
  const stories = read('functions/src/stories/stories.ts')
  assert.match(stories, /mediaUrl: visibility === 'public' && typeof mediaUrl === 'string' \? mediaUrl : null/)
  // getStoryMediaUrl remains the only way to actually fetch restricted-tier media — a
  // fresh, short-lived signed URL, re-checked against canViewStory on every single call.
  assert.match(stories, /async function canViewStory\(uid: string \| null, story: FirebaseFirestore\.DocumentData\): Promise<boolean> \{/)
  assert.match(stories, /export const getStoryMediaUrl = onCall/)
  assert.match(stories, /if \(!\(await canViewStory\(request\.auth\?\.uid \?\? null, story\)\)\) \{/)
  // The client only ever renders story.mediaUrl directly for public stories — every other
  // tier always resolves through the signed-URL callable.
  const viewer = read('src/components/stories/StoryViewer.tsx')
  assert.match(viewer, /story\.visibility === 'public' \? story\.mediaUrl : \(mediaUrls\[story\.storyId\] \?\? null\)/)
})

test('the DJ<->artist licensing flow has no general-purpose chat anywhere in the stack — negotiation is exclusively structured offers/counter-offers and a server-owned event log', () => {
  // The old conversations/messages system (sendMessage callable, writeSystemMessage helper,
  // and every conversationId lookup that fed it) is fully removed, not just hidden — it was
  // provably dead (no request ever sets conversationId, no UI ever read messages/sendMessage).
  assert.doesNotMatch(read('functions/src/index.ts'), /sendMessage/)
  for (const file of ['functions/src/licensing/offers.ts', 'functions/src/licensing/agreements.ts', 'functions/src/stripe/webhook.ts']) {
    const src = read(file)
    assert.doesNotMatch(src, /conversationId/)
    assert.doesNotMatch(src, /writeSystemMessage/)
  }
  const messagingService = read('src/services/messagingService.ts')
  assert.doesNotMatch(messagingService, /sendMessage/)
  assert.doesNotMatch(messagingService, /subscribeConversation|subscribeMessages/)
  assert.match(messagingService, /sendBulkDjOutreach/)
})

test('abuse-prone user-facing callables that write amplifying/broadcast data are all rate-limited: reports, Stories, DJ negotiation offers, and bulk DJ outreach', () => {
  const cases = [
    ['functions/src/admin/reports.ts', /await enforceRateLimit\(`submitReport_\$\{request\.auth\.uid\}`, 10, 60 \* 60\)/],
    ['functions/src/stories/stories.ts', /await enforceRateLimit\(`createStory_\$\{artistId\}`, 30, 60 \* 60\)/],
    ['functions/src/licensing/offers.ts', /await enforceRateLimit\(`sendOffer_\$\{uid\}`, 30, 60 \* 60\)/],
    ['functions/src/licensing/offers.ts', /await enforceRateLimit\(`counterOffer_\$\{uid\}`, 30, 60 \* 60\)/],
    // A "blast every opted-in DJ" broadcast needs a much tighter, day-scale
    // limit — DJ opt-in consent is meaningless if an artist can spam it hourly.
    ['functions/src/messaging/bulkOutreach.ts', /await enforceRateLimit\(`sendBulkDjOutreach_\$\{artistId\}`, 3, 24 \* 60 \* 60\)/],
  ]
  for (const [file, pattern] of cases) {
    assert.match(read(file), pattern)
  }
})

test('Story audience enforcement covers every tier server-side, and "expired" means immediately undiscoverable even though hard-deletion follows the same grace-period retention pattern used everywhere else in this codebase', () => {
  const stories = read('functions/src/stories/stories.ts')
  // Every tier's real check, traced: public/owner/admin bypass, followers (real
  // follow doc OR active supporter), supporters (active subscription only), dj
  // (role + the artist's own storiesDjEnabled flag) — never a client-asserted claim.
  assert.match(stories, /if \(uid === story\.artistId\) return true/)
  assert.match(stories, /if \(story\.visibility === 'public'\) return true/)
  assert.match(stories, /if \(roles\.includes\('admin'\)\) return true/)
  assert.match(stories, /if \(story\.visibility === 'followers'\) \{\s*const follow = await db\.collection\('follows'\)\.doc\(`\$\{uid\}_\$\{story\.artistId\}`\)\.get\(\)\s*return follow\.exists \|\| isActiveSupporter\(uid, story\.artistId\)/)
  assert.match(stories, /if \(story\.visibility === 'supporters'\) \{\s*return isActiveSupporter\(uid, story\.artistId\)/)
  assert.match(stories, /if \(story\.visibility === 'dj'\) \{\s*if \(!roles\.includes\('dj'\)\) return false/)
  assert.match(stories, /return artistSnap\.data\(\)\?\.storiesDjEnabled === true\s*\}\s*return false\s*\}/)

  // Discovery: every listing query a viewer can actually reach a Story through
  // filters expiresAt > now, so an expired Story is never surfaced regardless of
  // audience tier — this is the real "expired Stories cannot be viewed" guarantee,
  // since there is no direct /story/:id deep-link route to bypass the listing query.
  const svc = read('src/services/storyService.ts')
  assert.match(svc, /where\('expiresAt', '>', Timestamp\.now\(\)\)/)
  assert.doesNotMatch(read('src/App.tsx'), /path="\/story\/:/)

  // The underlying document + media are hard-deleted by expireStories, but only
  // after a further, admin-configurable recovery window (storyRecoveryDays) past
  // the 24h mark — the same soft-delete-then-hard-delete retention shape used for
  // notifications/abandoned requests elsewhere, not an accidental gap unique to Stories.
  const cleanup = read('functions/src/retention/cleanup.ts')
  assert.match(cleanup, /export const expireStories = onSchedule\('every 24 hours', async \(\) => \{/)
  assert.match(cleanup, /const \{ storyRecoveryDays \} = await getDataRetentionSettings\(\)/)
  assert.match(cleanup, /collection\('stories'\)\.where\('isHighlight', '==', false\)\.where\('expiresAt', '<=', cutoff\)/)
})

test('the "message" report target is gone with the chat system that created it — every other report target still works', () => {
  const reports = read('functions/src/admin/reports.ts')
  assert.doesNotMatch(reports, /'message'/)
  assert.match(reports, /const TARGET_TYPES = \['track', 'artist', 'dj', 'user', 'post', 'agreement'\] as const/)
  const moderationTypes = read('src/types/moderation.ts')
  assert.doesNotMatch(moderationTypes, /'message'/)
  // Every other target type this app actually supports is untouched.
  for (const target of ['track', 'artist', 'dj', 'user', 'post', 'agreement']) {
    assert.match(reports, new RegExp(`'${target}'`))
  }
})

test('BUG 1 — an artist can actually reach playback of their own uploaded track: server-side owner entitlement already existed, but nothing in the UI called it from the artist\'s own Music page (user-reported)', () => {
  const tracksFn = read('functions/src/tracks.ts')
  // 1/2. Owner bypass is per-DOCUMENT (uid === THIS track's artistId), not a role check — an
  // artist can never reach this branch for a track whose artistId is someone else's uid, so
  // one artist's own-track access can never extend to another artist's private/full track.
  for (const fn of ['canPreviewTrack', 'canPlayDjPreview', 'canStreamFullTrack']) {
    const start = tracksFn.indexOf(`async function ${fn}(`)
    const end = tracksFn.indexOf('\n}', start)
    const body = tracksFn.slice(start, end)
    assert.match(body, /if \(uid === track\.artistId\) return true/, `${fn} must grant the owner full access`)
  }
  // Owner bypass is checked before the takenDown/restrictedCapabilities short-circuit only in
  // the sense that it's unreachable if that already returned false — moderation holds still
  // apply to the owner too, which is correct: a takedown pulls the track from everyone.
  assert.match(tracksFn, /if \(track\.takenDown === true \|\| \(track\.restrictedCapabilities \?\? \[\]\)\.includes\('streaming'\)\) return false\s*\n\s*if \(uid === track\.artistId\) return true/)

  // getTrackPlaybackUrl derives uid exclusively from request.auth.uid — there is no
  // trackId/uid/artistId field read from request.data that could let a client claim ownership.
  assert.match(tracksFn, /const uid = request\.auth\?\.uid \?\? null/)
  assert.doesNotMatch(tracksFn, /request\.data\?\.(uid|artistId|ownerId)\b/)

  // The master is structurally unreachable through this function regardless of entitlement —
  // 'kind' only ever resolves to previews/dj-previews/streaming directories, never originals.
  assert.match(tracksFn, /type PlaybackKind = 'preview' \| 'dj_preview' \| 'stream'/)
  assert.match(
    tracksFn,
    /const directory = kind === 'preview' \? 'previews' : kind === 'dj_preview' \? 'dj-previews' : 'streaming'/,
  )
  const getUrlStart = tracksFn.indexOf('export const getTrackPlaybackUrl = onCall')
  const getUrlEnd = tracksFn.indexOf('\n})', getUrlStart)
  assert.doesNotMatch(tracksFn.slice(getUrlStart, getUrlEnd), /originals/, 'getTrackPlaybackUrl must never resolve to the originals/ directory')

  // DJ licensed downloads are a completely separate, untouched system (agreement/payment
  // gated, not track-visibility gated) — owner playback here can't reach it either way.
  const downloads = read('functions/src/licensing/downloads.ts')
  assert.match(downloads, /export const downloadLicensedTrack = onRequest/)
  assert.doesNotMatch(downloads, /getTrackPlaybackUrl/)

  // The actual, verified root cause: the artist's own track-management page never called
  // usePlayer()/playTrack() at all — there was no way to trigger playback from there, even
  // though the server has always authorised it correctly for the owner.
  const musicPage = read('src/pages/artist/dashboard/MusicPage.tsx')
  assert.match(musicPage, /import \{ usePlayer \} from '@\/contexts\/PlayerContext'/)
  assert.match(musicPage, /const \{ playTrack, togglePlay, currentTrack, isPlaying \} = usePlayer\(\)/)
  assert.match(musicPage, /onClick=\{\(\) => \(currentTrack\?\.trackId === track\.trackId \? togglePlay\(\) : playTrack\(track, tracks\)\)\}/)
})

test('BUG 2 — public preview media is a physically separate, actually-clipped file, never the full stream with a client-side stop timer (user-reported: a 30s-configured preview played the full 4-minute track)', () => {
  // Preview generation already exists and already physically clips the audio via ffmpeg's
  // -ss/-t flags at upload time — it does not send the full file and rely on the UI to stop it.
  const processing = read('src/services/audioProcessing.ts')
  assert.match(processing, /'-ss', String\(opts\.previewStartSec\),/)
  assert.match(processing, /'-i', inputName,/)
  assert.match(processing, /'-t', String\(opts\.previewDurationSec\),/)
  // Streaming derivative is a separate ffmpeg pass with no -ss/-t trim at all — full length.
  const streamingExecStart = processing.indexOf("await ffmpeg.exec(['-i', inputName, '-b:a'")
  assert.ok(streamingExecStart !== -1, 'the streaming derivative must be produced by its own untrimmed ffmpeg pass')

  // Regenerating the preview after the artist edits timing re-clips from the real master —
  // never reuses/extends the old preview file — and overwrites the exact same Storage path,
  // uploaded BEFORE the new Firestore timing fields are written, so nothing can ever read a
  // "new" previewDurationSec paired with an old, unclipped, or mismatched preview file.
  assert.match(processing, /export async function derivePreviewAsset\(/)
  const trackService = read('src/services/trackService.ts')
  assert.match(trackService, /export async function regenerateTrackPreview\(/)
  assert.match(trackService, /uploadBytesResumable\(ref\(storage, track\.previewAudioPath\), derivative\.file\)/)
  const modal = read('src/components/track/TrackAccessSettingsModal.tsx')
  const regenIndex = modal.indexOf('await regenerateTrackPreview(track, previewStartSec, previewDurationSec)')
  const updateIndex = modal.indexOf('await updateTrackAccessSettings(track.trackId,')
  assert.ok(regenIndex !== -1 && updateIndex !== -1 && regenIndex < updateIndex, 'the preview file must be rebuilt before the new timing is saved to Firestore')

  // Upload writes preview/streaming/original to three distinct Storage paths — never the same object.
  assert.match(trackService, /const originalPath = `artists\/\$\{artistId\}\/originals\/\$\{trackId\}\.\$\{extOf\(files\.master\)\}`/)
  assert.match(trackService, /const streamingPath = `artists\/\$\{artistId\}\/streaming\/\$\{trackId\}\.\$\{extOf\(files\.streaming\)\}`/)
  assert.match(trackService, /const previewPath = `artists\/\$\{artistId\}\/previews\/\$\{trackId\}\.\$\{extOf\(files\.preview\)\}`/)

  // getTrackPlaybackUrl never reads previewStartSec/previewDurationSec from the request at
  // playback time at all — a client has no channel to influence which bytes it gets back,
  // only which of the three pre-generated, pre-clipped files (by kind) it's entitled to.
  const tracksFn = read('functions/src/tracks.ts')
  assert.doesNotMatch(tracksFn, /request\.data\?\.previewStartSec|request\.data\?\.previewDurationSec/)
  assert.match(tracksFn, /const \{ trackId, kind \} = request\.data/)

  // Firestore rules independently validate previewStartSec/previewDurationSec at write time —
  // bounded, typed, and cross-checked against the track's own real duration, both on create
  // and on later edit, rejecting NaN/Infinity/negative/excessive/out-of-range values either way.
  const rules = read('firestore.rules')
  assert.match(rules, /request\.resource\.data\.previewStartSec is number\s*\n\s*&& request\.resource\.data\.previewStartSec >= 0\s*\n\s*&& request\.resource\.data\.previewDurationSec is number\s*\n\s*&& request\.resource\.data\.previewDurationSec >= 5\s*\n\s*&& request\.resource\.data\.previewDurationSec <= 90/)
  assert.match(rules, /request\.resource\.data\.previewStartSec \+ request\.resource\.data\.previewDurationSec <= request\.resource\.data\.durationSeconds\)/)
  // Same bounds re-enforced on update, not just create.
  assert.match(rules, /request\.resource\.data\.previewStartSec >= 0\s*\n\s*&& request\.resource\.data\.previewDurationSec >= 5\s*\n\s*&& request\.resource\.data\.previewDurationSec <= 90/)

  // The full ladder: only an entitled listener (owner/admin/public-tier/eligible
  // follower/active supporter/released early-access) ever gets kind:'stream'; everyone else's
  // client-side fallback (PlayerContext) requests kind:'preview' instead — the server decides
  // which, the client never does.
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /let url: string\s*\n\s*try \{\s*\n\s*url = await getStreamPlaybackURL\(track\)/)
  assert.match(player, /const denied = streamError instanceof FirebaseError && streamError\.code === 'functions\/permission-denied'/)
  assert.match(player, /kind = 'preview'\s*\n\s*url = await getPreviewPlaybackURL\(track\)/)

  assert.match(tracksFn, /if \(track\.visibility === 'followers'\) \{\s*const follow = await db\.collection\('follows'\)\.doc\(`\$\{uid\}_\$\{track\.artistId\}`\)\.get\(\)\s*return follow\.exists \|\| isActiveSupporter\(uid, track\.artistId\)/)
  assert.match(tracksFn, /if \(track\.visibility === 'supporters'\) \{\s*return isActiveSupporter\(uid, track\.artistId\)/)
  assert.match(tracksFn, /if \(!relSnap\.exists\) return false/)
  assert.match(tracksFn, /return status === 'active' \|\| status === 'trialing'/)
})

test('BUG 3 — every track card (including on the artist profile) actually toggles play/pause instead of always restarting the track from a fresh playTrack call (user-reported: could not stop/pause playback from the profile)', () => {
  const card = read('src/components/music/TrackCard.tsx')
  // The root cause: onClick always called playTrack, even for the already-current track — so
  // clicking a playing card's button just reloaded/restarted it, never paused it. Every page
  // that renders TrackCard (including the artist profile) shares this one component.
  assert.match(card, /const \{ playTrack, togglePlay, currentTrack, isPlaying \} = usePlayer\(\)/)
  assert.match(card, /onClick=\{\(\) => \(isCurrent \? togglePlay\(\) : playTrack\(track, queue\)\)\}/)
  // The icon itself must actually switch, not just change opacity on an unchanging Play glyph.
  assert.match(card, /isCurrentlyPlaying \? \(\s*<Pause className="h-5 w-5" fill="currentColor" \/>/)
  assert.match(card, /aria-label=\{isCurrentlyPlaying \? `Pause \$\{track\.title\}` : `Play \$\{track\.title\}`\}/)

  const profile = read('src/pages/artist/ArtistPublicProfilePage.tsx')
  assert.match(profile, /import \{ TrackCard \} from '@\/components\/music\/TrackCard'/)

  // The single-track page already had this right — confirms the fix pattern, not a new one.
  const trackPage = read('src/pages/track/TrackPage.tsx')
  assert.match(trackPage, /isCurrent \? togglePlay\(\) : playTrack\(track\)/)

  // Resume-from-position, track-change, natural-end, and error-reset are all handled once,
  // centrally, in the single shared player — never duplicated per page/component.
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /const togglePlay = useCallback\(\(\) => \{\s*const audio = audioRef\.current\s*if \(!audio \|\| !currentTrack\) return\s*if \(isPlaying\) \{\s*audio\.pause\(\)\s*setIsPlaying\(false\)\s*\} else if \(audio\.ended\) \{/)
  assert.match(player, /setIsPlaying\(false\)\s*setPlaybackKind\(null\)\s*const message = error instanceof FirebaseError/)
  assert.match(player, /if \(completedKind === 'preview' \|\| completedKind === 'dj_preview'\) \{\s*setIsPlaying\(false\)\s*setPreviewEnded\(true\)/)
  // Only one HTMLAudioElement for the whole app — a new track's src assignment inherently
  // stops whatever the previous one was playing; there is no second, competing audio element.
  assert.match(player, /const audio = new Audio\(\)/)
  assert.doesNotMatch(player, /new Audio\(\)[\s\S]*new Audio\(\)/)

  // The global player bar already correctly exposes pause/resume and a full-stop (close) control.
  const bar = read('src/components/player/PlayerBar.tsx')
  assert.match(bar, /onClick=\{togglePlay\}/)
  assert.match(bar, /onClick=\{closePlayer\}/)
  assert.match(bar, /aria-label=\{isPlaying \? 'Pause' : 'Play'\}/)

  // Navigating away deliberately does NOT stop playback — the persistent player is an existing,
  // intentional feature (already covered by its own dedicated test), not something to change here.
  assert.match(player, /export function usePlayer\(\): PlayerContextValue \{/)
})

test('BUG 4 — Discover never shows the same artist twice across Rising/Most Supported, never shows the signed-in artist to themselves, and never autoplays (user-reported: "Dean" appeared in both sections)', () => {
  const page = read('src/pages/fan/DiscoverPage.tsx')

  // Root cause: listRisingArtists and listMostSupportedArtists are two independent top-N
  // queries with no awareness of each other — with a small artist pool the same artist can
  // legitimately rank in both. Fixed at presentation/query-composition time only.
  const discovery = read('src/services/discoveryService.ts')
  assert.match(discovery, /export async function listMostSupportedArtists\(count = 12\): Promise<ArtistProfile\[\]> \{\s*const q = query\(collection\(db, 'artistProfiles'\), orderBy\('supporterCount', 'desc'\), limit\(count\)\)/)
  assert.match(discovery, /export async function listRisingArtists\(count = 12\): Promise<ArtistProfile\[\]> \{\s*const q = query\(collection\(db, 'artistProfiles'\), orderBy\('followerCount', 'desc'\), limit\(count\)\)/)

  // Dedup by immutable artistId (never name/slug), Rising claims first (read top-to-bottom),
  // and the ranking ORDER within each list is never touched — only which already-ranked
  // artist gets excluded from a later section.
  assert.match(page, /const dedupedRising = excludeSelfUnlessEmpty\(rising\)/)
  assert.match(page, /const shown = new Set<string>\(dedupedRising\.map\(\(artist\) => artist\.artistId\)\)/)
  assert.match(page, /const supportedCandidates = excludeSelfUnlessEmpty\(supported\)/)
  assert.match(page, /const dedupedSupported = supportedCandidates\.filter\(\(artist\) => !shown\.has\(artist\.artistId\)\)/)

  // Over-fetches (24 candidates for a 12-slot section) so a later section can still fill up
  // to its normal size from further down the SAME truthful ranking, rather than either
  // duplicating an artist or unnecessarily going empty just because the top 12 overlapped.
  assert.match(page, /const FETCH_COUNT = 24/)
  assert.match(page, /listRisingArtists\(FETCH_COUNT\)/)
  assert.match(page, /listMostSupportedArtists\(FETCH_COUNT\)/)
  assert.match(page, /const DISPLAY_COUNT = 12/)
  assert.match(page, /dedupedRising\.slice\(0, DISPLAY_COUNT\)/)
  assert.match(page, /dedupedSupported\.slice\(0, DISPLAY_COUNT\)/)

  // Self-exclusion: the signed-in artist is seeded into the "already shown" set before either
  // section is filtered — this was previously absent (the page didn't even read auth state).
  assert.match(page, /import \{ useAuth \} from '@\/contexts\/AuthContext'/)
  assert.match(page, /const \{ firebaseUser \} = useAuth\(\)/)

  // No fabrication: an under-filled section just renders fewer real cards (or the empty
  // state) — nothing pads it back out to 12 with a repeated artist or invented data.
  assert.doesNotMatch(page, /Math\.random|fake|placeholder|mock/i)
  assert.match(page, /'More artists will appear here as the BackTheVibes community grows\.'/)
  // The "genuinely no data at all" copy is distinct from and never conflated with the
  // "emptied by dedup" copy — each reason gets its own honest message.
  assert.match(page, /'No artists have joined yet\.'/)
  assert.match(page, /'No artists have paying supporters yet\.'/)
  assert.match(page, /risingEmptyReason === 'claimed'/)
  assert.match(page, /mostSupportedEmptyReason === 'claimed'/)

  // Existing artist profile links (via ArtistCard) are untouched — same component, same props.
  assert.match(page, /import \{ ArtistCard \} from '@\/components\/music\/ArtistCard'/)
  assert.match(page, /<ArtistCard key=\{artist\.artistId\} artist=\{artist\} \/>/)

  // No autoplay: this page never calls playTrack/usePlayer at all — whatever the persistent
  // global player is already doing (started by a deliberate click elsewhere) just continues
  // across navigation, which is existing, intentional behaviour, not something introduced here.
  assert.doesNotMatch(page, /usePlayer|playTrack\(/)
})

test('Discover never blanks Rising/Most Supported out just because the signed-in viewer is currently the only artist on the platform (user-reported: "i can see the card as a dj" — same account is the platform\'s sole artist AND sole DJ, so self-exclusion emptied the fan-facing sections while the DJ-facing Artists page, which has no self-exclusion, showed the card fine)', () => {
  const page = read('src/pages/fan/DiscoverPage.tsx')

  // Root cause: self-exclusion (added for BUG 4) unconditionally removed the viewer's own
  // artist profile from both sections. With only one artist in the whole database and that
  // artist signed in, both sections always went empty — not because the query/rules were
  // broken (they weren't; verified live), but because self-exclusion had no fallback for
  // "excluding you leaves nothing else to show."
  assert.match(page, /const selfId = firebaseUser\?\.uid/)
  assert.match(
    page,
    /const excludeSelfUnlessEmpty = \(list: ArtistProfile\[\]\) => \{\s*\n\s*if \(!selfId\) return list\s*\n\s*const filtered = list\.filter\(\(artist\) => artist\.artistId !== selfId\)\s*\n\s*return filtered\.length > 0 \? filtered : list\s*\n\s*\}/,
  )

  // The DJ-facing equivalent (Artists tab) has never had self-exclusion at all — confirms
  // the viewer's own card rendering fine there was never evidence the fan-facing fix was
  // wrong; the two pages just apply different presentation rules on top of the same query.
  const djArtistsPage = read('src/pages/dj/DJArtistsPage.tsx')
  assert.doesNotMatch(djArtistsPage, /firebaseUser|excludeSelf|selfId/)
})

test('Discover\'s "Artists seeking DJ exposure" section shows artist cards, not track cards (user-reported: "shouldn\'t this show the artist card and not the track")', () => {
  const page = read('src/pages/fan/DiscoverPage.tsx')

  // Root cause: the section is titled and framed as artist-level ("Artists seeking DJ
  // exposure"), but it rendered via TrackSection/TrackCard — one card per promoted TRACK,
  // so an artist with several promoted tracks could appear more than once and the cards
  // themselves looked and linked like tracks, not artists. listArtistsSeekingDJExposure is
  // sourced from a track query (the embargo/visibility checks are track-level), so the fix
  // resolves it down to each track's unique artist and renders those as ArtistCards instead.
  assert.match(page, /const uniqueDjArtistIds = \[\.\.\.new Set\(djTracks\.map\(\(track\) => track\.artistId\)\)\]/)
  assert.match(
    page,
    /const djArtistProfiles = \(await Promise\.all\(uniqueDjArtistIds\.map\(\(id\) => getArtistProfile\(id\)\)\)\)\.filter\(/,
  )
  // A single-document getArtistProfile() get() per known artistId — never a list `query()` —
  // so this can't hit the "list query + cross-document get() with no narrowing filter" rule
  // restriction that broke every broad browsing query earlier this session.
  assert.match(page, /import \{ getArtistProfile \} from '@\/services\/artistService'/)

  // Same self-exclusion-unless-it-would-empty-the-section as Rising/Most Supported, but
  // deliberately NOT cross-section deduped against them — "seeking DJ exposure" is a
  // distinct fact (a track opted into DJ licensing), true independently of whether the
  // artist also ranks in Rising or Most Supported, so an artist already shown above must
  // still appear here too (user-reported: "for fan nothing shows in Artists seeking DJ
  // exposure" — caused by exactly this cross-dedup incorrectly emptying the section
  // whenever the platform's only qualifying artist had already been claimed by Rising).
  assert.match(page, /const dedupedDjArtists = excludeSelfUnlessEmpty\(djArtistProfiles\)/)
  assert.doesNotMatch(page, /dedupedDjArtists\.filter\(\(artist\) => !shown\.has/)

  assert.match(
    page,
    /<ArtistSection\s*\n\s*title="Artists seeking DJ exposure"\s*\n\s*artists=\{djReadyArtists\}/,
  )
  assert.match(page, /'No artists are currently open for DJ promotion\.'/)
})

test('DJ Requests never presents a promo-opt-in control that silently fails for a dj-role account with no djProfiles doc yet, and the write itself no longer becomes an uncaught rejection (user-reported console error: "Uncaught (in promise) FirebaseError: Missing or insufficient permissions")', () => {
  const page = read('src/pages/dj/DJRequestsPage.tsx')
  // Root cause: a dj-role account can reach this page without ever having completed DJ
  // profile setup (djProfiles/{uid} doesn't exist) — updateDJProfile then fails because the
  // update rule requires the doc to already exist, and enableArtistPromos had no catch at
  // all, so the rejection went uncaught instead of being shown to the user.
  assert.match(page, /const \[hasDjProfile, setHasDjProfile\] = useState<boolean \| null>\(null\)/)
  assert.match(page, /setHasDjProfile\(profile !== null\)/)
  assert.match(page, /await updateDJProfile\(firebaseUser\.uid, \{ bulkOutreachOptIn: true \}\)\s*\n\s*setPromoOptIn\(true\)\s*\n\s*\} catch \(error\) \{\s*\n\s*notify\(error instanceof Error \? error\.message : 'Could not turn on artist promos\.', 'error'\)/)

  // When there's no profile yet, the page offers the real fix (finish DJ profile setup,
  // matching DJProfilePage's own established "no profile" messaging) instead of a button
  // that would just fail again.
  assert.match(page, /hasDjProfile === false \? \(/)
  assert.match(page, /Finish setting up your DJ profile/)
  assert.match(page, /to="\/dj\/profile"/)
  const djProfilePage = read('src/pages/dj/DJProfilePage.tsx')
  assert.match(djProfilePage, /No DJ profile found/)
})

test('a role held without a matching profile document is never a dead end — Settings correctly offers "finish setup" instead of a broken dashboard link, and both dashboards\' own empty states link straight to the fix (user-reported: "No DJ profile found... there is no way to create a profile")', () => {
  // Root cause: Settings decided "Go to dashboard" vs "+ Add a profile" purely from the roles
  // array, never checking whether the profile document actually exists — so an account that
  // holds the role without a profile (e.g. granted via the admin role toggle, which only ever
  // touches users.roles, never artistProfiles/djProfiles) saw "Go to dashboard", which landed
  // on a page saying "No profile found... add one from Settings" — pointing right back here.
  const settings = read('src/pages/fan/SettingsPage.tsx')
  assert.match(settings, /import \{ subscribeArtistProfile \} from '@\/services\/artistService'/)
  assert.match(settings, /import \{ subscribeDJProfile \} from '@\/services\/djService'/)
  assert.match(settings, /const \[hasArtistProfile, setHasArtistProfile\] = useState<boolean \| undefined>\(undefined\)/)
  assert.match(settings, /const \[hasDjProfile, setHasDjProfile\] = useState<boolean \| undefined>\(undefined\)/)
  assert.match(settings, /profile\?\.roles\.includes\('artist'\) && hasArtistProfile \? \(/)
  assert.match(settings, /profile\?\.roles\.includes\('dj'\) && hasDjProfile \? \(/)
  // Both branches route to the SAME idempotent create flow regardless of whether the role is
  // already held — createArtistProfile/createDJProfile just create the missing profile and
  // re-affirm the (already-present) role, never erroring or duplicating anything.
  assert.match(settings, /to="\/onboarding\/add-role\?role=artist"/)
  assert.match(settings, /to="\/onboarding\/add-role\?role=dj"/)

  const addRolePage = read('src/pages/onboarding/AddRolePage.tsx')
  assert.doesNotMatch(addRolePage, /roles\.includes\('artist'\)|roles\.includes\('dj'\)/)

  // Each dashboard's own "no profile" empty state now links straight to that same fix instead
  // of just describing where to go (the previous copy pointed back at Settings, which — before
  // the fix above — could never actually get them here).
  const djProfilePage = read('src/pages/dj/DJProfilePage.tsx')
  assert.match(djProfilePage, /to="\/onboarding\/add-role\?role=dj"/)
  assert.match(djProfilePage, /Complete DJ profile/)
  const artistSettingsPage = read('src/pages/artist/dashboard/ArtistSettingsPage.tsx')
  assert.match(artistSettingsPage, /to="\/onboarding\/add-role\?role=artist"/)
  assert.match(artistSettingsPage, /Complete artist profile/)
})

test('a new service worker taking control no longer force-reloads the page out from under active playback (user-reported: "when I click on the track the page reloads" — actually a deploy landing mid-playback, not the click itself)', () => {
  const sw = read('src/lib/registerServiceWorker.ts')
  assert.match(sw, /import \{ isPlaybackActive \} from '\.\/playbackActivity'/)
  assert.match(sw, /navigator\.serviceWorker\.addEventListener\('controllerchange', \(\) => \{/)
  assert.match(sw, /deferReloadUntilPlaybackStops\(\(\) => \{/)
  assert.match(sw, /function deferReloadUntilPlaybackStops\(reload: \(\) => void\): void \{/)
  assert.match(sw, /if \(!isPlaybackActive\(\)\) \{\s*reload\(\)\s*return\s*\}/)
  // Bounded wait — never defers forever if something goes wrong with the flag.
  assert.match(sw, /const maxWaitMs = 10 \* 60 \* 1000/)

  const activity = read('src/lib/playbackActivity.ts')
  assert.match(activity, /export function setPlaybackActive\(value: boolean\): void \{/)
  assert.match(activity, /export function isPlaybackActive\(\): boolean \{/)

  // PlayerContext is the only writer — kept accurate to real HTMLAudioElement
  // playback state (isPlaying), not just "a track is loaded".
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /import \{ setPlaybackActive \} from '@\/lib\/playbackActivity'/)
  assert.match(player, /setPlaybackActive\(isPlaying\)\s*\n\s*return \(\) => setPlaybackActive\(false\)\s*\n\s*\}, \[isPlaying\]\)/)
})

test('DJ discovery surfaces a track open for DJ promotion regardless of its fan-facing visibility tier (user-reported: "the artist has a DJ promo but the DJ can not see it") — a followers/supporters/early_access track promoted to DJs is no longer silently excluded before isTrackAcceptingDjRequests ever runs', () => {
  const svc = read('src/services/trackService.ts')
  // Root cause: the query filtered visibility in ['public'] (or ['public','dj_only'] for DJ
  // callers) BEFORE isTrackAcceptingDjRequests ever ran — a real track (djPromotion: true,
  // djDealSettings.acceptDjRequests: true) with visibility 'followers' was excluded at the
  // query stage and never reached that check at all, even though the check itself was correct.
  assert.match(svc, /const baseVisibilities = \['public', 'followers', 'supporters', 'early_access'\]/)
  assert.match(svc, /const visibilities = opts\.includeDjOnly \? \[\.\.\.baseVisibilities, 'dj_only'\] : baseVisibilities/)
  // 'private' stays excluded — DJ promotion never overrides a track the owner marked private.
  assert.doesNotMatch(svc, /baseVisibilities = \[.*'private'/)
  assert.match(svc, /\.filter\(isTrackAcceptingDjRequests\)/)

  // The composite index this broadened query needs (visibility in [...] + orderBy createdAt)
  // already exists — reused, not newly added, from the identical pattern listNewReleaseTracks
  // already uses successfully.
  const indexes = read('firestore.indexes.json')
  assert.match(
    indexes,
    /"collectionGroup": "tracks"[\s\S]*?"fieldPath": "visibility", "order": "ASCENDING" \}[\s\S]*?"fieldPath": "createdAt", "order": "DESCENDING"/,
  )

  // Every DJ-facing (and fan-facing "seeking DJ exposure") surface goes through this one
  // function — a single fix covers DJDiscoverPage, DJRequestsPage, and Discover's DJ section.
  for (const file of ['src/pages/dj/DJDiscoverPage.tsx', 'src/pages/dj/DJRequestsPage.tsx', 'src/pages/fan/DiscoverPage.tsx']) {
    assert.match(read(file), /listArtistsSeekingDJExposure/)
  }
})

test('a fan can see artist profile cards and browse tracks again (user-reported) — Discover/new-releases/DJ-discovery list queries no longer fail outright because their security rule needed a cross-document get() call with no narrowing filter', () => {
  const rules = read('firestore.rules')
  // Root cause: Firestore rejects an entire list-style query outright (permission-denied
  // for every candidate, not just an inactive one) when its rule needs a get()/exists() call
  // and the query has no equality filter narrow enough to bound the candidate set. The live
  // roleActiveFor(uid, role) check (a cross-document get()) on artistProfiles/djProfiles/tracks
  // read rules broke every broad query against them — listRisingArtists, listMostSupportedArtists,
  // listNewReleaseTracks, listDJPromotionTracksFiltered — confirmed live via direct Firestore
  // REST calls before the fix (403 PERMISSION_DENIED) and after (200, real documents returned).
  // The helper function itself is gone (comments below still name it, for context on why).
  assert.doesNotMatch(rules, /function roleActiveFor\(uid, role\)/)
  assert.match(rules, /allow read: if resource\.data\.get\('roleActive', true\) == true \|\| isSelf\(artistId\) \|\| isAdmin\(\);/)
  assert.match(rules, /allow read: if resource\.data\.get\('roleActive', true\) == true \|\| isSelf\(djId\) \|\| isAdmin\(\);/)
  assert.match(rules, /resource\.data\.get\('status', 'published'\) == 'published'\)\s*&& resource\.data\.get\('artistRoleActive', true\) == true/)
  // Both fields default to visible when absent — no data migration/backfill needed for any
  // pre-existing document, and they're frozen from every other client write.
  assert.match(rules, /request\.resource\.data\.get\('roleActive', true\) == resource\.data\.get\('roleActive', true\)/)
  assert.match(rules, /request\.resource\.data\.get\('artistRoleActive', true\) == resource\.data\.get\('artistRoleActive', true\)/)

  // A dedicated trigger — not any of the existing role-changing callables/rules paths — is the
  // one and only thing that ever sets these fields, keeping them in sync with users/{uid}.roles
  // regardless of which of the several paths actually changed it (initial onboarding, self-service
  // add-role, or the admin-only step-back/reinstate rules path).
  const fn = read('functions/src/users.ts')
  assert.match(fn, /export const onUserRolesChange = onDocumentWritten\('users\/\{uid\}', async \(event\) => \{/)
  assert.match(fn, /const wasArtist = beforeRoles\.includes\('artist'\)/)
  assert.match(fn, /const isArtist = afterRoles\.includes\('artist'\)/)
  assert.match(fn, /if \(wasArtist !== isArtist\) \{/)
  assert.match(fn, /await artistRef\.update\(\{ roleActive: isArtist \}\)/)
  assert.match(fn, /const tracksSnap = await db\.collection\('tracks'\)\.where\('artistId', '==', uid\)\.get\(\)/)
  assert.match(fn, /batch\.update\(doc\.ref, \{ artistRoleActive: isArtist \}\)/)
  assert.match(fn, /if \(wasDj !== isDj\) \{/)
  assert.match(fn, /await djRef\.update\(\{ roleActive: isDj \}\)/)

  assert.match(read('functions/src/index.ts'), /export \{ onUserCreate, onUserRolesChange \} from '\.\/users\.js'/)
})

test('submitting a verification request notifies every admin, matching submitSupportMessage\'s established pattern (user-reported: "i just asked to be verified as the dj but as admin i did not get a notification")', () => {
  const fn = read('functions/src/admin/verification.ts')

  // Root cause: submitVerificationRequest wrote the verificationRequests doc (and, for a DJ,
  // flipped verificationStatus to 'pending') but never told anyone — an admin only found out
  // by remembering to check Admin -> Verification, exactly the bug already fixed once for
  // support messages.
  assert.match(fn, /const adminsSnap = await db\.collection\('users'\)\.where\('roles', 'array-contains', 'admin'\)\.get\(\)/)
  assert.match(fn, /for \(const adminDoc of adminsSnap\.docs\) \{/)
  assert.match(fn, /type: 'verification_request'/)
  assert.match(fn, /linkTo: '\/admin\/verification'/)
  // The request doc, the djProfiles status flip, and the admin notifications all commit
  // together — no window where a request exists but the flip or the notification is missing.
  assert.match(fn, /const batch = db\.batch\(\)/)
  assert.match(fn, /batch\.set\(requestRef,/)
  assert.match(fn, /batch\.update\(db\.collection\('djProfiles'\)\.doc\(uid\), \{ verificationStatus: 'pending' \}\)/)
  assert.match(fn, /await batch\.commit\(\)/)
})

test('verification is presented as functionally required, not cosmetic, before and during a DJ\'s request attempt (user-reported: "if verification is needed to see things that is important doesnt it make sense to make it clearer to users to actualy verify")', () => {
  // DJ's own profile page no longer frames verification as just a badge — it says plainly
  // that most artists default to rejecting unverified DJs' requests.
  const djProfilePage = read('src/pages/dj/DJProfilePage.tsx')
  assert.match(djProfilePage, /most artists only accept requests from verified DJs by default/)

  // The request modal itself warns an unverified DJ BEFORE they fill out the whole form and
  // hit a rejection, rather than only surfacing the problem after submission.
  const modal = read('src/components/track/RequestDjAccessModal.tsx')
  assert.match(modal, /import \{ getDJProfile \} from '@\/services\/djService'/)
  assert.match(modal, /setIsUnverified\(profile\?\.verificationStatus !== 'verified'\)/)
  assert.match(modal, /Your DJ account isn't verified yet\./)
  assert.match(modal, /to="\/dj\/profile"/)
})

test('the DJ profile page collects the evidence verification review actually uses (real name, website, venues), and the admin review page displays it (user-reported: "if the dj profile is used for verifcation this should be more detailed")', () => {
  // Root cause: AdminVerificationPage already read/displayed socialLinks and venues, but
  // DJProfilePage's own edit form never exposed inputs for them (or realName) — the schema
  // supported richer evidence, nothing let a DJ actually provide it.
  const djProfilePage = read('src/pages/dj/DJProfilePage.tsx')
  assert.match(djProfilePage, /realName: form\.realName\.trim\(\) \|\| null/)
  assert.match(djProfilePage, /const nextSocialLinks = \{ \.\.\.profile!\.socialLinks \}/)
  assert.match(djProfilePage, /venues: form\.venues\.split\(','\)\.map\(\(v\) => v\.trim\(\)\)\.filter\(Boolean\)/)
  assert.match(djProfilePage, /<Label>Real name<\/Label>/)
  assert.match(djProfilePage, /<Label>Website or press link<\/Label>/)
  assert.match(djProfilePage, /<Label>Notable venues \(comma separated\)<\/Label>/)

  // realName is admin-review evidence only — AdminVerificationPage is the one place that
  // reads it, never rendered on the public DJ profile.
  const adminPage = read('src/pages/admin/AdminVerificationPage.tsx')
  assert.match(adminPage, /realName: p\.realName/)
  assert.match(adminPage, /Real name: \{subject\.realName\}/)
  const publicDjPage = read('src/pages/dj/DJPublicProfilePage.tsx')
  assert.doesNotMatch(publicDjPage, /realName/)
})

test('the artist reviewing a DJ request can actually see who is asking, and both sides of a request link to each other\'s public profile (user-reported: "also can a artist see a dj profile")', () => {
  // Root cause: /djs/:djId was a public, unguarded route the whole time — the gap was that
  // nothing in the app actually linked an artist to it. The request list showed a track and
  // terms but never the requesting DJ's name, and the request detail page showed "DJ: {name}"
  // as plain text with no link either.
  const requestsPage = read('src/pages/artist/dashboard/DJRequestsPage.tsx')
  assert.match(requestsPage, /<Link to=\{`\/djs\/\$\{request\.djId\}`\} className="mt-0\.5 block w-fit text-xs font-medium text-brand-400 hover:underline">/)
  assert.match(requestsPage, /From \{request\.djNameSnapshot \?\? 'a DJ'\} — view profile/)

  const timelinePage = read('src/pages/agreements/RequestTimelinePage.tsx')
  assert.match(timelinePage, /<Link to=\{`\/djs\/\$\{licenceRequest\.djId\}`\} className="font-medium text-brand-400 hover:underline">/)
  // Symmetric fix: a DJ reviewing the same page could see the artist's name but not click
  // through to their profile either.
  assert.match(timelinePage, /<Link to=\{`\/artist\/\$\{artist\.slug\}`\} className="font-medium text-brand-400 hover:underline">/)
})

test('back buttons fall back to a real destination instead of silently doing nothing when a page is opened with no in-app history (user-reported: "the back btton does not work on this page https://backthevibes.com/djs/KGnqp8flPrQQ0DtyV5cuAfEre5f1")', () => {
  // Root cause: every back button called navigate(-1) directly. That's a no-op (or exits the
  // SPA) whenever the page was opened via a direct/shared link, a new tab, or after a service
  // worker reload — exactly how a DJ public profile link like this one is normally reached.
  const hook = read('src/hooks/useSmartBack.ts')
  assert.match(hook, /export function useSmartBack\(fallbackPath: string\)/)
  assert.match(hook, /if \(location\.key === 'default'\) \{/)
  assert.match(hook, /navigate\(fallbackPath\)/)
  assert.match(hook, /navigate\(-1\)/)

  // Every page that previously called navigate(-1) directly for its back button now routes
  // through the shared hook with a real fallback destination instead.
  const usages = [
    ['src/pages/track/TrackPage.tsx', "useSmartBack('/')"],
    ['src/pages/agreements/RequestTimelinePage.tsx', "useSmartBack('/agreements')"],
    ['src/pages/agreements/ContractPage.tsx', "useSmartBack('/agreements')"],
    ['src/pages/agreements/MyAgreementsPage.tsx', "useSmartBack('/app')"],
    ['src/pages/support/SupportPage.tsx', "useSmartBack('/app')"],
    ['src/pages/dj/DJPublicProfilePage.tsx', "useSmartBack('/')"],
    ['src/pages/legal/CopyrightClaimPage.tsx', "useSmartBack('/app')"],
    ['src/pages/artist/ArtistPublicProfilePage.tsx', "useSmartBack('/')"],
  ]
  for (const [path, expected] of usages) {
    const page = read(path)
    assert.ok(page.includes(expected), `${path} should call ${expected}`)
    assert.doesNotMatch(page, /onClick=\{\(\) => navigate\(-1\)\}/)
  }
})

test('a track with DJ requests enabled but no reusable deal assigned tells the artist why, with a direct link to fix it, instead of leaving them to discover it from the DJ side (user-reported: "dj can not see artist deal packages are live yet")', () => {
  // Root cause confirmed live: djDeals had zero documents and the one DJ-promoted track had
  // djDealSettings.acceptDjRequests true with allowedDealIds empty — the artist turned on
  // "Accept DJ requests" without ever creating a reusable deal in DJ Deals first, so DealsPanel
  // correctly rendered nothing but the generic "Custom deal" fallback. Not a query/rules bug —
  // DealsPanel, getDealsByIds, and the djDeals rules all already behave correctly for this case.
  const modal = read('src/components/licence/TrackDealSettingsModal.tsx')
  assert.match(modal, /No reusable deals yet, so DJs will only see "Custom deal — talk to the artist," not real terms\./)
  assert.match(modal, /<Link to="\/dashboard\/artist\/deals" className="font-medium text-brand-400 hover:underline">/)
  assert.match(modal, /Create a deal first →/)
})

test('creating a DJ deal shows a confirmation, which also reminds the artist it still needs assigning to a track (user-reported: "when the artist creats a deal there is no conformation")', () => {
  const page = read('src/pages/artist/dashboard/DjDealsPage.tsx')
  assert.match(page, /import \{ useToast \} from '@\/contexts\/ToastContext'/)
  assert.match(page, /const \{ notify \} = useToast\(\)/)
  assert.match(page, /notify\(`"\$\{form\.name\.trim\(\)\}" created — assign it to a track from Music to make it visible to DJs\.`\)/)
})

test('the DJ Deals list keeps flagging an active deal that isn\'t assigned to any track, not just at creation time (user-reported: "also i just put up a deal for the dj as a artist and the dj cant see it")', () => {
  // Root cause confirmed live: a real, active djDeals doc existed (artist did create one) but
  // the one DJ-promoted track's allowedDealIds was still empty — the deal was never actually
  // assigned. A one-time creation toast doesn't help once the artist has navigated away and
  // forgotten, so the list itself now keeps surfacing the same fact for as long as it's true.
  const page = read('src/pages/artist/dashboard/DjDealsPage.tsx')
  assert.match(page, /import \{ subscribeArtistTracks \} from '@\/services\/artistService'/)
  assert.match(page, /return subscribeArtistTracks\(firebaseUser\.uid, setTracks\)/)
  assert.match(page, /const assignedDealIds = new Set\(tracks\.flatMap\(\(t\) => t\.djDealSettings\?\.allowedDealIds \?\? \[\]\)\)/)
  assert.match(page, /\{deal\.active && !assignedDealIds\.has\(deal\.dealId\) \? \(/)
  assert.match(page, /Not assigned to any track yet — DJs can't see it\./)
  assert.match(page, /<Link to="\/dashboard\/artist\/music" className="underline hover:text-warning-400">/)
})

test('an artist can edit an uploaded track\'s metadata and re-upload artwork after the fact (user-reported: "but as a artist i am unable to edit the music i upload")', () => {
  // Root cause: MusicPage only ever offered fan-access settings, DJ-access settings, DJ-deal
  // settings, and delete — there was no path back to title/genre/description/credits/artwork
  // once a track was uploaded, and no service function to write them even existed.
  const service = read('src/services/trackService.ts')
  assert.match(service, /export async function updateTrackDetails\(trackId: string, input: TrackDetailsInput, artworkURL\?: string\): Promise<void>/)
  // Only ever the editable metadata fields — never audio/Storage paths, visibility, play
  // counts, or any other field firestore.rules freezes on update (confirmed none of title,
  // titleLower, genre, subgenre, bpm, mood, key, description, explicit, credits, artworkURL
  // appear in that frozen-fields list).
  assert.doesNotMatch(service.slice(service.indexOf('function updateTrackDetails'), service.indexOf('function uploadTrackArtwork')), /originalAudioPath|streamAudioPath|previewAudioPath|playCount|visibility:/)
  assert.match(service, /export async function uploadTrackArtwork\(artistId: string, trackId: string, file: File\): Promise<string>/)
  assert.match(service, /const artworkPath = `artists\/\$\{artistId\}\/artwork\/\$\{trackId\}\.\$\{extOf\(file\)\}`/)

  const modal = read('src/components/track/EditTrackModal.tsx')
  assert.match(modal, /import \{ updateTrackDetails, uploadTrackArtwork \} from '@\/services\/trackService'/)
  assert.match(modal, /const compressed = await compressImage\(artworkFile, 'artwork'\)/)
  assert.match(modal, /notify\('Track details saved\.'\)/)

  const musicPage = read('src/pages/artist/dashboard/MusicPage.tsx')
  assert.match(musicPage, /import \{ EditTrackModal \} from '@\/components\/track\/EditTrackModal'/)
  assert.match(musicPage, /const \[editTrack, setEditTrack\] = useState<TrackDoc \| null>\(null\)/)
  assert.match(musicPage, /onClick=\{\(\) => setEditTrack\(track\)\}/)
  assert.match(musicPage, /\{editTrack \? <EditTrackModal track=\{editTrack\} onClose=\{\(\) => setEditTrack\(null\)\} \/> : null\}/)
})

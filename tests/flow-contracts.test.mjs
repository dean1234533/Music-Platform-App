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
  const signUp = read('src/pages/auth/SignUpPage.tsx')
  const authContext = read('src/contexts/AuthContext.tsx')
  const users = read('src/services/userService.ts')
  assert.match(banner, /if \(!firebaseUser\) return null/)
  assert.match(signIn, /await ensureUserDocument\(user\)/)
  assert.match(signUp, /await ensureUserDocument\(credential\.user\)/)
  assert.match(authContext, /profileReadyUid !== firebaseUser\.uid/)
  assert.match(users, /getIdToken\(true\)/)
  assert.match(users, /permission-denied[\s\S]*?unavailable/)
})

test('browser tab uses the high-contrast BackTheVibes favicon', () => {
  const html = read('index.html')
  const favicon = read('public/icons/backthevibes-favicon.svg')
  assert.match(html, /rel="icon"[^>]+backthevibes-favicon\.svg\?v=3/)
  assert.match(html, /rel="shortcut icon"[^>]+backthevibes-favicon\.svg\?v=3/)
  assert.doesNotMatch(html, /href="\/backthevibes-mark\.svg"/)
  assert.match(favicon, /#C8F33F/)
  assert.match(favicon, /stroke-linecap="round"/)
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
  assert.match(page, /Deal accepted\. Your contract is ready to review and sign\./)
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
  assert.match(page, /notification\.linkTo/)
  assert.match(page, /navigate\(notification\.linkTo\)/)
  assert.doesNotMatch(read('functions/src/messaging/messages.ts'), /\/messages\/\$\{conversationId\}/)
})

test('DJ licensing has no chat page and ends in a signed downloadable contract', () => {
  const app = read('src/App.tsx')
  const requestBackend = read('functions/src/licensing/requests.ts')
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.doesNotMatch(app, /RequestDetailPage/)
  assert.match(app, /path="\/requests\/:requestId" element=\{<Navigate to="\/agreements" replace \/>\}/)
  assert.doesNotMatch(requestBackend, /tx\.set\(conversationRef/)
  assert.match(requestBackend, /status: agreementRef \? 'agreement_ready' : 'submitted'/)
  assert.match(requestBackend, /contentHash: computeContentHash\(agreementTerms\)/)
  assert.match(contract, /Sign agreement/)
  assert.match(contract, /createLicencePaymentSession/)
  assert.match(contract, /Download track/)
  assert.match(contract, /getSecureDownloadUrl/)
})

test('account deletion cancels billing and removes supporter state', () => {
  const source = read('functions/src/account/deleteAccount.ts')
  assert.match(source, /subscriptions\.cancel/)
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
  assert.match(page, /buildTimelineEvents/)
  assert.match(page, /NextActionBanner/)
  assert.match(page, /Your action required/)
  assert.match(page, /Waiting for the/)
  assert.doesNotMatch(page, /<textarea|sendMessage|conversationId/)
  assert.match(read('src/services/licenceService.ts'), /subscribeOffersForRequest/)
  assert.match(read('src/pages/dj/DJRequestsPage.tsx'), /\/dj-requests\/\$\{request\.requestId\}/)
  assert.match(read('src/pages/artist/dashboard/DJRequestsPage.tsx'), /\/dj-requests\/\$\{request\.requestId\}/)
})

test('the contract page states the DJ receives only the listed rights, not ownership', () => {
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /no ownership, resale,\s*\n\s*redistribution, remix, synchronisation, publishing, or master-recording rights/)
  assert.match(contract, /REQUIRES QUALIFIED MUSIC\/IP LEGAL\s*\n\s*REVIEW BEFORE PRODUCTION/)
})

test('player clears user-bound state on logout or account switch', () => {
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /previousUserId && previousUserId !== nextUserId/)
  assert.match(player, /setCurrentTrack\(null\)/)
  assert.match(player, /setQueue\(\[\]\)/)
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

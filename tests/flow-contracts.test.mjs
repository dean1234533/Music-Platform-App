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
  assert.match(page, /notification\.linkTo/)
  assert.match(page, /navigate\(notification\.linkTo\)/)
  assert.doesNotMatch(read('functions/src/messaging/messages.ts'), /\/messages\/\$\{conversationId\}/)
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
  assert.match(contract, /navigate\(-1\)/)
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

test('downloading the licensed track forces an actual download instead of opening an inline player (user-reported, screenshot)', () => {
  // Without responseDisposition: attachment, Storage serves the file with its real audio/*
  // content-type — the browser renders its native inline player instead of downloading, and
  // window.open('_blank') just moves that dead-end to a second tab with no way back. Forcing
  // the download at the server means the current page never navigates away at all.
  const downloads = read('functions/src/licensing/downloads.ts')
  assert.match(downloads, /responseDisposition: `attachment; filename="\$\{safeTitle\}\.\$\{extension\}"`/)
  const contract = read('src/pages/agreements/ContractPage.tsx')
  const handleDownloadBody = contract.slice(contract.indexOf('async function handleDownload'), contract.indexOf('async function handleDownload') + 800)
  assert.match(handleDownloadBody, /window\.location\.href = url/)
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

test('a signed party always shows something that reads as an actual signature (user-reported)', () => {
  // A typed signature never has a drawn image at all, and a drawn one can genuinely fail to
  // load — either way, the contract previously showed nothing but the plain legal name next to
  // a "Signed" label once that happened, which doesn't read as a signed legal document.
  const contract = read('src/pages/agreements/ContractPage.tsx')
  assert.match(contract, /fontFamily: "'Caveat', cursive"/)
  assert.match(contract, /\{signedAt \? \(/)
  const html = read('index.html')
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Caveat/)
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

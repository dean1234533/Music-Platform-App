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
  assert.match(banner, /if \(!firebaseUser\) return null/)
  assert.match(signIn, /await ensureUserDocument\(user\)/)
  // Email signup itself has no ensureUserDocument call — AuthContext's own onAuthStateChanged
  // listener calls it for every signed-in user regardless of entry point, so this isn't a gap.
  assert.match(authContext, /await ensureUserDocument\(user\)/)
  assert.match(authContext, /profileReadyUid !== firebaseUser\.uid/)
  assert.match(users, /getIdToken\(true\)/)
  assert.match(users, /permission-denied[\s\S]*?unavailable/)
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
  assert.match(contract, /downloadLicensedTrack/)
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

  const artistService = read('src/services/artistService.ts')
  assert.match(artistService, /if \(!RESERVED_ARTIST_SLUGS\.has\(candidate\)\) \{/)
  // A reserved word falls through to the same numbered-suffix path as a
  // taken slug — never a hard rejection of the whole signup.
  assert.match(artistService, /candidate = `\$\{baseSlug\}-\$\{attempt \+ 1\}`/)
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
  assert.match(trackPage, /disabled=\{streamingRestricted\}/)
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

test('signed-in users can send a support message, and it lands somewhere an admin can actually see and resolve it', () => {
  const fn = read('functions/src/support.ts')
  assert.match(fn, /export const submitSupportMessage = onCall/)
  assert.match(fn, /export const resolveSupportMessage = onCall/)
  assert.match(fn, /await requireActiveUser\(request\.auth\.uid\)/)
  assert.match(fn, /enforceRateLimit\(`submitSupportMessage_\$\{request\.auth\.uid\}`, 5, 3600\)/)
  assert.match(fn, /const adminId = await requireAdmin\(request\)/)
  assert.match(fn, /writeAuditLog\(adminId, 'resolve_support_message'/)

  const rules = read('firestore.rules')
  assert.match(rules, /match \/supportMessages\/\{docId\} \{/)
  assert.match(rules, /resource\.data\.userId == request\.auth\.uid \|\| isAdmin\(\)/)

  const page = read('src/pages/support/SupportPage.tsx')
  assert.match(page, /submitSupportMessage\(\{ subject: subject\.trim\(\), message: message\.trim\(\) \}\)/)

  const admin = read('src/pages/admin/AdminReportsPage.tsx')
  assert.match(admin, /listOpenSupportMessages\(\)\.then\(setSupportMessages\)/)
  assert.match(admin, /resolveSupportMessage\(\{ supportMessageId: id \}\)/)

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
  assert.match(fn, /const allowed = kind === 'preview' \? await canPreviewTrack\(uid, track\) : await canStreamFullTrack\(uid, track\)/)

  // Analytics stay honest: preview and full-stream plays are separate
  // counters, further broken down by DJ-preview and supporter-tier plays —
  // never summed into one inflated "plays" figure.
  assert.match(fn, /export const recordTrackPlay = onCall/)
  assert.match(fn, /update\.playCount = FieldValue\.increment\(1\)/)
  assert.match(fn, /update\.fullPlayCount = FieldValue\.increment\(1\)/)
  assert.match(fn, /if \(track\.visibility === 'dj_only'\) update\.djPreviewCount = FieldValue\.increment\(1\)/)
  assert.match(fn, /if \(track\.visibility === 'supporters'\) update\.supporterPlayCount = FieldValue\.increment\(1\)/)

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
  assert.match(tracksFn, /if \(kind === 'preview' && uid && uid !== track\.artistId\) \{/)
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

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

test('notifications use Firestore IDs and navigate their deep links', () => {
  assert.match(read('src/services/notificationService.ts'), /notificationId: d\.id/)
  const page = read('src/pages/fan/NotificationsPage.tsx')
  assert.match(page, /notification\.linkTo/)
  assert.match(page, /navigate\(notification\.linkTo\)/)
  assert.doesNotMatch(read('functions/src/messaging/messages.ts'), /\/messages\/\$\{conversationId\}/)
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

test('player clears user-bound state on logout or account switch', () => {
  const player = read('src/contexts/PlayerContext.tsx')
  assert.match(player, /previousUserId && previousUserId !== nextUserId/)
  assert.match(player, /setCurrentTrack\(null\)/)
  assert.match(player, /setQueue\(\[\]\)/)
})

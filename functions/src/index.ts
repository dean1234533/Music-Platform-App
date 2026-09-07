export { onUserCreate } from './users.js'
export { onFollowCreate, onFollowDelete } from './follows.js'
export { recordPreviewPlay } from './tracks.js'
export { onNotificationCreatePush } from './notifications/pushTrigger.js'

// Phase 2 — platform subscriptions, fan support allocation, revenue.
export { createCheckoutSession } from './stripe/checkout.js'
export { createBillingPortalSession } from './stripe/portal.js'
export { stripeWebhook } from './stripe/webhook.js'
export { updateSupportAllocations } from './support/allocations.js'
export { onSupportRelationshipCreate, onSupportRelationshipDelete } from './support/triggers.js'

// Phase 3 — DJ discovery, licence requests, messaging.
export { submitLicenceRequest, respondToLicenceRequest } from './licensing/requests.js'
export { sendMessage } from './messaging/messages.js'

// Phase 4 — digital agreements, DJ licence payments, secure downloads.
export { proposeAgreement, signAgreement } from './licensing/agreements.js'
export { createLicencePaymentSession } from './stripe/licencePayment.js'
export { getSecureDownloadUrl } from './licensing/downloads.js'

// Phase 5 — Stripe Connect payouts, verification, moderation, admin.
export { createConnectOnboardingLink, createConnectDashboardLink } from './stripe/connect.js'
export { stripeConnectWebhook } from './stripe/connectWebhook.js'
export { requestPayout } from './payouts/requestPayout.js'
export { promotePendingBalances } from './payouts/promoteBalances.js'
export { submitVerificationRequest, reviewVerificationRequest } from './admin/verification.js'
export { submitCopyrightClaim, reviewCopyrightClaim } from './admin/copyright.js'
export { adminSetUserSuspension, adminSetTrackTakedown } from './admin/moderation.js'
export { blockSuspendedSignIn } from './admin/enforceSuspension.js'
export { submitReport, adminResolveReport } from './admin/reports.js'
export { adminUpsertSubscriptionPlan, adminUpdatePlatformSettings } from './admin/settings.js'

// Free creator workflows and fan supporter subscriptions.
export { onTrackCreate, onTrackDelete } from './tracks/triggers.js'
export { adminSeedSubscriptionPlans } from './admin/seedPlans.js'
export { sendBulkDjOutreach } from './messaging/bulkOutreach.js'

export { onUserCreate, onUserRolesChange } from './users.js'
export { createArtistProfile, createDJProfile } from './profiles.js'
export { onFollowCreate, onFollowDelete } from './follows.js'
export { recordTrackPlay, getTrackPlaybackUrl, deleteTrack } from './tracks.js'
export { recordProfileView, recordTrackView } from './analytics.js'
export { onNotificationCreatePush } from './notifications/pushTrigger.js'
export { onFanOfferCreate, onFanOfferDelete } from './fanOffers.js'

// Phase 2 — platform subscriptions, fan support allocation, revenue.
export { createCheckoutSession } from './stripe/checkout.js'
export { createBillingPortalSession } from './stripe/portal.js'
export { stripeWebhook } from './stripe/webhook.js'
export { updateSupportAllocations } from './support/allocations.js'
export { onSupportRelationshipCreate, onSupportRelationshipDelete } from './support/triggers.js'

// Phase 3 — DJ discovery, licence requests, negotiation (structured offers/counter-offers — no general chat).
export { submitLicenceRequest, respondToLicenceRequest, acceptExistingDeal, dismissLicenceRequest } from './licensing/requests.js'
export { sendOffer, counterOffer, acceptOffer, rejectOffer, withdrawOffer } from './licensing/offers.js'

// Phase 4 — digital agreements, DJ licence payments, secure downloads.
export { proposeAgreement, signAgreement, voidAgreement, getSignatureImageUrls } from './licensing/agreements.js'
export { createLicencePaymentSession } from './stripe/licencePayment.js'
export { downloadLicensedTrack } from './licensing/downloads.js'

// Phase 5 — Stripe Connect payouts, verification, moderation, admin.
export { createConnectOnboardingLink, createConnectDashboardLink } from './stripe/connect.js'
export { stripeConnectWebhook } from './stripe/connectWebhook.js'
export { requestPayout } from './payouts/requestPayout.js'
export { promotePendingBalances } from './payouts/promoteBalances.js'
export { submitVerificationRequest, reviewVerificationRequest } from './admin/verification.js'
export { submitCopyrightClaim, reviewCopyrightClaim, submitArtistResponse, submitCounterNotice, getCopyrightEvidenceUrls } from './admin/copyright.js'
export { adminSetUserSuspension, adminSetTrackTakedown, adminDeleteStory } from './admin/moderation.js'
export { submitReport, adminResolveReport } from './admin/reports.js'
export { adminChangeArtistSlug } from './admin/artistSlug.js'
export { submitSupportMessage, resolveSupportMessage } from './support.js'
export { adminUpsertSubscriptionPlan, adminUpdatePlatformSettings } from './admin/settings.js'

// Free creator workflows and fan supporter subscriptions.
export { onTrackCreate, onTrackDelete } from './tracks/triggers.js'
export { adminSeedSubscriptionPlans } from './admin/seedPlans.js'
export { sendBulkDjOutreach } from './messaging/bulkOutreach.js'

// Media compression, sharing, and copyright protection.
export { recordRightsDeclaration, recordLegalAcceptance } from './legal/acceptances.js'
export { onOriginalUploaded } from './tracks/onOriginalUploaded.js'

// Artist Stories.
export { createStory, toggleStoryHighlight, getStoryMediaUrl } from './stories/stories.js'
export { onStoryViewCreate, onStoryReactionCreate, onStoryReactionDelete, onStoryPollVoteCreate } from './stories/triggers.js'

// Account security, deletion, data export, and retention/cleanup.
export { deleteAccount, adminDeleteAccount } from './account/deleteAccount.js'
export { exportUserData } from './account/exportUserData.js'
export { adminUpdateDataRetentionSettings, adminSetLegalHold } from './admin/retentionSettings.js'
export { adminEnableStrongPasswordPolicy } from './admin/passwordPolicy.js'
export { adminCreateSecurityIncident, adminUpdateSecurityIncident } from './admin/securityIncidents.js'
export {
  expireStories,
  cleanupOldNotifications,
  cleanupAbandonedRequests,
  cleanupExpiredDraftOffers,
  cleanupInactiveChats,
  expireStaleNegotiations,
  expireActiveContracts,
  cleanupExpiredContracts,
  cleanupResolvedCopyrightClaims,
  cleanupOldAuditLogs,
  cleanupOldRateLimits,
  cleanupOrphanedUploads,
} from './retention/cleanup.js'

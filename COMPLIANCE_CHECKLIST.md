# Compliance checklist

Companion to `SECURITY_AUDIT.md`. This tracks technical support for UK GDPR
and related obligations against what the code actually does today — not
what a policy document claims. Every item is marked with what's actually
implemented versus what needs a human (legal, DPO, or a manual test) to
close out.

**MANUAL / LEGAL REVIEW REQUIRED** marks anything this document cannot
verify from code alone — a legal judgment, a business decision, or a
console setting outside this repository.

## UK GDPR — core principles

| Principle | Technical support | Status |
|---|---|---|
| **Lawful basis** | Not something code can establish — depends on the actual relationship with each data category (contract performance for account data, legitimate interest or consent for others). | **MANUAL / LEGAL REVIEW REQUIRED** |
| **Purpose limitation** | Each collection's fields map to a specific product function (see `docs/FIRESTORE_SCHEMA.md`); no field was found collecting data "because it might be useful later." | Implemented, spot-checked in this audit |
| **Data minimisation** | IP address and user-agent are recorded only on e-signature acceptance (`licenceAgreementAcceptances`) — the one place the audit brief explicitly allows it for evidentiary purposes. Analytics/tracking: none found (no analytics SDK, no tracking pixels, no third-party embeds anywhere in `src/`). | Implemented |
| **Storage limitation (retention)** | `platformSettings/dataRetention` + eight scheduled Cloud Functions (`functions/src/retention/cleanup.ts`) enforce configured periods for notifications, stale Stories, abandoned DJ requests, unsigned draft offers, inactive chats, ended contracts, resolved copyright claims, and audit logs. Retention periods are admin-configurable and rendered live on `/privacy`. | Implemented; **periods themselves are suggested defaults — MANUAL / LEGAL REVIEW REQUIRED before production** |
| **Integrity and confidentiality (security)** | See `SECURITY_AUDIT.md` in full. | Implemented, with the gaps listed there |
| **Accountability** | `auditLogs` records every admin action; `securityIncidents` is a breach register (see `SECURITY_INCIDENT_RESPONSE.md`). | Implemented |

## Access control

| Requirement | Technical support | Status |
|---|---|---|
| Users can't self-grant admin/verified/etc. | `firestore.rules` pins `roles.hasOnly(['fan','artist','dj'])`; no Cloud Function writes `'admin'` anywhere. | Verified in this audit |
| Sensitive fields are server-only | Every field named in the audit brief (`subscriptionStatus`, balances, `paidAt`, `legalHold`, signatures, `takenDown`, etc.) lives in a collection with `allow write: if false`, or is explicitly pinned in an `update` rule. | Verified in this audit |
| Every sensitive action checks ownership server-side | No IDOR found in any licensing/payment/messaging/admin callable — see `SECURITY_AUDIT.md` §4. | Verified in this audit |
| Admin actions are audited | `writeAuditLog` on every `requireAdmin`-gated callable. | Implemented |
| Strong admin authentication (MFA) | Not implemented. | **MANUAL / PRODUCT DECISION REQUIRED BEFORE PRODUCTION** — see audit §2 item 12 |

## Data deletion

| Requirement | Technical support | Status |
|---|---|---|
| User-initiated account deletion | Settings → Account → Delete Account (reauthentication + type-DELETE confirmation) → `deleteAccount` Cloud Function. | Implemented |
| Deletes Auth user + Firestore + Storage | `deleteAccount` removes the Firebase Auth user, `users` doc, artist/DJ profiles, owned tracks (or unpublishes+retains if under an active licence), Stories + their media, playlists, crates, follows, likes, notifications, DJ deal templates, profile/artwork Storage folders. | Implemented |
| Doesn't destroy the other party's licence evidence | `licenceAgreements`/`licenceOffers`/`licenceRequests`/`conversations`/`downloadLogs`/`transactions` are deliberately left untouched by account deletion — they carry their own retention schedule instead (see `cleanupExpiredContracts` etc.). | Implemented |
| Idempotent / safe to retry | Every delete step is a no-op on an already-deleted doc/file; `accountDeletions/{uid}` tracks `processing`/`completed`/`failed`/`retained_limited_data` status so a partial failure can be retried safely. | Implemented |
| User sees deletion status, not raw errors | "Your account deletion is being processed," then sign-out. | Implemented |

## Data export / access requests

| Requirement | Technical support | Status |
|---|---|---|
| User can download their own data | Settings → Privacy → Download my data → `exportUserData` Cloud Function, a signed URL (24h TTL) to a JSON export of the user's own profile, tracks, agreements, requests, downloads, notifications, legal acceptances. | Implemented |
| Export excludes other users' private data, Stripe secrets, moderation notes | Verified by inspecting `exportUserData.ts` — it only queries documents keyed by the caller's own uid. | Implemented |
| Broader subject-access-request tooling (beyond self-service export) | Not built — the self-service export may satisfy most requests, but a manual SAR process for edge cases (e.g. a request from someone without an account) isn't defined. | **MANUAL / LEGAL REVIEW REQUIRED** |

## Consent

| Requirement | Technical support | Status |
|---|---|---|
| Terms/Privacy acceptance tracked, versioned, append-only | `legalAcceptances/{uid}_{docType}_{version}` — `firestore.rules` makes it create-only, never editable. | Implemented |
| No pre-ticked optional consent | No marketing-consent or optional-analytics checkbox exists anywhere in the signup/onboarding flow (verified by reading `SignUpPage.tsx`, `OnboardingPage.tsx`) — there is nothing bundled into a single "I agree to everything," because there is currently no separate optional-consent category to bundle. If a marketing/analytics feature is added later, it must get its own unticked checkbox, not be folded into ToS acceptance. | Implemented (nothing to violate this today) |
| Cookie/tracking consent banner | Not present, and none is needed today — no analytics, advertising, or tracking cookies were found anywhere in the codebase (see `SECURITY_AUDIT.md` §4). Firebase Auth's own session persistence and the service worker's cache are strictly-necessary storage, not consent-gated categories under PECR. | Verified in this audit — reassess if analytics/ads are added |

## Copyright workflow

| Requirement | Technical support | Status |
|---|---|---|
| Claim evidence restricted to claimant/artist/admin | `storage.rules` `copyrightEvidence` read rule; write rule fixed this session to also require reporter ownership (see audit §2 item 5). | Implemented |
| Claimant personal data not retained indefinitely | `cleanupResolvedCopyrightClaims` anonymises claimant name/email/company/description/evidence-links on claims resolved more than `copyrightClaimYears` ago (admin-configurable, default 6 years). | Implemented |
| Claimant contact info not publicly exposed | `copyrightClaims` collection has no public-read rule anywhere. | Verified in this audit |
| Counter-notice / appeal path | `submitCounterNotice` exists for an artist whose track was removed/restricted. | Implemented |
| Formal DMCA-equivalent process correctness | The claim/counter-notice flow is a product feature, not a certified legal process. | **MANUAL / LEGAL REVIEW REQUIRED** |

## Contracts / e-signatures

| Requirement | Technical support | Status |
|---|---|---|
| Signature can't be forged client-side | `licenceAgreements` is `allow write: if false`; only `signAgreement` (a Cloud Function) can set `artistAcceptedAt`/`djAcceptedAt`. | Implemented |
| Terms frozen once generated, immutable after signing | `writeAgreementVersion` edits in place only while unsigned; once either party has signed, any change supersedes and creates a new version. | Implemented |
| Content integrity verifiable | SHA-256 `contentHash` computed at generation, re-verified at signing time (added this session — see audit §2 item 17). | Implemented |
| Signature record captures identity, role, method, timestamp | `licenceAgreementAcceptances`: `signerUserId`(`userId`), `role`, `legalName`, `signatureType`, `signatureReference`, `agreementVersion`, `agreementContentHash`, `ipAddress`, `userAgent`, `acceptedAt` (server timestamp). | Implemented |
| Records retained for an appropriate period, then deleted | `cleanupExpiredContracts` removes ended agreements (and their acceptance/download logs) `contractYears` after they end (default 6 years), skipping anything under `legalHold`. | Implemented |
| Final legal wording of the e-signature disclosure | The in-app copy ("this is a statement made under penalty of submitting false information, not a cryptographic signature") is plain-English, not vetted legal wording for enforceability in a given jurisdiction. | **MANUAL / LEGAL REVIEW REQUIRED** |

## Financial records

| Requirement | Technical support | Status |
|---|---|---|
| Transaction records kept for accounting/tax purposes | `transactions` collection, `allow write: if false`, populated only by Stripe-webhook-verified Cloud Functions. | Implemented |
| Retention period for financial records | Tied to the same `contractYears` (default 6) via `cleanupExpiredContracts` for licence-related transactions; general subscription-income transactions are not currently swept by a dedicated job — noted as a gap. | **Partial — follow-up needed** |
| No card data stored | Confirmed — only Stripe customer/subscription/payment-intent/transfer IDs are stored; no PAN, CVC, or full card data anywhere in Firestore. | Verified in this audit |
| Refund handling reconciles financial records | Implemented for DJ-licence payments (this session); **not** implemented for subscription income — see `SECURITY_AUDIT.md` §2 item 1. | **Partial — follow-up needed** |

## Breach response

| Requirement | Technical support | Status |
|---|---|---|
| Documented internal response workflow | `SECURITY_INCIDENT_RESPONSE.md` (this session). | Implemented |
| Breach register | `securityIncidents` collection + `adminCreateSecurityIncident`/`adminUpdateSecurityIncident` callables + an admin dashboard page (this session). | Implemented |
| Notification-obligation assessment (ICO / affected users) | Explicitly left as a human legal/DPO decision in the incident response doc — the code does not and should not auto-notify anyone. | **MANUAL / LEGAL REVIEW REQUIRED, per-incident** |

## Processor relationships

| Processor | What it receives | Status |
|---|---|---|
| Stripe | Payment/subscription data, customer IDs, bank/Connect account details for payouts. | Standard Stripe DPA applies — **confirm a Stripe data-processing agreement is in place, MANUAL REVIEW** |
| Firebase / Google Cloud | All application data (Auth, Firestore, Storage, Functions hosting). | **Confirm a Google Cloud / Firebase data-processing terms acceptance is in place, MANUAL REVIEW** |
| Cloudflare | Edge delivery of the static app and the OG-unfurling Worker; sees request metadata (IPs) for all traffic. | **Confirm a Cloudflare DPA is in place, MANUAL REVIEW** |
| Privacy Policy accuracy | `/privacy` lists these categories in its "Who receives information" section; verify it names the actual processors as used above, not generic language. | **MANUAL / LEGAL REVIEW REQUIRED** |

## Overall

Nothing in this checklist should be read as "compliant" on its own — it is
a map of what the code technically supports, so that a legal/DPO review has
an accurate starting point instead of guessing at what's implemented. Every
row marked **MANUAL / LEGAL REVIEW REQUIRED** is a real gap between "the
code could support this" and "someone qualified has actually signed off on
it," and none of them should be treated as closed until that review happens.

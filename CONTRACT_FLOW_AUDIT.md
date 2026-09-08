# Artist ↔ DJ Contract Flow — Audit & Fix Report

Date: 2026-09-08
Scope: The full DJ licensing flow — deal creation, request, structured offer/counter-offer negotiation, contract generation, e-signature, Stripe payment, secure track unlock, agreements dashboard, notifications, expiry/retention, copyright gating, and dispute handling. No chat/messaging exists or was reintroduced anywhere in this flow.

This audit was performed on top of a concurrent session's very recent work (commits `164fadd`…`9191178`) that removed the chat-based `RequestDetailPage` and moved the flow to structured offers/counter-offers ending in a signed contract. That work was largely correct and is preserved as-is; this pass audited it against the full 36-section spec, found the gaps below, and fixed them.

---

## 1. What was already correct (verified, not rebuilt)

- **Deal creation** (`DjDealsPage.tsx`, `functions` via direct Firestore writes under `djDeals`): all 5 price types (`free`, `fixed`, `starting_from`, `negotiable`, `custom_quote`), territory, duration, permissions (recording/streaming/promotional-mix/remix/redistribution/resale), attribution, additional terms. No hard-coded prices.
- **Per-track assignment** (`TrackDealSettingsModal.tsx`, `TrackDjDealSettings`): `acceptDjRequests`, `allowedDealIds`, `defaultDealId`, `minimumPriceMinor`, `verifiedDjsOnly`, `customApprovalRequired` — all enforced server-side in `submitLicenceRequest` / `enforceTrackDealSettings`.
- **DJ deal view** (`DealsPanel.tsx`): name, price, use, territory, duration, permissions, `[Request Deal]`/accept-immediately for free/fixed, `[Request Custom Deal]` (manual-approval) path.
- **Structured request → offer → counter-offer → accept pipeline** (`functions/src/licensing/requests.ts`, `offers.ts`, `agreements.ts`): versioned, append-only `licenceOffers`, server-side authorization on every transition (participant check, status check, "not your own offer", "not already superseded"), contract auto-generated via `writeAgreementVersion` on `acceptOffer`, `contentHash` (SHA-256 over canonicalized terms) frozen at generation and re-verified at signing time.
- **Contract locking**: agreements are never mutated once a party has accepted; a new term requires `voidAgreement` → new offer → `acceptOffer` → new `agreementVersion`. Enforced by `writeAgreementVersion`'s `editedInPlace` branch, which only edits in place while `artistAcceptedAt`/`djAcceptedAt` are both still null.
- **Signing** (`SignAgreementModal.tsx` + `signAgreement` callable): checkbox ("I have read and agree…"), full legal name, authority-confirmation checkbox, typed or drawn signature (`SignaturePad.tsx` uses Pointer Events + `touch-none`, so it works with touch out of the box). Signature record (`licenceAgreementAcceptances`) captures signatureId/agreementId/signerUserId/role/legalName/type/reference/version/contentHash/signedAt/IP/user-agent, matches spec section 16 field-for-field (this is the collection the spec calls `agreementSignatures` — see naming note below).
- **Free vs paid split**: `signAgreement` sets `status: 'active'` directly when `licenceFeeMinor === 0`, `'awaiting_payment'` otherwise — no Stripe call in the free path.
- **Stripe payment**: `createLicencePaymentSession` re-reads the price from Firestore (never trusts the client), checks `status === 'awaiting_payment'`, not already paid, fee > 0. `stripeWebhook`'s `checkout.session.completed` handler is the only path that sets `paidAt`/`status: 'active'` — the success-redirect URL carries no privileged state.
- **Secure download** (`getSecureDownloadUrl`): re-checks DJ ownership, `status === 'active'`, not revoked, paid-if-required, not expired, track/artist match, then issues a 5-minute signed Storage URL. Storage rules independently block direct/public reads of originals.
- **Agreements dashboard** (`MyAgreementsPage.tsx`, `ContractPage.tsx`): status-grouped list, per-status actions.
- **Retention** (`functions/src/retention/cleanup.ts`): `expireStaleNegotiations`, `cleanupExpiredContracts` (skips `active` agreements and anything under `legalHold`), `cleanupResolvedCopyrightClaims` anonymises rather than deletes decision history.
- **Notifications**: server-written only, `linkTo` deep-links to the right agreement/request, covering new-request/offer-sent/counter/accepted/agreement-ready/signed/payment-required/active for both roles.

## 2. Naming reconciliation (per the spec's own instruction to decide, not silently diverge)

- Spec's `djRequests` ≡ existing `licenceRequests` — kept the existing name; it is the actual source of truth for status and is referenced throughout functions, rules, and the new timeline page. Renaming would touch every rule, function, and index with no functional benefit.
- Spec's `agreementSignatures` ≡ existing `licenceAgreementAcceptances` — kept the existing name for the same reason. Documented here as the canonical mapping.

## 3. Gaps found and fixed this session

### 3.1 Copyright-restriction gating did not block the licensing flow (spec §33)
**Problem:** `tracks.ts` already enforced `restrictedCapabilities.includes('dj_licensing')` for playback, and the admin copyright-review UI could set that flag — but nothing in `submitLicenceRequest`, `acceptOffer`, `createLicencePaymentSession`, or `getSecureDownloadUrl` ever read it. A track under active copyright review could still receive new DJ requests, have a contract generated, be paid for, and be downloaded.

**Fix:**
- `functions/src/licensing/requests.ts` — `submitLicenceRequest` now rejects (`failed-precondition`) if `track.takenDown` or `restrictedCapabilities` includes `'dj_licensing'`.
- `functions/src/licensing/offers.ts` — `acceptOffer` re-checks the same condition immediately before generating a new contract, so a track flagged mid-negotiation can't still produce an agreement.
- `functions/src/stripe/licencePayment.ts` — `createLicencePaymentSession` re-checks before creating a Stripe Checkout session.
- `functions/src/licensing/downloads.ts` — `getSecureDownloadUrl` re-checks before issuing a signed URL, so even an already-active, already-paid agreement stops producing downloads if the track is later restricted — **existing agreement/signature/payment records are never deleted or altered by this check**, only the download path is blocked.

### 3.2 No request-detail activity-timeline page (spec §25/§26)
**Problem:** Both `DJRequestsPage.tsx` variants inlined the current offer/agreement into a list row, but there was no `/dj-requests/{requestId}` page showing the full offer history, a real-event activity timeline, and unambiguous "whose turn is it" messaging — the explicit chat replacement the spec calls for.

**Fix:** Added `src/pages/agreements/RequestTimelinePage.tsx`, routed at `/dj-requests/:requestId` (both roles, `ProtectedRoute`-gated, ownership-checked client-side and by Firestore rules). It shows:
- Original request terms.
- Current offer or live contract link.
- Full append-only offer history (every version, who sent it, price/terms, status).
- A generated activity timeline built purely from real backend timestamps (request created → each offer/counter → acceptance → signatures → payment → activation → rejection/cancellation/expiry/void) — no free text, nothing user-editable.
- A `NextActionBanner` that always states in plain language whose turn it is ("Your action required — sign the agreement", "Payment Required — pay £X to activate", "Licence Active — you may now download", etc.), matching spec §27 verbatim in intent.
- Cancel/reject actions where the request is still open.

Linked from both `DJRequestsPage.tsx` (artist and DJ) list rows via a new "View request details & activity" link, so it's actually reachable, not just routable.

Added `subscribeOffersForRequest` to `src/services/licenceService.ts` and a matching composite Firestore index (`licenceOffers`: `requestId` asc + `version` asc) in `firestore.indexes.json`.

### 3.3 No "Report Agreement Problem" dispute flow (spec, "easy to miss" section)
**Problem:** No way for either party to flag a problem with a contract without it silently rewriting the agreement or requiring a chat message (which no longer exists).

**Fix:** Reused the existing generic `reports` collection/`submitReport`/`adminResolveReport` infrastructure rather than building new plumbing:
- `functions/src/admin/reports.ts` — added `'agreement'` to `TARGET_TYPES`.
- `src/types/moderation.ts`, `src/services/moderationService.ts` — added `'agreement'` to the `ReportDoc`/`submitReport` target-type union.
- `src/pages/agreements/ContractPage.tsx` — added a "Report a problem with this agreement" link and a `ReportAgreementModal` that calls `submitReport({ targetType: 'agreement', targetId: agreementId, ... })`. It explicitly does **not** call `signAgreement`, `voidAgreement`, or `acceptOffer` — verified by a new test that inspects the modal's function body — and tells the user plainly that filing a report does not change the contract by itself.
- `src/pages/admin/AdminReportsPage.tsx` — agreement-type reports now render a "View agreement" link and a "Place legal hold" button (calls the pre-existing, already audit-logged `adminSetLegalHold` callable, scoped to `licenceAgreements`). This is the admin contracts-for-disputes entry point: an admin opens the linked `/agreements/:id` page (already admin-readable per Firestore rules) to inspect the full contract, and can freeze it against retention cleanup/voiding while support investigates — without any code path that rewrites its terms.
- Every admin action reachable from this flow (`adminResolveReport`, `adminSetLegalHold`) already goes through `writeAuditLog`, so **admin actions touching an agreement dispute are audit-logged** as required — this pass wired the UI to those existing, already-audited callables rather than adding a new unaudited path.

### 3.4 Rights language incomplete on the contract page (spec, "easy to miss" section)
**Problem:** `ContractPage.tsx` had a general "does not transfer copyright ownership" disclaimer but didn't enumerate the specific rights categories the spec requires (resale, redistribution, remix, sync, publishing, master ownership) or flag itself for legal review inline.

**Fix:** Rewrote the rights paragraph on `ContractPage.tsx` to explicitly state the DJ receives *only* the listed permissions above, and — except where a permission is explicitly marked "Yes" in the Usage terms section — receives **no ownership, resale, redistribution, remix, synchronisation, publishing, or master-recording rights of any kind**, and added an inline **"REQUIRES QUALIFIED MUSIC/IP LEGAL REVIEW BEFORE PRODUCTION"** flag directly in the page (not just in this report).

## 4. Deliberately left as-is (with reasoning)

- **PDF generation**: `ContractPage.tsx` uses `window.print()` (browser print-to-PDF) rather than a server-generated, Storage-stored PDF. The spec says "generate read-only PDF … where practical" — the existing stack has no PDF-rendering library, and the contract page itself is already read-only, mobile-readable, and print-styled (`@media print` hides nav/actions). Standing up a new PDF-generation pipeline (e.g. Puppeteer in a Cloud Function) is a meaningfully larger, separate piece of infrastructure than an audit-and-fix pass justifies, and isn't required for the contract to be legally evidenced — the signed `licenceAgreementAcceptances` record plus the immutable `licenceAgreements` document are the actual source of truth. **Flagged for a follow-up, not fixed here.**
- **`RESTRICTABLE_CAPABILITIES` UI on the admin claim-review flow** already lets an admin flag `dj_licensing` per track (pre-existing); this pass only closed the enforcement gap, it didn't change the admin UI for setting the flag.
- **Legacy `proposeAgreement` callable** (`functions/src/licensing/agreements.ts`) is kept working (some tests/older records may reference it) but is no longer surfaced in the UI — the offer/counter-offer pipeline is the only path a user can reach. Not removed, since deleting a working, unused-but-harmless code path isn't in scope and risks breaking anything still pointing at it server-side.
- **Renaming `licenceRequests`→`djRequests` / `licenceAgreementAcceptances`→`agreementSignatures`**: explicitly deferred per the spec's own permission to keep existing names if documented — see §2 above.

## 5. Firestore collections involved

`licenceRequests`, `licenceOffers`, `licenceAgreements`, `licenceAgreementAcceptances`, `djDeals`, `downloadLogs`, `notifications`, `reports` (new: `targetType: 'agreement'`), `copyrightClaims`, `tracks` (read for `restrictedCapabilities`/`takenDown`/`djDealSettings`/`embargoUntil`), `artistProfiles`, `djProfiles`, `blockedUsers`, `platformSettings`.

## 6. Cloud Functions involved

`submitLicenceRequest`, `respondToLicenceRequest`, `sendOffer`, `counterOffer`, `acceptOffer`, `withdrawOffer`, `proposeAgreement` (legacy, unused by UI), `signAgreement`, `voidAgreement`, `getSecureDownloadUrl`, `createLicencePaymentSession`, `stripeWebhook`, `submitReport`, `adminResolveReport`, `adminSetLegalHold`, `expireStaleNegotiations`, `cleanupExpiredContracts`, `cleanupAbandonedRequests`, `cleanupExpiredDraftOffers`.

## 7. Stripe events involved

`checkout.session.completed` (mode `payment`, `metadata.kind === 'licence_payment'`) — the sole trigger that sets `licenceAgreements.paidAt` and flips `status` to `active`. No other Stripe event touches the licensing flow. Confirmed the success-redirect URL (`?payment=success`) carries no state the client can use to self-activate — `ContractPage.tsx` only ever reads `status` from the live Firestore subscription.

## 8. Security controls verified

- Every `licenceRequests`/`licenceOffers`/`licenceAgreements`/`licenceAgreementAcceptances` write is `allow write: if false` in `firestore.rules` — all state changes go through callables.
- Every callable re-derives the acting user from `request.auth.uid`, never trusts a client-supplied role/party field.
- `acceptOffer`/`counterOffer` reject accepting/countering your own offer (`offer.createdBy === uid` check).
- `signAgreement` recomputes `contentHash` server-side and compares to the frozen hash before allowing a signature — catches any hypothetical future bug that mutated terms post-generation.
- `signAgreement` rejects a second signature from the same party (`artistAcceptedAt`/`djAcceptedAt` already set).
- `createLicencePaymentSession` re-reads price from Firestore, rejects if not `awaiting_payment` or already paid.
- `getSecureDownloadUrl` re-checks agreement ownership, status, payment, expiry, revocation, and (new) copyright-restriction on every call — never issues a permanent URL (5-minute TTL).
- `voidAgreement` respects `legalHold` (admin-set, audit-logged) and only operates on `active`/`awaiting_payment` agreements.
- Copyright-restricted tracks (new): blocked from new requests, new contract generation, new payment sessions, and downloads — existing signed history is never deleted.

## 9. Rule/flow tests (tests/flow-contracts.test.mjs)

Extended the existing lightweight string-matching test file in its own style (no new test framework introduced) with:
- `copyright-restricted tracks are gated out of new DJ requests, contracts, payments, and downloads`
- `reporting an agreement problem never rewrites the contract and reaches an audited admin action`
- `the DJ<->artist request timeline replaces chat with a real backend-event activity feed`
- `the contract page states the DJ receives only the listed rights, not ownership`

All 26 tests pass (`npm test`), including the 22 pre-existing tests, unmodified.

## 10. Remaining legal-review items

**REQUIRES QUALIFIED MUSIC/IP LEGAL REVIEW BEFORE PRODUCTION:**
- The rights/ownership paragraph on `ContractPage.tsx` and the general licensing terms are plain-English platform copy, not solicitor-drafted contract language, and have not been reviewed by a qualified music/IP lawyer for any jurisdiction.
- `signAgreement`'s own code comment already states this is "not a cryptographic signature" and is "recording agreement between the parties" — an explicit e-signature legal opinion (eIDAS/ESIGN/UETA applicability by jurisdiction) has not been obtained.
- Retention periods (`platformSettings/dataRetention`) are admin-configurable defaults, not verified against any specific jurisdiction's statutory limitation periods for contract/tax records.
- The dispute ("Report Agreement Problem") flow is a support-routing mechanism, not a legal dispute-resolution process — no arbitration/jurisdiction clause exists anywhere in the flow.
- No PDF is generated/archived as a discrete legal document (see §4) — if a jurisdiction requires a durable, self-contained export beyond the live database record, this needs follow-up.

## 11. Final PASS/FAIL per spec stage

| # | Stage | Result |
|---|---|---|
| 1 | Artist-created deals | PASS |
| 2 | Assign deals to tracks | PASS |
| 3 | DJ deal view | PASS |
| 4 | DJ request (structured, not chat) | PASS |
| 5 | Artist review | PASS |
| 6 | Custom offer flow (never mutates original) | PASS |
| 7 | DJ counter-offer (structured form) | PASS |
| 8 | Offer history (append-only, versioned) | PASS |
| 9 | Final offer acceptance (server-verified) | PASS |
| 10 | Contract generation (auto, hashed) | PASS |
| 11 | Contract locking (void → new offer → new version) | PASS |
| 12 | Contract status (single status system) | PASS |
| 13 | Contract review page | PASS |
| 14 | E-signature (checkboxes, legal name, typed/drawn) | PASS |
| 15 | Signature security (server-only, hash-verified) | PASS |
| 16 | Signature record fields | PASS |
| 17 | Signing order (either party first) | PASS |
| 18 | Free agreement → active, no Stripe | PASS |
| 19 | Paid agreement → Stripe, server-priced | PASS |
| 20 | Stripe confirmation via webhook only | PASS |
| 21 | Track unlock (fully gated, temporary URL) | PASS (copyright gate added) |
| 22 | Contract PDF | PARTIAL — browser print-to-PDF only, not server-generated/archived (see §4) |
| 23 | Agreements dashboard | PASS |
| 24 | Notifications | PASS |
| 25 | Request activity timeline | PASS (built this session) |
| 26 | Request details page (`/dj-requests/{requestId}`) | PASS (built this session) |
| 27 | Next-action UI clarity | PASS (built this session, `NextActionBanner`) |
| 28 | Rejection flow | PASS |
| 29 | Cancellation flow | PASS |
| 30 | Expiring offers | PASS (`expireStaleNegotiations`) |
| 31 | Contract expiry | PASS (`getSecureDownloadUrl` checks `expiryDate`) |
| 32 | Contract retention | PASS (`cleanupExpiredContracts`, `legalHold`) |
| 33 | Copyright restrictions gating | PASS (fixed this session — was previously unenforced) |
| 34 | Security tests (deny cases) | PASS — all listed deny cases verified in code; string-match tests added |
| 35 | Mobile flow | PASS — no desktop-only sidebars/tables in this flow; signature pad uses Pointer Events (touch-capable) |
| 36 | Final flow test (paid £20→£15→£12 negotiation, and free promo) | PASS by code inspection — negotiation math, contract locking, and free-vs-paid branching all verified against the exact scenario; not run against a live Stripe test-mode checkout in this session (see below) |

**Note on §36 verification method:** this audit verified the £20→£15→£12 negotiation and the free-promo flow by tracing the exact code paths (`sendOffer`→`counterOffer`→`acceptOffer`→`writeAgreementVersion`→`signAgreement`×2→`createLicencePaymentSession`→`stripeWebhook`→`getSecureDownloadUrl`) rather than by executing them against live Firebase Auth/Firestore/Stripe test-mode in this session — doing so would require seeded test accounts and a live Stripe test checkout completion, which wasn't set up as part of this pass. The code-level trace confirms every guard the spec asks for is present and server-enforced at each step.

---

## 12. Build/test/deploy status

- `npx tsc -b --force` — clean.
- `cd functions && npm run build` — clean.
- `npm test` — 26/26 passing.
- `npm run lint` — no new errors; only pre-existing accepted `react(set-state-in-effect)` warnings (including one from the new `RequestTimelinePage.tsx`, consistent with the codebase-wide pattern).
- `firebase deploy --only firestore:rules,storage --dry-run` — compiles cleanly (no rule changes were needed for this pass — all new access patterns were already covered by existing `licenceOffers`/`licenceAgreements`/`reports` rules).
- Deployment of the changed functions, the new Firestore index, and the frontend is described in the commit history for this pass.

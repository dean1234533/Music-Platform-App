# Security incident response

This is an internal, technical response workflow for the team operating
BackTheVibes. It tells you what to do in the first hours of a suspected
security incident. It is not a substitute for legal advice — the
notification-obligation steps below explicitly require legal/DPO input
before any external notification happens.

**REQUIRES LEGAL / PRIVACY REVIEW BEFORE PRODUCTION**: this document defines
a technical process. Whether a given incident legally requires notifying
the ICO (UK GDPR) and/or affected users, within what timeframe, and with
what wording, is a legal judgment this document does not make for you.

## 1. How to identify an incident

Signs worth treating as a possible incident:
- An `auditLogs` entry you don't recognise, or an admin action nobody on
  the team remembers taking.
- A spike in `rateLimits` rejections, failed Stripe webhook signature
  verifications, or `permission-denied` errors in Cloud Functions logs.
- A report from a user, a security researcher, or a payment processor
  (Stripe) about suspicious activity on their account.
- Unexpected Firebase Auth sign-ins from unfamiliar locations on an admin
  account, or an admin account you don't recognise existing.
- A leaked credential alert (GitHub secret scanning, Stripe, Google Cloud).

When in doubt, treat it as an incident and start this process — standing
down is cheap; a missed real incident is not.

## 2. Immediate containment

Do this before investigating root cause in depth — stop the bleeding first.

- **Compromised admin account**: `adminSetUserSuspension` (via the admin
  dashboard, from a *different*, trusted admin account) to suspend it
  immediately. If you cannot trust any admin account, revoke the
  suspected account's sessions directly in the Firebase Console
  (Authentication → user → "Revoke refresh tokens").
- **Exposed Stripe key or webhook secret**: roll it immediately in the
  Stripe Dashboard (Developers → API keys / Webhooks), then update the
  Firebase secret (`firebase functions:secrets:set STRIPE_SECRET_KEY` /
  `STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_WEBHOOK_SECRET`) and redeploy
  functions. **Rotating the code's reference to a secret does nothing if
  the old secret itself isn't revoked at the source (Stripe) — always
  revoke first.**
- **Exposed Firebase service-account key**: revoke it in Google Cloud
  Console (IAM & Admin → Service Accounts → Keys) and generate a new one.
  A leaked Firebase *web* API key (the `VITE_FIREBASE_*` values) is not
  itself a secret — see `.env.example` — but if you suspect App Check or
  API restrictions were bypassed as a result, review Google Cloud API key
  restrictions regardless.
- **A specific Cloud Function is being abused**: disable it from the
  Firebase Console (Functions → select function → Disable), or tighten
  `functions/src/rateLimit.ts`'s limits and redeploy.
- **A specific track/account is the vector** (e.g. malicious upload,
  compromised artist account): use `adminSetTrackTakedown` /
  `adminSetUserSuspension` from the admin dashboard.
- **Data actively exfiltrating via a Storage path**: tighten `storage.rules`
  for that path and deploy rules immediately
  (`firebase deploy --only storage`) — a rules deploy takes effect in
  seconds and needs no function redeploy.

## 3. Revoke and rotate

After containment, systematically rotate anything that might be
compromised:
- Stripe secret key, webhook secrets (both endpoints).
- Firebase service account keys used by any external system (CI/CD,
  local dev `serviceAccountKey.json` if one was ever generated — check it
  was never committed: `git log --all -- '*serviceAccount*'`).
- Any third-party API key found in `functions:secrets:access` output that
  wasn't already covered above.
- Admin account passwords/sessions for every admin, if the scope of
  compromise is unclear.

## 4. Review logs

- **Cloud Functions logs** (Google Cloud Console → Logging, filtered to
  the affected function): look for the actual `request.auth.uid` values
  and payloads around the incident window.
- **`auditLogs` collection**: every admin action is recorded here
  (`writeAuditLog` in `functions/src/admin/guard.ts`) — cross-reference
  against who was actually working at that time.
- **Stripe Dashboard → Developers → Events**: cross-reference webhook
  deliveries against `transactions`/`licenceAgreements` state for
  anomalies (see the idempotency notes in `SECURITY_AUDIT.md`).
- **`rateLimits` collection**: shows which callable and which key (often a
  uid) was hitting limits, useful for identifying the account/IP pattern
  of an abuse incident.

## 5. Preserve evidence

- Export the relevant Firestore documents (the incident's own record, any
  `auditLogs`/`transactions`/`licenceAgreements` involved) to Cloud
  Storage or local files **before** any cleanup job could delete them —
  check `functions/src/retention/cleanup.ts`'s schedules and, if there's
  any risk a scheduled job could touch the evidence, set `legalHold: true`
  on the affected `licenceRequests`/`licenceAgreements`/`tracks` docs via
  `adminSetLegalHold` immediately.
- Keep Cloud Functions logs (Google Cloud Logging retains them for a
  default window — export to a bucket if the incident investigation will
  outlast that window).
- Do not edit or delete anything under investigation until it's been
  captured.

## 6. Identify affected users/data

- Use the incident's `affectedSystems`/`affectedDataCategories` fields
  (see the breach register below) to scope this precisely — "which
  collections, which fields, which uids."
- Cross-reference against `users`, `licenceAgreements`,
  `copyrightClaims`, `transactions` as relevant to the incident type.
- Record the estimated count — this is required input for the legal
  notification-obligation assessment in step 8.

## 7. Contact relevant processors

Depending on what's affected:
- **Stripe** (payments/financial data): use the Stripe Dashboard support
  channel for a payment-security incident.
- **Google/Firebase** (platform-level compromise, e.g. suspected Google
  Cloud account compromise): Google Cloud Support.
- **Cloudflare** (if the incident involves the deployed app itself, e.g.
  a supply-chain concern in the Workers deployment): Cloudflare support.

## 8. Assess notification obligations — LEGAL REVIEW REQUIRED

**Do not notify users or the ICO automatically or by default.** UK GDPR
notification obligations depend on a risk assessment (likelihood and
severity of harm to individuals) that a qualified person — ideally your
DPO or external counsel — must make. Bring them:
- What was affected (step 6).
- How many people (step 6).
- What containment/rotation has already happened (steps 2–3).
- Your draft risk assessment (recorded in the breach register below).

If a notification is required, the ICO's standard timeframe (72 hours
from becoming aware, for notifiable breaches) is short — start this
assessment as early as possible, in parallel with containment, not after.

## 9. Record incident decisions — the breach register

Every incident, whether or not it turns out to require notification, gets
a record in the `securityIncidents` collection (admin-only; see
`functions/src/admin/securityIncidents.ts` and the admin dashboard's
"Security incidents" page). Record at minimum:
- `incidentType`, `affectedSystems`, `affectedDataCategories`,
  `estimatedUsersAffected`
- `riskAssessment` (your step-8 assessment, updated as it firms up)
- `actionsTaken` (append as you go — containment, rotation, investigation
  findings)
- `containedAt` / `resolvedAt`
- `notificationDecision` and who made it (a legal/DPO sign-off should be
  named here, not just "yes/no")

This record itself is a controlled document (admin-only read, written
only via the two admin callables — see `firestore.rules`) — it may
itself need to be produced as evidence of your response process, so
don't edit history in it; append.

## 10. Post-incident

- Fix the root cause in code (not just the symptom) and get it reviewed.
- If a Firestore/Storage rule gap was involved, add a rule test for it
  (see the "Firebase rule tests" section of `SECURITY_AUDIT.md`).
- Update this document if the process itself needs to change.

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAuth } from 'firebase-admin/auth'
import { requireAdmin, writeAuditLog } from './guard.js'

/**
 * The client-side checks in src/utils/passwordPolicy.ts (length, common-
 * password blocklist) are enforced only in the browser and are trivially
 * bypassed by calling the Firebase Auth REST/SDK API directly. Real
 * server-side enforcement requires Identity Platform's password policy,
 * which is a project-level Auth config — not something any per-request
 * callable can apply retroactively to existing users, so this is a one-time
 * admin action (run once from the admin dashboard) rather than something
 * that runs automatically on deploy.
 *
 * Deliberately only sets a minimum length, not character-composition rules
 * (uppercase/number/symbol requirements): those push people toward
 * predictable substitutions ("Password1!") without meaningfully raising
 * real-world guessability, and the audit brief explicitly prefers length +
 * common-password rejection over arbitrary composition rules. Composition
 * requirements are not used here for that reason, not because they weren't
 * considered.
 */
export const adminEnableStrongPasswordPolicy = onCall(async (request) => {
  const adminId = await requireAdmin(request)

  try {
    const config = await getAuth().projectConfigManager().updateProjectConfig({
      passwordPolicyConfig: {
        enforcementState: 'ENFORCE',
        forceUpgradeOnSignin: false,
        constraints: { minLength: 12, maxLength: 64 },
      },
    })
    await writeAuditLog(adminId, 'enable_strong_password_policy', { enforcementState: 'ENFORCE' })
    return { ok: true, passwordPolicyConfig: config.passwordPolicyConfig }
  } catch (err) {
    // Most likely cause: this Firebase project hasn't been upgraded to
    // Identity Platform yet — that upgrade itself has to happen in the
    // Firebase/GCP console first (Authentication → Settings → upgrade to
    // Identity Platform), this callable can't do that part.
    throw new HttpsError(
      'failed-precondition',
      'Could not enable the password policy. This project may need to be upgraded to Identity Platform first (Firebase Console → Authentication → Settings). ' +
        (err instanceof Error ? err.message : String(err)),
    )
  }
})

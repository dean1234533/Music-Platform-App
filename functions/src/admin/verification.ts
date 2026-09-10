import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { requireAdmin, writeAuditLog } from './guard.js'

type ProfileType = 'artist' | 'dj'

export const submitVerificationRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const profileType = request.data?.profileType as ProfileType | undefined
  if (profileType !== 'artist' && profileType !== 'dj') {
    throw new HttpsError('invalid-argument', 'profileType must be "artist" or "dj".')
  }
  const note = typeof request.data?.note === 'string' ? request.data.note.trim() : ''
  if (note.length < 10) {
    throw new HttpsError('invalid-argument', 'Tell us why you should be verified (at least 10 characters) — an admin has nothing else to go on when reviewing this.')
  }
  if (note.length > 1000) {
    throw new HttpsError('invalid-argument', 'Keep it under 1000 characters.')
  }

  const collection = profileType === 'artist' ? 'artistProfiles' : 'djProfiles'
  const profileSnap = await db.collection(collection).doc(uid).get()
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', `No ${profileType} profile found.`)
  const profile = profileSnap.data()!

  const requestRef = db.collection('verificationRequests').doc()
  const batch = db.batch()
  batch.set(requestRef, {
    verificationRequestId: requestRef.id,
    userId: uid,
    profileType,
    status: 'pending',
    note,
    createdAt: FieldValue.serverTimestamp(),
  })

  if (profileType === 'dj') {
    batch.update(db.collection('djProfiles').doc(uid), { verificationStatus: 'pending' })
  }

  // Nobody was ever told a new verification request existed — an admin only found out by
  // remembering to check Admin -> Verification. Notify every admin the same way every other
  // event in the app does (bell + push), matching submitSupportMessage's established pattern.
  const adminsSnap = await db.collection('users').where('roles', 'array-contains', 'admin').get()
  for (const adminDoc of adminsSnap.docs) {
    batch.set(db.collection('notifications').doc(), {
      userId: adminDoc.id,
      type: 'verification_request',
      title: 'New verification request',
      body: `${profile.name ?? 'Someone'} wants ${profileType} verification`,
      linkTo: '/admin/verification',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  await batch.commit()

  return { verificationRequestId: requestRef.id }
})

export const reviewVerificationRequest = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { verificationRequestId, approve } = request.data ?? {}
  if (!verificationRequestId || typeof approve !== 'boolean') {
    throw new HttpsError('invalid-argument', 'verificationRequestId and approve are required.')
  }

  const reqRef = db.collection('verificationRequests').doc(verificationRequestId)
  const reqSnap = await reqRef.get()
  if (!reqSnap.exists) throw new HttpsError('not-found', 'Verification request not found.')
  const { userId, profileType } = reqSnap.data()!

  const batch = db.batch()
  batch.update(reqRef, {
    status: approve ? 'approved' : 'rejected',
    reviewedBy: adminId,
    reviewedAt: FieldValue.serverTimestamp(),
  })

  if (profileType === 'artist') {
    batch.update(db.collection('artistProfiles').doc(userId), { verified: approve })
  } else {
    batch.update(db.collection('djProfiles').doc(userId), {
      verificationStatus: approve ? 'verified' : 'rejected',
    })
  }

  batch.set(db.collection('notifications').doc(), {
    userId,
    type: 'verification_update',
    title: approve ? 'Verification approved' : 'Verification declined',
    body: approve ? 'Your account is now verified.' : 'Your verification request was not approved.',
    linkTo: profileType === 'artist' ? '/dashboard/artist/settings' : '/dj/profile',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  await writeAuditLog(adminId, 'review_verification_request', { verificationRequestId, userId, profileType, approve })

  return { ok: true }
})

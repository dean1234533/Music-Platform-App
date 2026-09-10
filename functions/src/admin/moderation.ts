import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'

export const adminSetUserSuspension = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { userId, suspended } = request.data ?? {}
  if (!userId || typeof suspended !== 'boolean') {
    throw new HttpsError('invalid-argument', 'userId and suspended are required.')
  }
  if (userId === adminId) {
    throw new HttpsError('failed-precondition', 'You cannot suspend your own account.')
  }

  await db.collection('users').doc(userId).update({
    suspended,
    updatedAt: FieldValue.serverTimestamp(),
  })

  await writeAuditLog(adminId, 'set_user_suspension', { userId, suspended })
  return { ok: true }
})

export const adminSetTrackTakedown = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { trackId, takenDown } = request.data ?? {}
  if (!trackId || typeof takenDown !== 'boolean') {
    throw new HttpsError('invalid-argument', 'trackId and takenDown are required.')
  }

  await db.collection('tracks').doc(trackId).update({
    takenDown,
    ...(takenDown ? { visibility: 'private' } : {}),
  })

  await writeAuditLog(adminId, 'set_track_takedown', { trackId, takenDown })
  return { ok: true }
})

export const adminDeleteStory = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { storyId } = request.data ?? {}
  if (!storyId || typeof storyId !== 'string') {
    throw new HttpsError('invalid-argument', 'storyId is required.')
  }

  await db.collection('stories').doc(storyId).delete()

  await writeAuditLog(adminId, 'delete_story', { storyId })
  return { ok: true }
})

import { FieldValue } from 'firebase-admin/firestore'
import type { DocumentReference, Transaction, WriteBatch } from 'firebase-admin/firestore'

export type RequestEventWriter = WriteBatch | Transaction

/** Append-only, server-owned audit event for the no-chat licensing workflow. */
export function writeRequestEvent(
  writer: RequestEventWriter,
  requestRef: DocumentReference,
  event: {
    type: string
    actorId: string | null
    actorRole: 'artist' | 'dj' | 'system'
    summary: string
    agreementId?: string | null
    offerId?: string | null
  },
) {
  const eventRef = requestRef.collection('events').doc()
  ;(writer as WriteBatch).set(eventRef, {
    eventId: eventRef.id,
    requestId: requestRef.id,
    ...event,
    createdAt: FieldValue.serverTimestamp(),
  })
}

import { HttpsError } from 'firebase-functions/v2/https'
import type { DocumentData } from 'firebase-admin/firestore'

export type LicencePartyRole = 'artist' | 'dj'

/**
 * Resolve the side a signed-in user is acting for. Most requests have two
 * different accounts and need no hint. A multi-role test account can own
 * both sides, so the client must explicitly carry its current workspace
 * role; otherwise an artist offer looks like the DJ's own offer too.
 */
export function resolveLicencePartyRole(
  record: DocumentData,
  uid: string,
  requestedRole: unknown,
): LicencePartyRole {
  const isArtist = record.artistId === uid
  const isDj = record.djId === uid

  if (!isArtist && !isDj) {
    throw new HttpsError('permission-denied', 'Not a party to this licence.')
  }

  if (requestedRole === 'artist') {
    if (!isArtist) throw new HttpsError('permission-denied', 'You are not the artist on this licence.')
    return 'artist'
  }
  if (requestedRole === 'dj') {
    if (!isDj) throw new HttpsError('permission-denied', 'You are not the DJ on this licence.')
    return 'dj'
  }
  if (requestedRole != null) {
    throw new HttpsError('invalid-argument', 'actingRole must be artist or dj.')
  }

  if (isArtist && isDj) {
    throw new HttpsError('invalid-argument', 'Choose whether you are acting as the artist or the DJ.')
  }
  return isArtist ? 'artist' : 'dj'
}

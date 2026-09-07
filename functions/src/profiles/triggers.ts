import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { mirrorResolvedLimits } from '../entitlements.js'

/**
 * The client creates artistProfiles/djProfiles with a safe placeholder
 * trackLimit (0) / no planTier before any subscription has ever existed for
 * that role. This trigger fills in the real free-tier values immediately,
 * so a brand-new Starter artist isn't blocked from their first upload by an
 * uninitialised limit. mirrorResolvedLimits is the same function the Stripe
 * webhook calls on every later subscription lifecycle event.
 */
export const onArtistProfileCreate = onDocumentCreated('artistProfiles/{artistId}', async (event) => {
  const artistId = event.params.artistId
  await mirrorResolvedLimits(artistId, 'artist')
})

export const onDjProfileCreate = onDocumentCreated('djProfiles/{djId}', async (event) => {
  const djId = event.params.djId
  await mirrorResolvedLimits(djId, 'dj')
})

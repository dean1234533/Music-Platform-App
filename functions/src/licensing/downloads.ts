import { onRequest } from 'firebase-functions/v2/https'

const ALLOWED_ORIGINS = ['https://backthevibes.com', 'https://www.backthevibes.com', 'http://localhost:5173']

function setCorsHeaders(req: { headers: Record<string, unknown> }, res: { set: (name: string, value: string) => void }) {
  const origin = req.headers.origin as string | undefined
  if (origin && ALLOWED_ORIGINS.includes(origin)) res.set('Access-Control-Allow-Origin', origin)
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Authorization')
  res.set('Vary', 'Origin')
}

/**
 * BackTheVibes no longer stores or distributes master audio (see the
 * YouTube-based track migration) — a track's only playable asset is its
 * YouTube link. Master/stem exchange between an artist and a DJ/business
 * happens entirely outside the platform once a deal is agreed; this
 * endpoint stays only so old links return a clear, honest response instead
 * of a broken one.
 */
export const downloadLicensedTrack = onRequest(async (req, res) => {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  res.status(410).json({
    error: 'BackTheVibes no longer stores or distributes master audio. Once a deal is agreed, exchange the master/stems directly with the other party outside the platform.',
  })
})

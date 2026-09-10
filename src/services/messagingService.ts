import { callable } from '@/lib/callable'

/** Promotional outreach is restricted to DJs who explicitly opted in. */
export const sendBulkDjOutreach = callable<{ trackId: string; message: string }, { ok: boolean; sentCount: number }>(
  'sendBulkDjOutreach',
)

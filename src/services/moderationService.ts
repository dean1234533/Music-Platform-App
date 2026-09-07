import { callable } from '@/lib/callable'

export const submitCopyrightClaim = callable<
  { trackId: string; reason: string; description: string },
  { claimId: string }
>('submitCopyrightClaim')

export const submitReport = callable<
  { targetType: 'track' | 'artist' | 'dj' | 'user' | 'message' | 'post'; targetId: string; reason: string; description: string },
  { reportId: string }
>('submitReport')

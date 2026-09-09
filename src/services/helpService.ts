import { callable } from '@/lib/callable'

export const submitSupportMessage = callable<{ subject: string; message: string }, { supportMessageId: string }>(
  'submitSupportMessage',
)

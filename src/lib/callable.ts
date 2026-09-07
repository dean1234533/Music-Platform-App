import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export function callable<TRequest, TResponse>(name: string) {
  const fn = httpsCallable<TRequest, TResponse>(functions, name)
  return async (data?: TRequest): Promise<TResponse> => (await fn(data as TRequest)).data
}

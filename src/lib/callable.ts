import { getFirebaseFunctions } from './firebase'

// Both the functions instance AND httpsCallable itself are reached only through dynamic
// import('firebase/functions') below — a *static* top-level import of anything from
// 'firebase/functions' pulls the whole SDK into every eager caller's bundle regardless of when the
// binding is actually invoked. This file is a shared wrapper behind ~14 service files (several
// reached eagerly, e.g. supportService.ts via PlayerBar -> SupportButton -> SupportModal, which is
// mounted on every route), so a static import here would silently reintroduce the same homepage
// bundle-size regression getFirebaseFunctions() elsewhere was written to fix.
export function callable<TRequest, TResponse>(name: string) {
  return async (data?: TRequest): Promise<TResponse> => {
    const { httpsCallable } = await import('firebase/functions')
    const fn = httpsCallable<TRequest, TResponse>(await getFirebaseFunctions(), name)
    return (await fn(data as TRequest)).data
  }
}

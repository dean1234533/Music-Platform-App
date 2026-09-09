import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/expired-action-code': 'This link has expired. Request a new one and try again.',
  'auth/invalid-action-code': 'This link has already been used or is invalid. Request a new one and try again.',
  'auth/user-disabled': 'This account has been disabled.',
}

export function friendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

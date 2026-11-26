import type { ApiError } from '@/lib/api'

/**
 * The message for a failed sign-and-send. Wallet errors are the wallet's own
 * English text; the cancellation is the common one, so it gets a translated
 * message.
 */
export function signingError(err: unknown, cancelled: string, generic: string): string {
  const apiError = err as ApiError
  const wasCancelled = !apiError.statusCode && /clos|cancel|reject|denied|declin/i.test(apiError.message ?? '')
  return wasCancelled ? cancelled : apiError.message || generic
}

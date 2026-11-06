/** Retry falsey results during browser startup without suppressing unexpected failures. */
import { setTimeout as delay } from 'node:timers/promises'

export async function pollUntil(action, { timeoutMs = 14000, intervalMs = 120, label = 'condition', retryIf = () => false } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastRetryableError
  while (Date.now() <= deadline) {
    try {
      const value = await Promise.resolve().then(action)
      if (value) return value
    } catch (error) {
      if (!retryIf(error)) throw error
      lastRetryableError = error
    }
    if (Date.now() >= deadline) break
    await delay(Math.min(intervalMs, Math.max(1, deadline - Date.now())))
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms` +
    (lastRetryableError ? ` (last retryable error: ${lastRetryableError.message})` : ''))
}

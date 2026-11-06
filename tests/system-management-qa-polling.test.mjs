import test from 'node:test'
import assert from 'node:assert/strict'
import { pollUntil } from '../scripts/qa-polling.mjs'

const fast = { timeoutMs: 80, intervalMs: 1 }

test('polling accepts a synchronous truthy value without calling .catch on it', async () => {
  assert.equal(await pollUntil(() => 'ready', fast), 'ready')
})

test('polling retries synchronous null and undefined results until ready', async () => {
  let polls = 0
  assert.equal(await pollUntil(() => (++polls < 3 ? null : 42), fast), 42)
  assert.ok(polls >= 3)
  polls = 0
  assert.equal(await pollUntil(() => (++polls < 2 ? undefined : 'ready'), fast), 'ready')
})

test('polling accepts resolved Promises', async () => {
  assert.equal(await pollUntil(async () => true, fast), true)
})

test('polling immediately rejects unexpected synchronous and async failures', async () => {
  await assert.rejects(pollUntil(() => { throw Error('fatal sync error') }, fast), /fatal sync error/)
  await assert.rejects(pollUntil(() => Promise.reject(Error('fatal async error')), fast), /fatal async error/)
})

test('polling retries only explicitly classified startup errors', async () => {
  let runs = 0
  assert.equal(await pollUntil(() => {
    runs++
    if (runs < 3) return Promise.reject(new TypeError('fetch failed'))
    return 'chrome ready'
  }, { ...fast, retryIf: e => e instanceof TypeError && e.message === 'fetch failed' }), 'chrome ready')
  assert.equal(runs, 3)
})

test('polling fails closed on timeout and retains last startup error', async () => {
  await assert.rejects(pollUntil(() => null, { timeoutMs: 4, intervalMs: 1, label: 'ready page' }), /Timed out waiting for ready page/)
  await assert.rejects(pollUntil(() => { throw Error('fetch failed') }, {
    timeoutMs: 4, intervalMs: 1, retryIf: e => e.message === 'fetch failed'
  }), /last retryable error: fetch failed/)
})

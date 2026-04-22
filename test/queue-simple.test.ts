import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerHandler, enqueue, _resetQueue } from '../src/lib/queue/simple'

// _resetQueue is exported for test-only use to clear state between tests.
describe('simple queue', () => {
  beforeEach(() => {
    _resetQueue()
  })

  it('calls registered handler when job is enqueued', async () => {
    const handler = vi.fn()
    registerHandler('test-job', handler)
    enqueue('test-job', { message: 'hello' })
    await new Promise(r => setImmediate(r))
    expect(handler).toHaveBeenCalledTimes(1)
    // handler receives job.data directly (not wrapped)
    expect(handler).toHaveBeenCalledWith({ message: 'hello' })
  })

  it('silently ignores enqueue for unregistered job type', async () => {
    const handler = vi.fn()
    // Should not throw
    enqueue('unknown-job', { foo: 'bar' })
    await new Promise(r => setImmediate(r))
    expect(handler).not.toHaveBeenCalled()
  })

  it('retries failed job up to maxAttempts (3 by default)', async () => {
    const callCount = { n: 0 }
    const handler = vi.fn(() => {
      callCount.n++
      if (callCount.n < 3) throw new Error('transient failure')
    })
    registerHandler('retry-job', handler)
    enqueue('retry-job', { data: 'test' })
    // Retry delays: 1s + 2s = 3s minimum, allow 5s
    await new Promise(r => setTimeout(r, 5000))
    expect(callCount.n).toBe(3)
  })

  it('stops retrying after maxAttempts is exhausted', async () => {
    const callCount = { n: 0 }
    const handler = vi.fn(() => {
      callCount.n++
      throw new Error('permanent failure')
    })
    registerHandler('fail-job', handler)
    enqueue('fail-job', { data: 'test' }, { maxAttempts: 2 })
    // Retry delay: 1s, allow 2s
    await new Promise(r => setTimeout(r, 2500))
    expect(callCount.n).toBe(2)
  })

  it('processes jobs with delay after delay expires', async () => {
    const handler = vi.fn()
    registerHandler('delayed-job', handler)
    enqueue('delayed-job', { data: 'delayed' }, { delay: 50 })
    // Immediately after enqueue, should not have been called
    expect(handler).not.toHaveBeenCalled()
    await new Promise(r => setTimeout(r, 80))
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

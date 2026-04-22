import { describe, it, expect, beforeEach } from 'vitest'
import { setPaused, isPaused, clearPaused } from '../src/lib/file-watcher/pause-flag'

// We need to clear the module-level map between tests.
// Since the module is a singleton, we expose clearPaused for testing.
// For testing we use a dedicated test key so beforeEach can clean it.
const TEST_KEY = 'test-pause-key'
const OTHER_KEY = 'other-pause-key'

describe('pause-flag', () => {
  beforeEach(() => {
    clearPaused(TEST_KEY)
    clearPaused(OTHER_KEY)
  })

  it('isPaused returns false when key is not set', () => {
    expect(isPaused(TEST_KEY)).toBe(false)
  })

  it('isPaused returns true immediately after setPaused', () => {
    setPaused(TEST_KEY, 5000)
    expect(isPaused(TEST_KEY)).toBe(true)
  })

  it('clearPaused removes the pause immediately', () => {
    setPaused(TEST_KEY, 5000)
    clearPaused(TEST_KEY)
    expect(isPaused(TEST_KEY)).toBe(false)
  })

  it('multiple keys are independent', () => {
    setPaused(TEST_KEY, 5000)
    expect(isPaused(TEST_KEY)).toBe(true)
    expect(isPaused(OTHER_KEY)).toBe(false)
    clearPaused(OTHER_KEY)
    expect(isPaused(TEST_KEY)).toBe(true)
  })

  it('expired key returns false', async () => {
    setPaused(TEST_KEY, 80)
    expect(isPaused(TEST_KEY)).toBe(true)
    await new Promise(r => setTimeout(r, 120))
    expect(isPaused(TEST_KEY)).toBe(false)
  })
})

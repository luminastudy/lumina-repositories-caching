import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RequestDedupService } from './request-dedup.service.js'

describe('RequestDedupService', () => {
  let service: RequestDedupService

  beforeEach(() => {
    service = new RequestDedupService()
  })

  describe('dedupe', () => {
    it('should execute the function and return result', async () => {
      const fn = vi.fn().mockResolvedValue('result')

      const result = await service.dedupe(
        'github',
        'org',
        'repo',
        undefined,
        fn
      )

      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should deduplicate concurrent requests', async () => {
      let resolvePromise: (value: string) => void
      const promise = new Promise<string>((resolve) => {
        resolvePromise = resolve
      })
      const fn = vi.fn().mockReturnValue(promise)

      // Start two concurrent requests
      const result1Promise = service.dedupe(
        'github',
        'org',
        'repo',
        undefined,
        fn
      )
      const result2Promise = service.dedupe(
        'github',
        'org',
        'repo',
        undefined,
        fn
      )

      // Function should only be called once
      expect(fn).toHaveBeenCalledTimes(1)

      // Resolve the promise
      resolvePromise!('result')

      const [result1, result2] = await Promise.all([
        result1Promise,
        result2Promise,
      ])

      // Both should get the same result
      expect(result1).toBe('result')
      expect(result2).toBe('result')
    })

    it('should not deduplicate requests with different SHAs', async () => {
      const fn1 = vi.fn().mockResolvedValue('result1')
      const fn2 = vi.fn().mockResolvedValue('result2')

      const [result1, result2] = await Promise.all([
        service.dedupe('github', 'org', 'repo', 'sha1', fn1),
        service.dedupe('github', 'org', 'repo', 'sha2', fn2),
      ])

      expect(result1).toBe('result1')
      expect(result2).toBe('result2')
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
    })

    it('should clean up after completion', async () => {
      const fn = vi.fn().mockResolvedValue('result')

      await service.dedupe('github', 'org', 'repo', undefined, fn)

      expect(service.hasPending('github', 'org', 'repo')).toBe(false)
    })

    it('should clean up on error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'))

      await expect(
        service.dedupe('github', 'org', 'repo', undefined, fn)
      ).rejects.toThrow('test error')

      expect(service.hasPending('github', 'org', 'repo')).toBe(false)
    })
  })

  describe('hasPending', () => {
    it('should return false when no pending requests', () => {
      expect(service.hasPending('github', 'org', 'repo')).toBe(false)
    })

    it('should return true when request is pending', async () => {
      let resolvePromise: (value: string) => void
      const promise = new Promise<string>((resolve) => {
        resolvePromise = resolve
      })

      const dedupePromise = service.dedupe(
        'github',
        'org',
        'repo',
        undefined,
        () => promise
      )

      expect(service.hasPending('github', 'org', 'repo')).toBe(true)

      resolvePromise!('result')
      await dedupePromise

      expect(service.hasPending('github', 'org', 'repo')).toBe(false)
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 when no pending requests', () => {
      expect(service.getPendingCount()).toBe(0)
    })

    it('should return count of pending requests', async () => {
      let resolve1: (value: string) => void
      let resolve2: (value: string) => void
      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve
      })
      const promise2 = new Promise<string>((resolve) => {
        resolve2 = resolve
      })

      const dedupePromise1 = service.dedupe(
        'github',
        'org1',
        'repo1',
        undefined,
        () => promise1
      )
      const dedupePromise2 = service.dedupe(
        'github',
        'org2',
        'repo2',
        undefined,
        () => promise2
      )

      expect(service.getPendingCount()).toBe(2)

      resolve1!('result1')
      resolve2!('result2')

      await Promise.all([dedupePromise1, dedupePromise2])

      expect(service.getPendingCount()).toBe(0)
    })
  })
})

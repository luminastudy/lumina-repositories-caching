import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { FreshnessCacheService } from './freshness-cache.service.js'

describe('FreshnessCacheService', () => {
  let service: FreshnessCacheService
  let mockConfigService: ConfigService

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn().mockReturnValue(60000), // 60 second TTL
    } as unknown as ConfigService

    service = new FreshnessCacheService(mockConfigService)
  })

  describe('getFreshCommitSha', () => {
    it('should return null for non-existent entry', () => {
      const result = service.getFreshCommitSha('github', 'org', 'repo')
      expect(result).toBeNull()
    })

    it('should return cached SHA for fresh entry', () => {
      service.setFreshCommitSha('github', 'org', 'repo', 'abc123')
      const result = service.getFreshCommitSha('github', 'org', 'repo')
      expect(result).toBe('abc123')
    })

    it('should return null for expired entry', () => {
      vi.useFakeTimers()

      service.setFreshCommitSha('github', 'org', 'repo', 'abc123')

      // Advance time past TTL
      vi.advanceTimersByTime(61000)

      const result = service.getFreshCommitSha('github', 'org', 'repo')
      expect(result).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('setFreshCommitSha', () => {
    it('should store the commit SHA', () => {
      service.setFreshCommitSha('github', 'org', 'repo', 'abc123')
      expect(service.getFreshCommitSha('github', 'org', 'repo')).toBe('abc123')
    })

    it('should update existing entry', () => {
      service.setFreshCommitSha('github', 'org', 'repo', 'abc123')
      service.setFreshCommitSha('github', 'org', 'repo', 'def456')
      expect(service.getFreshCommitSha('github', 'org', 'repo')).toBe('def456')
    })
  })

  describe('invalidate', () => {
    it('should remove the cached entry', () => {
      service.setFreshCommitSha('github', 'org', 'repo', 'abc123')
      service.invalidate('github', 'org', 'repo')
      expect(service.getFreshCommitSha('github', 'org', 'repo')).toBeNull()
    })

    it('should not affect other entries', () => {
      service.setFreshCommitSha('github', 'org1', 'repo1', 'abc123')
      service.setFreshCommitSha('github', 'org2', 'repo2', 'def456')
      service.invalidate('github', 'org1', 'repo1')

      expect(service.getFreshCommitSha('github', 'org1', 'repo1')).toBeNull()
      expect(service.getFreshCommitSha('github', 'org2', 'repo2')).toBe('def456')
    })
  })

  describe('clearAll', () => {
    it('should remove all cached entries', () => {
      service.setFreshCommitSha('github', 'org1', 'repo1', 'abc123')
      service.setFreshCommitSha('gitlab', 'org2', 'repo2', 'def456')
      service.clearAll()

      expect(service.getFreshCommitSha('github', 'org1', 'repo1')).toBeNull()
      expect(service.getFreshCommitSha('gitlab', 'org2', 'repo2')).toBeNull()
    })
  })
})

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { RequestDedupService } from '../dedup/request-dedup.service.js'

// Mock the entity module before any imports that depend on it
vi.mock('./entities/repository-cache.entity.js', () => ({
  RepositoryCache: class MockRepositoryCache {},
}))

// Import after mocking
const { RepositoriesService } = await import('./repositories.service.js')

interface MockLuminaJson {
  blocks: Array<{
    id: string
    title: { he_text: string; en_text: string }
    prerequisites: string[]
    parents: string[]
  }>
}

describe('RepositoriesService', () => {
  let service: InstanceType<typeof RepositoriesService>
  let mockCacheRepository: {
    findOne: Mock
    find: Mock
    create: Mock
    save: Mock
  }
  let mockGitProviders: {
    getLatestCommitSha: Mock
    fetchLuminaJson: Mock
  }
  let mockFreshnessCache: {
    getFreshCommitSha: Mock
    setFreshCommitSha: Mock
    invalidate: Mock
  }
  let mockDedupService: RequestDedupService

  const mockLuminaJson: MockLuminaJson = {
    blocks: [
      {
        id: 'test-block',
        title: { he_text: 'בדיקה', en_text: 'Test' },
        prerequisites: [],
        parents: [],
      },
    ],
  }

  beforeEach(() => {
    mockCacheRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn((entity: unknown) => entity),
      save: vi.fn((entity: unknown) => Promise.resolve(entity)),
    }

    mockGitProviders = {
      getLatestCommitSha: vi.fn(),
      fetchLuminaJson: vi.fn(),
    }

    mockFreshnessCache = {
      getFreshCommitSha: vi.fn(),
      setFreshCommitSha: vi.fn(),
      invalidate: vi.fn(),
    }

    // Use real dedup service for simplicity
    mockDedupService = new RequestDedupService()

    service = new RepositoriesService(
      mockCacheRepository as never,
      mockGitProviders as never,
      mockFreshnessCache as never,
      mockDedupService
    )
  })

  describe('get', () => {
    it('should return cached data when freshness cache has valid entry', async () => {
      const cachedEntry = {
        provider: 'github',
        organization: 'org',
        repository: 'repo',
        commitSha: 'abc123',
        content: mockLuminaJson,
      }

      mockFreshnessCache.getFreshCommitSha.mockReturnValue('abc123')
      mockCacheRepository.findOne.mockResolvedValue(cachedEntry)

      const result = await service.get('github', 'org', 'repo')

      expect(result).toEqual({
        luminaJson: mockLuminaJson,
        commitSha: 'abc123',
        cached: true,
        provider: 'github',
        organization: 'org',
        repository: 'repo',
      })
      expect(mockGitProviders.getLatestCommitSha).not.toHaveBeenCalled()
    })

    it('should fetch from provider when cache miss', async () => {
      mockFreshnessCache.getFreshCommitSha.mockReturnValue(null)
      mockGitProviders.getLatestCommitSha.mockResolvedValue('abc123')
      mockCacheRepository.findOne.mockResolvedValue(null)
      mockGitProviders.fetchLuminaJson.mockResolvedValue({
        luminaJson: mockLuminaJson,
        commitSha: 'abc123',
      })

      const result = await service.get('github', 'org', 'repo')

      expect(result).toEqual({
        luminaJson: mockLuminaJson,
        commitSha: 'abc123',
        cached: false,
        provider: 'github',
        organization: 'org',
        repository: 'repo',
      })
      expect(mockCacheRepository.save).toHaveBeenCalled()
      expect(mockFreshnessCache.setFreshCommitSha).toHaveBeenCalledWith(
        'github',
        'org',
        'repo',
        'abc123'
      )
    })

    it('should return cached data when provider has same SHA', async () => {
      const cachedEntry = {
        provider: 'github',
        organization: 'org',
        repository: 'repo',
        commitSha: 'abc123',
        content: mockLuminaJson,
      }

      mockFreshnessCache.getFreshCommitSha.mockReturnValue(null)
      mockGitProviders.getLatestCommitSha.mockResolvedValue('abc123')
      mockCacheRepository.findOne.mockResolvedValue(cachedEntry)

      const result = await service.get('github', 'org', 'repo')

      expect(result.cached).toBe(true)
      expect(mockGitProviders.fetchLuminaJson).not.toHaveBeenCalled()
    })

    it('should fallback to stale cache on provider error', async () => {
      const cachedEntry = {
        provider: 'github',
        organization: 'org',
        repository: 'repo',
        commitSha: 'old123',
        content: mockLuminaJson,
        createdAt: new Date(),
      }

      mockFreshnessCache.getFreshCommitSha.mockReturnValue(null)
      mockGitProviders.getLatestCommitSha.mockRejectedValue(
        new Error('Rate limited')
      )
      mockCacheRepository.find.mockResolvedValue([cachedEntry])

      const result = await service.get('github', 'org', 'repo')

      expect(result).toEqual({
        luminaJson: mockLuminaJson,
        commitSha: 'old123',
        cached: true,
        provider: 'github',
        organization: 'org',
        repository: 'repo',
      })
    })
  })

  describe('getByCommit', () => {
    it('should return cached data for specific SHA', async () => {
      const cachedEntry = {
        provider: 'github',
        organization: 'org',
        repository: 'repo',
        commitSha: 'abc123',
        content: mockLuminaJson,
      }

      mockCacheRepository.findOne.mockResolvedValue(cachedEntry)

      const result = await service.getByCommit('github', 'org', 'repo', 'abc123')

      expect(result).toEqual({
        luminaJson: mockLuminaJson,
        commitSha: 'abc123',
        cached: true,
        provider: 'github',
        organization: 'org',
        repository: 'repo',
      })
    })

    it('should fetch from provider when specific SHA not cached', async () => {
      mockCacheRepository.findOne.mockResolvedValue(null)
      mockGitProviders.fetchLuminaJson.mockResolvedValue({
        luminaJson: mockLuminaJson,
        commitSha: 'abc123',
      })

      const result = await service.getByCommit('github', 'org', 'repo', 'abc123')

      expect(result).toEqual({
        luminaJson: mockLuminaJson,
        commitSha: 'abc123',
        cached: false,
        provider: 'github',
        organization: 'org',
        repository: 'repo',
      })
      expect(mockGitProviders.fetchLuminaJson).toHaveBeenCalledWith(
        'github',
        'org',
        'repo',
        'abc123'
      )
    })
  })

  describe('listVersions', () => {
    it('should return all cached versions', async () => {
      const cachedEntries = [
        { commitSha: 'abc123', createdAt: new Date('2024-01-02') },
        { commitSha: 'def456', createdAt: new Date('2024-01-01') },
      ]

      mockCacheRepository.find.mockResolvedValue(cachedEntries)

      const result = await service.listVersions('github', 'org', 'repo')

      expect(result).toEqual([
        { commitSha: 'abc123', createdAt: new Date('2024-01-02') },
        { commitSha: 'def456', createdAt: new Date('2024-01-01') },
      ])
    })

    it('should return empty array when no cached versions', async () => {
      mockCacheRepository.find.mockResolvedValue([])

      const result = await service.listVersions('github', 'org', 'repo')

      expect(result).toEqual([])
    })
  })
})

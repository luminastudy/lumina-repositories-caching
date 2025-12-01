import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GitProvidersService } from '../git-providers/git-providers.service.js'
import { FreshnessCacheService } from '../freshness/freshness-cache.service.js'
import { RequestDedupService } from '../dedup/request-dedup.service.js'
import {
  RepositoryCache,
  type GitProvider,
  type LuminaJson,
} from './entities/repository-cache.entity.js'

export interface CacheResult {
  luminaJson: LuminaJson
  commitSha: string
  cached: boolean
  provider: GitProvider
  organization: string
  repository: string
}

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name)

  constructor(
    @InjectRepository(RepositoryCache)
    private readonly cacheRepository: Repository<RepositoryCache>,
    private readonly gitProviders: GitProvidersService,
    private readonly freshnessCache: FreshnessCacheService,
    private readonly dedupService: RequestDedupService
  ) {}

  /**
   * Get lumina.json for a repository, using cache when possible.
   * This is the main entry point for fetching repository data.
   *
   * Flow:
   * 1. Check freshness cache to see if we recently checked the commit SHA
   * 2. If fresh, return cached data if available
   * 3. If not fresh, fetch latest commit SHA from provider
   * 4. Check if we have cached data for that SHA
   * 5. If cached, return it; otherwise fetch from provider and cache
   */
  async get(
    provider: GitProvider,
    organization: string,
    repository: string
  ): Promise<CacheResult> {
    return this.dedupService.dedupe(
      provider,
      organization,
      repository,
      undefined,
      () => this.doGet(provider, organization, repository)
    )
  }

  private async doGet(
    provider: GitProvider,
    organization: string,
    repository: string
  ): Promise<CacheResult> {
    this.logger.log(
      `Getting lumina.json for ${provider}:${organization}/${repository}`
    )

    // Step 1: Check freshness cache
    const freshSha = this.freshnessCache.getFreshCommitSha(
      provider,
      organization,
      repository
    )

    if (freshSha) {
      // We recently checked - try to get from cache
      const cached = await this.findByCommit(
        provider,
        organization,
        repository,
        freshSha
      )

      if (cached) {
        this.logger.debug(`Cache hit (fresh) for ${organization}/${repository}`)
        return {
          luminaJson: cached.content,
          commitSha: cached.commitSha,
          cached: true,
          provider,
          organization,
          repository,
        }
      }
    }

    // Step 2: Fetch latest commit SHA from provider
    let latestSha: string
    try {
      latestSha = await this.gitProviders.getLatestCommitSha(
        provider,
        organization,
        repository
      )
    } catch (error) {
      // On rate limit or error, try to return any cached version
      this.logger.warn(
        `Failed to get latest SHA for ${organization}/${repository}, trying cache fallback`
      )
      const anyCached = await this.findLatestCached(
        provider,
        organization,
        repository
      )

      if (anyCached) {
        this.logger.debug(
          `Returning stale cache for ${organization}/${repository}`
        )
        return {
          luminaJson: anyCached.content,
          commitSha: anyCached.commitSha,
          cached: true,
          provider,
          organization,
          repository,
        }
      }

      throw error
    }

    // Update freshness cache
    this.freshnessCache.setFreshCommitSha(
      provider,
      organization,
      repository,
      latestSha
    )

    // Step 3: Check if we have this version cached
    const cached = await this.findByCommit(
      provider,
      organization,
      repository,
      latestSha
    )

    if (cached) {
      this.logger.debug(
        `Cache hit for ${organization}/${repository} @ ${latestSha.substring(0, 7)}`
      )
      return {
        luminaJson: cached.content,
        commitSha: cached.commitSha,
        cached: true,
        provider,
        organization,
        repository,
      }
    }

    // Step 4: Fetch from provider and cache
    this.logger.debug(
      `Cache miss for ${organization}/${repository}, fetching from ${provider}`
    )
    const result = await this.gitProviders.fetchLuminaJson(
      provider,
      organization,
      repository,
      latestSha
    )

    // Save to cache
    await this.saveToCache(
      provider,
      organization,
      repository,
      result.commitSha,
      result.luminaJson
    )

    return {
      luminaJson: result.luminaJson,
      commitSha: result.commitSha,
      cached: false,
      provider,
      organization,
      repository,
    }
  }

  /**
   * Get lumina.json for a specific commit SHA.
   * Always checks cache first, then fetches from provider if needed.
   */
  async getByCommit(
    provider: GitProvider,
    organization: string,
    repository: string,
    commitSha: string
  ): Promise<CacheResult> {
    return this.dedupService.dedupe(
      provider,
      organization,
      repository,
      commitSha,
      () => this.doGetByCommit(provider, organization, repository, commitSha)
    )
  }

  private async doGetByCommit(
    provider: GitProvider,
    organization: string,
    repository: string,
    commitSha: string
  ): Promise<CacheResult> {
    this.logger.log(
      `Getting lumina.json for ${provider}:${organization}/${repository} @ ${commitSha.substring(0, 7)}`
    )

    // Check cache first
    const cached = await this.findByCommit(
      provider,
      organization,
      repository,
      commitSha
    )

    if (cached) {
      this.logger.debug(
        `Cache hit for ${organization}/${repository} @ ${commitSha.substring(0, 7)}`
      )
      return {
        luminaJson: cached.content,
        commitSha: cached.commitSha,
        cached: true,
        provider,
        organization,
        repository,
      }
    }

    // Fetch from provider
    this.logger.debug(
      `Cache miss for ${organization}/${repository} @ ${commitSha.substring(0, 7)}, fetching from ${provider}`
    )
    const result = await this.gitProviders.fetchLuminaJson(
      provider,
      organization,
      repository,
      commitSha
    )

    // Save to cache
    await this.saveToCache(
      provider,
      organization,
      repository,
      result.commitSha,
      result.luminaJson
    )

    return {
      luminaJson: result.luminaJson,
      commitSha: result.commitSha,
      cached: false,
      provider,
      organization,
      repository,
    }
  }

  /**
   * Get just the latest commit SHA for a repository's lumina.json
   * Used for lightweight update checking
   */
  async getLatestCommitSha(
    provider: GitProvider,
    organization: string,
    repository: string
  ): Promise<string> {
    // Check freshness cache first
    const freshSha = this.freshnessCache.getFreshCommitSha(
      provider,
      organization,
      repository
    )

    if (freshSha) {
      return freshSha
    }

    // Fetch from provider
    const latestSha = await this.gitProviders.getLatestCommitSha(
      provider,
      organization,
      repository
    )

    // Update freshness cache
    this.freshnessCache.setFreshCommitSha(
      provider,
      organization,
      repository,
      latestSha
    )

    return latestSha
  }

  /**
   * List all cached versions for a repository
   */
  async listVersions(
    provider: GitProvider,
    organization: string,
    repository: string
  ): Promise<{ commitSha: string; createdAt: Date }[]> {
    const cached = await this.cacheRepository.find({
      where: { provider, organization, repository },
      order: { createdAt: 'DESC' },
      select: ['commitSha', 'createdAt'],
    })

    return cached.map((c) => ({
      commitSha: c.commitSha,
      createdAt: c.createdAt,
    }))
  }

  /**
   * Find a specific cached version
   */
  private async findByCommit(
    provider: GitProvider,
    organization: string,
    repository: string,
    commitSha: string
  ): Promise<RepositoryCache | null> {
    return this.cacheRepository.findOne({
      where: { provider, organization, repository, commitSha },
    })
  }

  /**
   * Find the latest cached version (fallback for errors)
   */
  private async findLatestCached(
    provider: GitProvider,
    organization: string,
    repository: string
  ): Promise<RepositoryCache | null> {
    const results = await this.cacheRepository.find({
      where: { provider, organization, repository },
      order: { createdAt: 'DESC' },
      take: 1,
    })

    return results[0] || null
  }

  /**
   * Save a version to the cache
   */
  private async saveToCache(
    provider: GitProvider,
    organization: string,
    repository: string,
    commitSha: string,
    content: LuminaJson
  ): Promise<RepositoryCache> {
    const entity = this.cacheRepository.create({
      provider,
      organization,
      repository,
      commitSha,
      content,
    })

    const saved = await this.cacheRepository.save(entity)
    this.logger.debug(
      `Cached ${organization}/${repository} @ ${commitSha.substring(0, 7)}`
    )

    return saved
  }
}

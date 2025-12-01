import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface FreshnessEntry {
  commitSha: string
  checkedAt: number
}

/**
 * In-memory cache for tracking when we last checked a repository's commit SHA.
 * Used to avoid hammering GitHub/GitLab APIs with repeated commit SHA checks.
 */
@Injectable()
export class FreshnessCacheService {
  private readonly logger = new Logger(FreshnessCacheService.name)
  private readonly cache = new Map<string, FreshnessEntry>()
  private readonly ttlMs: number

  constructor(private readonly configService: ConfigService) {
    this.ttlMs = this.configService.get<number>('FRESHNESS_TTL_MS', 60000)
    this.logger.log(`Freshness cache TTL: ${this.ttlMs}ms`)
  }

  /**
   * Generate cache key for a repository
   */
  private getKey(
    provider: string,
    organization: string,
    repository: string
  ): string {
    return `${provider}:${organization}/${repository}`
  }

  /**
   * Get the cached commit SHA if it's still fresh
   * Returns null if the entry doesn't exist or has expired
   */
  getFreshCommitSha(
    provider: string,
    organization: string,
    repository: string
  ): string | null {
    const key = this.getKey(provider, organization, repository)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const age = Date.now() - entry.checkedAt
    if (age > this.ttlMs) {
      this.cache.delete(key)
      this.logger.debug(`Freshness cache expired for ${key}`)
      return null
    }

    this.logger.debug(`Freshness cache hit for ${key} (age: ${age}ms)`)
    return entry.commitSha
  }

  /**
   * Update the cached commit SHA for a repository
   */
  setFreshCommitSha(
    provider: string,
    organization: string,
    repository: string,
    commitSha: string
  ): void {
    const key = this.getKey(provider, organization, repository)
    this.cache.set(key, {
      commitSha,
      checkedAt: Date.now(),
    })
    this.logger.debug(`Freshness cache set for ${key}: ${commitSha.substring(0, 7)}`)
  }

  /**
   * Invalidate the cache for a repository
   * Call this on rate limit errors to force a fresh check next time
   */
  invalidate(
    provider: string,
    organization: string,
    repository: string
  ): void {
    const key = this.getKey(provider, organization, repository)
    this.cache.delete(key)
    this.logger.debug(`Freshness cache invalidated for ${key}`)
  }

  /**
   * Clear all cached entries
   */
  clearAll(): void {
    this.cache.clear()
    this.logger.debug('Freshness cache cleared')
  }
}

import { Injectable, Logger } from '@nestjs/common'

/**
 * Service to deduplicate concurrent requests for the same repository.
 * When multiple requests come in for the same repo at the same time,
 * only one actual fetch is performed and all requests share the result.
 */
@Injectable()
export class RequestDedupService {
  private readonly logger = new Logger(RequestDedupService.name)
  private readonly pending = new Map<string, Promise<unknown>>()

  /**
   * Generate a unique key for a request
   */
  private getKey(
    provider: string,
    organization: string,
    repository: string,
    sha?: string
  ): string {
    return `${provider}:${organization}/${repository}${sha ? `@${sha}` : ''}`
  }

  /**
   * Execute a function with deduplication.
   * If another request for the same key is already in progress,
   * this will wait for and return that result instead of executing again.
   */
  async dedupe<T>(
    provider: string,
    organization: string,
    repository: string,
    sha: string | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const key = this.getKey(provider, organization, repository, sha)

    // Check if there's already a pending request
    const existing = this.pending.get(key)
    if (existing) {
      this.logger.debug(`Deduplicating request for ${key}`)
      return existing as Promise<T>
    }

    // Create the promise and store it
    const promise = fn()
      .finally(() => {
        // Clean up after completion
        this.pending.delete(key)
      })

    this.pending.set(key, promise)
    this.logger.debug(`Starting new request for ${key}`)

    return promise
  }

  /**
   * Check if there's a pending request for a key
   */
  hasPending(
    provider: string,
    organization: string,
    repository: string,
    sha?: string
  ): boolean {
    const key = this.getKey(provider, organization, repository, sha)
    return this.pending.has(key)
  }

  /**
   * Get the number of pending requests (for monitoring)
   */
  getPendingCount(): number {
    return this.pending.size
  }
}

import { Injectable, Logger } from '@nestjs/common'
import type { GitProvider } from '../repositories/entities/repository-cache.entity.js'
import { GitHubService, type FetchResult } from './github.service.js'
import { GitLabService } from './gitlab.service.js'

@Injectable()
export class GitProvidersService {
  private readonly logger = new Logger(GitProvidersService.name)

  constructor(
    private readonly githubService: GitHubService,
    private readonly gitlabService: GitLabService
  ) {}

  /**
   * Get the latest commit SHA for lumina.json
   */
  async getLatestCommitSha(
    provider: GitProvider,
    organization: string,
    repository: string
  ): Promise<string> {
    this.logger.debug(
      `Getting latest commit SHA from ${provider}: ${organization}/${repository}`
    )

    if (provider === 'github') {
      return this.githubService.getLatestCommitSha(organization, repository)
    }
    return this.gitlabService.getLatestCommitSha(organization, repository)
  }

  /**
   * Fetch lumina.json from the provider
   */
  async fetchLuminaJson(
    provider: GitProvider,
    organization: string,
    repository: string,
    sha?: string
  ): Promise<FetchResult> {
    this.logger.debug(
      `Fetching lumina.json from ${provider}: ${organization}/${repository}${sha ? ` @ ${sha.substring(0, 7)}` : ''}`
    )

    if (provider === 'github') {
      return this.githubService.fetchLuminaJson(organization, repository, sha)
    }
    return this.gitlabService.fetchLuminaJson(organization, repository, sha)
  }
}

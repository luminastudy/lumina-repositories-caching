import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import type { LuminaJson } from '../repositories/entities/repository-cache.entity.js'

export interface FetchResult {
  luminaJson: LuminaJson
  commitSha: string
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name)
  private readonly octokit: Octokit

  constructor() {
    // No auth - public API only (60 requests/hour limit)
    this.octokit = new Octokit()
  }

  /**
   * Get the latest commit SHA for lumina.json in a repository
   */
  async getLatestCommitSha(
    organization: string,
    repository: string
  ): Promise<string> {
    this.logger.debug(
      `Getting latest commit SHA for ${organization}/${repository}`
    )

    const { data: commits } = await this.octokit.repos.listCommits({
      owner: organization,
      repo: repository,
      path: 'lumina.json',
      per_page: 1,
    })

    if (commits.length === 0 || !commits[0]) {
      throw new NotFoundException(
        `No commits found for lumina.json in ${organization}/${repository}`
      )
    }

    return commits[0].sha
  }

  /**
   * Get the default branch for a repository
   */
  private async getDefaultBranch(
    organization: string,
    repository: string
  ): Promise<string> {
    const { data: repoData } = await this.octokit.repos.get({
      owner: organization,
      repo: repository,
    })
    return repoData.default_branch
  }

  /**
   * Fetch lumina.json content from a repository
   * @param sha - Optional specific commit SHA. If not provided, fetches from default branch
   */
  async fetchLuminaJson(
    organization: string,
    repository: string,
    sha?: string
  ): Promise<FetchResult> {
    this.logger.debug(
      `Fetching lumina.json from GitHub ${organization}/${repository}${sha ? ` @ ${sha.substring(0, 7)}` : ''}`
    )

    const ref = sha || (await this.getDefaultBranch(organization, repository))

    const { data } = await this.octokit.repos.getContent({
      owner: organization,
      repo: repository,
      path: 'lumina.json',
      ref,
    })

    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
      throw new NotFoundException(
        `lumina.json is not a file in ${organization}/${repository}`
      )
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    const parsedContent = JSON.parse(content)

    // Validate structure - lumina.json can be either:
    // 1. An array of blocks directly
    // 2. An object with a 'blocks' property
    let luminaJson: LuminaJson
    if (Array.isArray(parsedContent)) {
      // Array format - wrap in object for consistent interface
      luminaJson = { blocks: parsedContent }
    } else if (
      parsedContent &&
      typeof parsedContent === 'object' &&
      'blocks' in parsedContent &&
      Array.isArray(parsedContent.blocks)
    ) {
      luminaJson = parsedContent as LuminaJson
    } else {
      throw new Error(
        'Invalid lumina.json format: expected array or object with blocks property'
      )
    }

    // Get the commit SHA for this version
    const commitSha =
      sha || (await this.getLatestCommitSha(organization, repository))

    return {
      luminaJson,
      commitSha,
    }
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Gitlab } from '@gitbeaker/rest'
import type { LuminaJson } from '../repositories/entities/repository-cache.entity.js'

export interface FetchResult {
  luminaJson: LuminaJson
  commitSha: string
}

@Injectable()
export class GitLabService {
  private readonly logger = new Logger(GitLabService.name)
  private readonly gitlab: InstanceType<typeof Gitlab>

  constructor() {
    // No auth - public API only
    this.gitlab = new Gitlab({})
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

    const projectId = `${organization}/${repository}`

    const commits = await this.gitlab.Commits.all(projectId, {
      path: 'lumina.json',
      perPage: 1,
    })

    if (commits.length === 0 || !commits[0]) {
      throw new NotFoundException(
        `No commits found for lumina.json in ${organization}/${repository}`
      )
    }

    const commitId = commits[0].id
    if (!commitId) {
      throw new NotFoundException('Commit has no ID')
    }

    return commitId
  }

  /**
   * Fetch lumina.json content from a repository
   * @param sha - Optional specific commit SHA. If not provided, fetches from HEAD
   */
  async fetchLuminaJson(
    organization: string,
    repository: string,
    sha?: string
  ): Promise<FetchResult> {
    this.logger.debug(
      `Fetching lumina.json from GitLab ${organization}/${repository}${sha ? ` @ ${sha.substring(0, 7)}` : ''}`
    )

    const projectId = `${organization}/${repository}`
    const ref = sha || 'HEAD'

    const file = await this.gitlab.RepositoryFiles.show(
      projectId,
      'lumina.json',
      ref
    )

    const content = Buffer.from(file.content, 'base64').toString('utf-8')
    const parsedContent = JSON.parse(content)

    // Validate structure
    if (
      !parsedContent ||
      typeof parsedContent !== 'object' ||
      !('blocks' in parsedContent) ||
      !Array.isArray(parsedContent.blocks)
    ) {
      throw new Error(
        'Invalid lumina.json format: missing or invalid blocks array'
      )
    }

    // Get the commit SHA for this version
    const commitSha =
      sha || (await this.getLatestCommitSha(organization, repository))

    return {
      luminaJson: parsedContent as LuminaJson,
      commitSha,
    }
  }
}

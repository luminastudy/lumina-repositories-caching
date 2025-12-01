import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { initTRPC } from '@trpc/server'
import type { TrpcContext } from '../trpc/trpc.context.js'
import { RepositoriesService } from './repositories.service.js'

const t = initTRPC.context<TrpcContext>().create()

const GitProviderSchema = z.enum(['github', 'gitlab'])

const GetInputSchema = z.object({
  provider: GitProviderSchema,
  organization: z.string().min(1),
  repository: z.string().min(1),
})

const GetByCommitInputSchema = z.object({
  provider: GitProviderSchema,
  organization: z.string().min(1),
  repository: z.string().min(1),
  commitSha: z.string().min(7).max(40),
})

const ListVersionsInputSchema = z.object({
  provider: GitProviderSchema,
  organization: z.string().min(1),
  repository: z.string().min(1),
})

const GetLatestCommitShaInputSchema = z.object({
  provider: GitProviderSchema,
  organization: z.string().min(1),
  repository: z.string().min(1),
})

@Injectable()
export class RepositoriesRouter {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  createRouter() {
    return t.router({
      /**
       * Get the latest lumina.json for a repository
       * Uses cache when possible, fetches from provider if stale
       */
      get: t.procedure.input(GetInputSchema).query(async ({ input }) => {
        const result = await this.repositoriesService.get(
          input.provider,
          input.organization,
          input.repository
        )

        return {
          luminaJson: result.luminaJson,
          commitSha: result.commitSha,
          cached: result.cached,
          provider: result.provider,
          organization: result.organization,
          repository: result.repository,
        }
      }),

      /**
       * Get lumina.json for a specific commit SHA
       * Useful for pinning to a specific version
       */
      getByCommit: t.procedure
        .input(GetByCommitInputSchema)
        .query(async ({ input }) => {
          const result = await this.repositoriesService.getByCommit(
            input.provider,
            input.organization,
            input.repository,
            input.commitSha
          )

          return {
            luminaJson: result.luminaJson,
            commitSha: result.commitSha,
            cached: result.cached,
            provider: result.provider,
            organization: result.organization,
            repository: result.repository,
          }
        }),

      /**
       * List all cached versions for a repository
       * Returns commit SHAs and timestamps
       */
      listVersions: t.procedure
        .input(ListVersionsInputSchema)
        .query(async ({ input }) => {
          const versions = await this.repositoriesService.listVersions(
            input.provider,
            input.organization,
            input.repository
          )

          return {
            provider: input.provider,
            organization: input.organization,
            repository: input.repository,
            versions,
          }
        }),

      /**
       * Get just the latest commit SHA for a repository's lumina.json
       * Lightweight endpoint for checking updates without fetching content
       */
      getLatestCommitSha: t.procedure
        .input(GetLatestCommitShaInputSchema)
        .query(async ({ input }) => {
          const commitSha = await this.repositoriesService.getLatestCommitSha(
            input.provider,
            input.organization,
            input.repository
          )

          return {
            provider: input.provider,
            organization: input.organization,
            repository: input.repository,
            commitSha,
          }
        }),
    })
  }
}

export type RepositoriesRouterType = ReturnType<RepositoriesRouter['createRouter']>

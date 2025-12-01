import { Module } from '@nestjs/common'
import { GitHubService } from './github.service.js'
import { GitLabService } from './gitlab.service.js'
import { GitProvidersService } from './git-providers.service.js'

@Module({
  providers: [GitHubService, GitLabService, GitProvidersService],
  exports: [GitProvidersService],
})
export class GitProvidersModule {}

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { GitProvidersModule } from '../git-providers/git-providers.module.js'
import { FreshnessModule } from '../freshness/freshness.module.js'
import { DedupModule } from '../dedup/dedup.module.js'
import { RepositoryCache } from './entities/repository-cache.entity.js'
import { RepositoriesService } from './repositories.service.js'
import { RepositoriesRouter } from './repositories.router.js'

@Module({
  imports: [
    TypeOrmModule.forFeature([RepositoryCache]),
    GitProvidersModule,
    FreshnessModule,
    DedupModule,
  ],
  providers: [RepositoriesService, RepositoriesRouter],
  exports: [RepositoriesService, RepositoriesRouter],
})
export class RepositoriesModule {}

import { Module } from '@nestjs/common'
import { FreshnessCacheService } from './freshness-cache.service.js'

@Module({
  providers: [FreshnessCacheService],
  exports: [FreshnessCacheService],
})
export class FreshnessModule {}

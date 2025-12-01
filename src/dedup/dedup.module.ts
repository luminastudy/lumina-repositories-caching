import { Module } from '@nestjs/common'
import { RequestDedupService } from './request-dedup.service.js'

@Module({
  providers: [RequestDedupService],
  exports: [RequestDedupService],
})
export class DedupModule {}

import { Module } from '@nestjs/common'
import { RepositoriesModule } from '../repositories/repositories.module.js'
import { TrpcRouter } from './trpc.router.js'

@Module({
  imports: [RepositoriesModule],
  providers: [TrpcRouter],
  exports: [TrpcRouter],
})
export class TrpcModule {}

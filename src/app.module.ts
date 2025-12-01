import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TrpcModule } from './trpc/trpc.module.js'
import { HealthModule } from './health/health.module.js'
import { RepositoryCache } from './repositories/entities/repository-cache.entity.js'
import { environmentConfig } from './config/environment.config.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [environmentConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mongodb',
        url: configService.get<string>('MONGODB_URI'),
        database: configService.get<string>('MONGODB_DATABASE', 'repositories_cache'),
        entities: [RepositoryCache],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    TrpcModule,
    HealthModule,
  ],
})
export class AppModule {}

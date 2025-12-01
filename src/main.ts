import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module.js'
import { TrpcRouter } from './trpc/trpc.router.js'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create(AppModule)

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })

  // Apply tRPC middleware
  const trpcRouter = app.get(TrpcRouter)
  await trpcRouter.applyMiddleware(app)

  const port = process.env.PORT || 3000
  await app.listen(port)

  logger.log(`Application is running on: http://localhost:${port}`)
  logger.log(`tRPC endpoint: http://localhost:${port}/trpc`)
}

bootstrap()

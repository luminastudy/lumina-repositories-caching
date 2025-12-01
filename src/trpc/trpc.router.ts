import { INestApplication, Injectable } from '@nestjs/common'
import { initTRPC, type AnyRouter } from '@trpc/server'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { RepositoriesRouter } from '../repositories/repositories.router.js'
import { createContext, type TrpcContext } from './trpc.context.js'

const t = initTRPC.context<TrpcContext>().create()

export const router = t.router
export const publicProcedure = t.procedure

@Injectable()
export class TrpcRouter {
  private _appRouter: AnyRouter | null = null

  constructor(private readonly repositoriesRouter: RepositoriesRouter) {}

  get appRouter(): AnyRouter {
    if (!this._appRouter) {
      this._appRouter = router({
        repositories: this.repositoriesRouter.createRouter(),
      })
    }
    return this._appRouter
  }

  async applyMiddleware(app: INestApplication) {
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: this.appRouter,
        createContext,
      })
    )
  }
}

export type AppRouter = ReturnType<TrpcRouter['appRouter']['createCaller']>

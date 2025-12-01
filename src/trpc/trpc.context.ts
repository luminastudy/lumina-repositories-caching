import type { Request, Response } from 'express'

export interface TrpcContext {
  req: Request
  res: Response
}

export function createContext({
  req,
  res,
}: {
  req: Request
  res: Response
}): TrpcContext {
  return { req, res }
}

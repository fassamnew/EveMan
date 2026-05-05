import type { NextFunction, Response } from 'express';
import type { RequestWithAuth } from './request-with-auth';

export function tenantContextMiddleware(req: RequestWithAuth, _res: Response, next: NextFunction): void {
  const fromPath = req.params.orgCode;
  if (typeof fromPath === 'string' && fromPath.length > 0) {
    req.tenantCode = fromPath;
  }

  next();
}

import type { Request } from 'express';
import type { AuthContext } from './auth.types';

export type RequestWithAuth = Request & {
  auth?: AuthContext;
  tenantCode?: string;
};

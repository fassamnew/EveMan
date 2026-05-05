import type { RoleName } from '@prisma/client';

export type AuthContext = {
  userId: string;
  email: string;
  roles: RoleName[];
  organizationId: string | null;
  organizationCode: string | null;
};

export const SUPER_ADMIN_ROLE: RoleName = 'SUPER_ADMIN';

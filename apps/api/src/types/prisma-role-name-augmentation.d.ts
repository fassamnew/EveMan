import '@prisma/client';

declare module '@prisma/client' {
  export type RoleName = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'ORG_STAFF';
}

export {};

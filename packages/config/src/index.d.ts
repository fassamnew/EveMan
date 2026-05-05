export type AppEnv = {
  API_PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  CORS_ORIGINS: string;
  DATABASE_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
};

export function readAppEnv(source?: Record<string, string | undefined>): AppEnv;

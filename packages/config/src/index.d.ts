export type AppEnv = {
  API_PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  CORS_ORIGINS: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL_DAYS: number;
  SECRET_MANAGER_PROVIDER?: 'aws';
  SECRET_MANAGER_REGION?: string;
  JWT_ACCESS_SECRET_ID?: string;
  JWT_REFRESH_SECRET_ID?: string;
  DATABASE_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  OTEL_ENABLED: boolean;
  OTEL_DEBUG: boolean;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
};

export function readAppEnv(source?: Record<string, string | undefined>): AppEnv;

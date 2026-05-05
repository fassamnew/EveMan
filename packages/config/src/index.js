const { z } = require('zod');

const booleanFromEnv = z.preprocess(value => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  API_PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3500'),
  DATABASE_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  OTEL_ENABLED: booleanFromEnv.default(true),
  OTEL_DEBUG: booleanFromEnv.default(false),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().default('http://localhost:4318/v1/traces'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('evemange-dev'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: booleanFromEnv.default(true)
});

function readAppEnv(source = process.env) {
  return envSchema.parse(source);
}

module.exports = {
  readAppEnv
};

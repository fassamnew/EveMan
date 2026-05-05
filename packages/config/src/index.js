const { z } = require('zod');

const envSchema = z.object({
  API_PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3500'),
  DATABASE_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379)
});

function readAppEnv(source = process.env) {
  return envSchema.parse(source);
}

module.exports = {
  readAppEnv
};

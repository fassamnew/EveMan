const test = require('node:test');
const assert = require('node:assert/strict');
const { readAppEnv } = require('./index');

test('readAppEnv provides defaults for local development', () => {
  const env = readAppEnv({});

  assert.equal(env.API_PORT, 5001);
  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.CORS_ORIGINS, 'http://localhost:3500');
  assert.equal(env.REDIS_HOST, 'localhost');
  assert.equal(env.REDIS_PORT, 6379);
  assert.equal(env.S3_ENDPOINT, 'http://localhost:9000');
});

test('readAppEnv parses overrides from string environment values', () => {
  const env = readAppEnv({
    API_PORT: '6000',
    REDIS_PORT: '6380',
    OTEL_ENABLED: 'false',
    S3_FORCE_PATH_STYLE: 'false'
  });

  assert.equal(env.API_PORT, 6000);
  assert.equal(env.REDIS_PORT, 6380);
  assert.equal(env.OTEL_ENABLED, false);
  assert.equal(env.S3_FORCE_PATH_STYLE, false);
});

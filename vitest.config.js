import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      JWT_SECRET: 'fixed-vitest-secret-value-with-at-least-32-characters',
      REQUIRE_AUTH_FOR_READ: 'false',
      WEBHOOK_URL: '',
      CHECK_RETENTION_DAYS: '30'
    }
  }
});

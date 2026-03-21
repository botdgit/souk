import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      STRIPE_SECRET_KEY: 'sk_test_placeholder_for_tests',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '*.config.js',
        'data/**',
        '.github/**'
      ],
      all: true,
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});

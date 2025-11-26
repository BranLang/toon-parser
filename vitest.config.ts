import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/?(*.)+(spec|test).ts'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      enabled: true,
      statements: 80,
      branches: 70,
      functions: 90,
      lines: 80
    }
  }
});

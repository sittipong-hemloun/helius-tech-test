import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC is required: esbuild does not emit decorator metadata, which Nest DI relies on.
const swcPlugin = swc.vite({
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
    target: 'es2023',
  },
  module: { type: 'es6' },
});

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['test/support/global-setup.ts'],
          // One PostgreSQL database per run; files share it, so run them one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: '../../test-results/api-junit.xml' },
  },
});

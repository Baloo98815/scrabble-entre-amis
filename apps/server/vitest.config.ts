import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['./test/setupEnv.ts'],
  },
});

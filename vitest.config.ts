// vitest.config.ts
//
// Vitest setup for the project. Resolves the @/ path alias the same way
// tsconfig.json does, runs in Node, and loads vitest.setup.ts before
// any test imports so DB-touching tests can rebind env vars before
// lib/supabase.ts initializes its module-level client.

import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    setupFiles:  ['./vitest.setup.ts'],
    include:     ['**/*.test.ts'],
    // Tests touch a real Supabase DB. Run files in series so concurrent
    // suites don't fight over shared rows. Within a file, tests still run
    // in their declared order.
    fileParallelism: false,
  },
})

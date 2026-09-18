// vitest.admin.config.ts
//
// The Admin panel's own tests, run WITHOUT a database.
//
// The main config loads vitest.setup.ts, which refuses to run unless
// TEST_SUPABASE_URL points at a non-prod project — correct, because most
// suites in this repo touch real rows. The Admin honesty tests touch none:
// they read source files and exercise pure helpers, so requiring credentials
// to run them would mean they never get run.
//
// Keeping the guard intact and giving these their own entry point is the
// smaller change of the two.
//
//   npm run test:admin
//
// These same files also pass under the main config when credentials are
// present, so nothing is excluded there.

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
    include:     ['lib/admin/tests/**/*.test.ts'],
    // No setupFiles: nothing here needs Supabase, and anything that starts
    // needing it belongs in the main suite instead.
  },
})

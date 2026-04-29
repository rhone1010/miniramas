// vitest.setup.ts
//
// Loads .env.test and remaps test-only Supabase creds onto the env vars
// that lib/supabase.ts reads at module init. This file MUST run before
// any test imports the supabase client — it does, because Vitest
// processes setupFiles before transforming test modules.
//
// .env.test contains TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY,
// pointing at a non-prod Supabase project. The remap below makes them
// visible to lib/supabase.ts under its expected names without any code
// changes there.

import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'

loadDotenv({ path: resolve(process.cwd(), '.env.test') })

if (process.env.TEST_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL
}
if (process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
}

// Anon key is required by lib/supabase.ts even though admin tests never
// use it. If TEST_SUPABASE_ANON_KEY isn't set, fall back to the service
// role key so the module init doesn't blow up. (createClient with the
// service-role key under the anon-client-handle is fine — we never
// actually call methods on the anon client during tests.)
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.TEST_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'unused-during-tests'
}

// Hard guard: refuse to run if pointing at production by accident. Tests
// touch real rows, so we want a clear signal if .env.test isn't set up.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    'vitest.setup.ts: TEST_SUPABASE_URL is not set. Create .env.test with TEST_SUPABASE_URL ' +
    'and TEST_SUPABASE_SERVICE_ROLE_KEY pointing at a NON-PROD Supabase project before running tests.',
  )
}

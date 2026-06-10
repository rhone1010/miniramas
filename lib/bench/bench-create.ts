// lib/bench/bench-create.ts
//
// CLI for creating a run from a JSON config file, then (optionally)
// flipping it straight to 'running' so an attached worker starts
// claiming immediately.
//
// Usage:
//   npm run bench:create -- --config ./bench-configs/smoke.json
//   npm run bench:create -- --config ./bench-configs/smoke.json --start
//
// Example config file (./bench-configs/smoke.json):
// {
//   "label": "portraits-smoke-01",
//   "series": "portraits",
//   "sourceDir": "D:\\minramas\\bench-sources\\smoke",
//   "sourceLimit": 10,
//   "matrix": {
//     "presetIds":   ["alabaster"],
//     "styleIds":    ["realistic"],
//     "locationIds": ["pedestal"],
//     "scales":      ["close_up"]
//   },
//   "costCeilingCents": 500
// }
//
// Anything not in the file falls back to DEFAULT_RUN_CONFIG
// (classify on, redirect behavior, intake 6, fidelity 7, etc.).

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import { createRun } from './bench-runner'

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}

async function main(): Promise<void> {
  const cfgIdx  = process.argv.indexOf('--config')
  const cfgPath = cfgIdx >= 0 ? process.argv[cfgIdx + 1] : null
  const start   = process.argv.includes('--start')
  if (!cfgPath) {
    console.error('usage: bench:create -- --config <path.json> [--start]')
    process.exit(1)
  }

  const raw = JSON.parse(await fs.readFile(cfgPath, 'utf8'))
  if (!raw.label || !raw.series || !raw.sourceDir || !raw.matrix) {
    console.error('config requires: label, series, sourceDir, matrix')
    process.exit(1)
  }

  const keys = {
    supabaseUrl:        process.env.SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    replicateApiToken:  process.env.REPLICATE_API_TOKEN!,
    openaiApiKey:       process.env.OPENAI_API_KEY!,
    stabilityApiKey:    process.env.STABILITY_API_KEY,
  }

  const { label, ...config } = raw
  const { runId, totalItems } = await createRun({ keys, label, config })

  if (start) {
    const sb = createClient(keys.supabaseUrl, keys.supabaseServiceKey, {
      auth: { persistSession: false },
    })
    await sb.from('batch_runs').update({ status: 'running' }).eq('id', runId)
    console.log(`[bench-create] run started`)
  }

  console.log(`[bench-create] run ${runId} — ${totalItems} items, status ${start ? 'running' : 'draft'}`)
  console.log(`[bench-create] next: npm run bench -- --run ${runId}`)
}

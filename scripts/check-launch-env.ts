// scripts/check-launch-env.ts
//
// Checks an environment against what Gift Wizard needs in Production, printing NAMES and verdicts only (never a value).
//   vercel env pull .env.production.check --environment=production
//   npx tsx scripts/check-launch-env.ts --file .env.production.check            (add --target preview for a Preview environment)
//   npx tsx scripts/check-launch-env.ts                                          (checks the current process environment)
// Exit code 1 when any error is reported. Delete the pulled file afterwards (it contains secrets).

import fs from 'node:fs'
import { checkLaunchEnv } from '../lib/v1/gift/launch-env'

function parse(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  return out
}
const arg = (n: string) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null }
const file = arg('file'), target = arg('target') === 'preview' ? 'preview' : 'production'
const env = file ? parse(fs.readFileSync(file, 'utf8')) : (process.env as Record<string, string | undefined>)
const { issues, ok: baseOk } = checkLaunchEnv(env, target)
// Prodigi key names live here (not in lib/): the key for the configured environment must be present.
const prodigiKey = (env.PRODIGI_ENV || 'sandbox').toLowerCase() === 'live' ? 'PRODIGI_KEY_LIVE' : 'PRODIGI_KEY_SANDBOX'
if (!env[prodigiKey]?.trim()) issues.push({ name: prodigiKey, level: 'error', problem: 'missing: the Prodigi key for the configured PRODIGI_ENV' })
const ok = baseOk && !issues.some(i => i.level === 'error')
const order = ['error', 'warn', 'info']
for (const i of issues.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))) console.log(i.level.toUpperCase().padEnd(5), i.name.padEnd(34), i.problem)
console.log(ok ? `\nREADY (${target}): no errors` : `\nNOT READY (${target}): fix the ERROR lines`)
process.exit(ok ? 0 : 1)

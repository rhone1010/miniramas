// scripts/verify-webhook-secret.ts
//
// Proves a deployment's STRIPE_WEBHOOK_SECRET matches the secret you hold, WITHOUT touching any order: it signs a harmless event of a type the route ignores (customer.created) with the
// secret from THIS environment and posts it to the endpoint. 200 {received:true} = the deployed secret verifies this signature; 400 invalid_signature = it does not match; 503 = the deployment
// has no secret. The secret is never printed. Run it with the secret of the destination you are checking.
//   npx tsx --env-file=.env.production.check scripts/verify-webhook-secret.ts --url https://litenco.com/api/v1/webhooks/stripe

import Stripe from 'stripe'

async function main() {
  const i = process.argv.indexOf('--url'), url = i >= 0 ? process.argv[i + 1] : ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!/^https:\/\//.test(url)) throw new Error('usage: --url https://<host>/api/v1/webhooks/stripe')
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set in this environment')
  const payload = JSON.stringify({ id: 'evt_probe_' + Date.now(), object: 'event', api_version: '2024-04-10', created: Math.floor(Date.now() / 1000), type: 'customer.created', livemode: false, data: { object: { id: 'cus_probe', object: 'customer' } } })
  const header = new Stripe('sk_test_probe', { apiVersion: '2024-04-10' as any }).webhooks.generateTestHeaderString({ payload, secret })
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload })
  const body = await r.text()
  console.log(r.status, body.slice(0, 120))
  console.log(r.status === 200 ? 'MATCH: the deployment verifies signatures made with this secret' : r.status === 400 ? 'MISMATCH: the deployed secret differs from this one' : r.status === 503 ? 'NOT CONFIGURED: the deployment has no STRIPE_WEBHOOK_SECRET' : 'UNEXPECTED: check the endpoint and deployment protection')
  process.exit(r.status === 200 ? 0 : 1)
}
main().catch(e => { console.error('verify-webhook-secret:', e instanceof Error ? e.message : e); process.exit(1) })

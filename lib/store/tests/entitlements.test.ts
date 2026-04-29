// lib/store/tests/entitlements.test.ts
//
// Atomicity test for consumeEntitlement.
//
// We seed a single entitlement row in the test DB, then fire two
// consumeEntitlement() calls in parallel. The Postgres function
// consume_entitlement_atomic() is what makes this safe — its UPDATE has
// a status='available' guard so a second concurrent caller's update
// matches zero rows.
//
// Expectation: exactly one call returns { ok: true } and the other
// returns { ok: false, reason: 'already_consumed' }.
//
// Requires .env.test to point at a non-prod Supabase project that has
// migration 003 applied (the function is defined there).

import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import crypto from 'node:crypto'
import { consumeEntitlement } from '@/lib/store/entitlements'
import { supabaseAdmin } from '@/lib/supabase'

// Keep test rows isolated from any real data — unique IDs per run.
const RUN_ID    = crypto.randomBytes(6).toString('hex')
const TEST_SKU  = `vitest_${RUN_ID}`
const TEST_EMAIL = `vitest-${RUN_ID}@test.local`

let purchaseId: string
let entitlementId: string

beforeAll(async () => {
  // 1. Insert a throwaway SKU. Inactive so it can't appear in any UI.
  const { error: skuErr } = await supabaseAdmin.from('skus').insert({
    id:              TEST_SKU,
    display_name:    `Vitest run ${RUN_ID}`,
    kind:            'single',
    count:           1,
    price_cents:     100,
    stripe_price_id: `price_test_${RUN_ID}`,
    active:          false,
  })
  if (skuErr) throw new Error(`seed sku failed: ${skuErr.message}`)

  // 2. Insert a paid purchase referencing the SKU.
  const { data: purchase, error: pErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      guest_email:       TEST_EMAIL,
      sku_id:            TEST_SKU,
      stripe_session_id: `test_session_${RUN_ID}`,
      amount_cents:      100,
      status:            'paid',
      paid_at:           new Date().toISOString(),
    })
    .select()
    .single()
  if (pErr) throw new Error(`seed purchase failed: ${pErr.message}`)
  purchaseId = purchase.id

  // 3. Insert one available entitlement. Locked to a specific style+variant
  //    so the consumeEntitlement guard exercises the locked branch.
  const { data: ent, error: eErr } = await supabaseAdmin
    .from('entitlements')
    .insert({
      purchase_id:    purchaseId,
      guest_email:    TEST_EMAIL,
      locked_style:   'figurine',
      locked_variant: 'standard',
      status:         'available',
    })
    .select()
    .single()
  if (eErr) throw new Error(`seed entitlement failed: ${eErr.message}`)
  entitlementId = ent.id
})

afterAll(async () => {
  // Best-effort cleanup. Order matters because of FKs:
  //   entitlements (FK→purchases) → purchases (FK→skus) → skus
  if (entitlementId) {
    await supabaseAdmin.from('entitlements').delete().eq('id', entitlementId)
  }
  if (purchaseId) {
    await supabaseAdmin.from('purchases').delete().eq('id', purchaseId)
  }
  await supabaseAdmin.from('skus').delete().eq('id', TEST_SKU)
})

describe('consumeEntitlement — race condition', () => {
  it('exactly one of two concurrent consumes succeeds', async () => {
    const jobA = crypto.randomUUID()
    const jobB = crypto.randomUUID()

    const [a, b] = await Promise.all([
      consumeEntitlement({
        entitlementId,
        jobId:      jobA,
        style:      'figurine',
        variant:    'standard',
        guestEmail: TEST_EMAIL,
      }),
      consumeEntitlement({
        entitlementId,
        jobId:      jobB,
        style:      'figurine',
        variant:    'standard',
        guestEmail: TEST_EMAIL,
      }),
    ])

    const successes = [a, b].filter((r) => r.ok === true)
    const failures  = [a, b].filter((r) => r.ok === false)

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)

    const failure = failures[0]
    if (failure.ok === false) {
      expect(failure.reason).toBe('already_consumed')
    }

    // Verify the DB ended up in the expected state:
    // - status = 'consumed'
    // - job_id = the winner's jobId (not the loser's)
    const { data: row, error } = await supabaseAdmin
      .from('entitlements')
      .select('status, job_id')
      .eq('id', entitlementId)
      .single()
    if (error) throw new Error(`post-check read failed: ${error.message}`)

    expect(row.status).toBe('consumed')
    expect([jobA, jobB]).toContain(row.job_id)
  })
})

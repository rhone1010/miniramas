// Final approval over HTTP against the walk server (real handlers + memory store mirroring migration 056), then in the real browser after a reload.
// Fine Art 12x18 paid journey through the UI to Final Approval, then: approve every line, POST /finalize x1 and x5 concurrently, GET + restore, order row untouched, reload the page.
const { open, snap, state, reset, BASE } = require('./lib.cjs')
const { toProducts } = require('./w6.cjs')
const J = async (path, opts) => { const r = await fetch(BASE + path, opts); return { status: r.status, body: await r.json().catch(() => null) } }
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await toProducts(page, problems)
  // The Product step changed under Codex's redesign, so the cart is set through the API (the backend contract); the browser is used for the reload check below.
  const sid0 = (await J('/api/v1/gift/sessions')).body.current.sessionId
  console.log('set lines ->', (await J(`/api/v1/gift/sessions/${sid0}/lines`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }] }) })).status)
  await fetch(BASE + '/__walk/pay'); await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'networkidle' })
  for (let i = 0; i < 12; i++) { const r = await J(`/api/v1/gift/sessions/${sid0}/compositions`); if (r.status === 200 && r.body.compositions.every(c => c.status === 'ready')) break; await new Promise(r => setTimeout(r, 2500)) }
  const s = (await J('/api/v1/gift/sessions')).body.current, sid = s.sessionId
  console.log('BEFORE  order', JSON.stringify({ state: s.order.state, manufacturing: s.order.manufacturing, finalApprovedAt: s.order.finalApprovedAt }), 'compositions', s.compositions.map(c => c.status))
  console.log('finalize before approving lines ->', JSON.stringify((({ status, body }) => ({ status, error: body.error }))(await J(`/api/v1/gift/sessions/${sid}/finalize`, { method: 'POST' }))))
  for (const c of s.compositions) await J(`/api/v1/gift/sessions/${sid}/compositions/${c.compositionId}/approve`, { method: 'POST' })
  const one = await J(`/api/v1/gift/sessions/${sid}/finalize`, { method: 'POST' })
  console.log('finalize ->', one.status, JSON.stringify({ state: one.body.order.state, manufacturing: one.body.order.manufacturing, finalApprovedAt: !!one.body.order.finalApprovedAt, releasedAt: one.body.order.releasedAt, unlock: !!one.body.order.unlockPortfolioId }))
  const many = await Promise.all([1, 2, 3, 4, 5].map(() => J(`/api/v1/gift/sessions/${sid}/finalize`, { method: 'POST' })))
  console.log('5 concurrent repeats ->', many.map(x => x.status).join(','), 'same approval time:', new Set(many.map(x => x.body.order.finalApprovedAt)).size === 1 && many[0].body.order.finalApprovedAt === one.body.order.finalApprovedAt)
  const after = (await J('/api/v1/gift/sessions')).body
  console.log('RESTORE order', JSON.stringify({ state: after.current.order.state, manufacturing: after.current.order.manufacturing }), 'suggestedStep', after.resume.suggestedStep, 'compositions', after.current.compositions.map(c => [c.status, c.correctionsRemaining].join('/')))
  const blocked = await J(`/api/v1/gift/sessions/${sid}/compositions/${after.current.compositions[0].lineId}/correct`, { method: 'POST' }); console.log('correction after approval ->', blocked.status, blocked.body.error)
  const st = await state(); console.log('walk server: paid generations', st.genCalls)
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(6000)
  const ui = await page.evaluate(() => { const b = document.getElementById('primary'); return { view: document.getElementById('screen').dataset.view, primary: b ? b.textContent.trim() + (b.disabled ? ' [DISABLED]' : ' [enabled]') : null, text: document.getElementById('screen').innerText.replace(/\s+/g, ' ').slice(0, 260) } })
  console.log('BROWSER after reload:', JSON.stringify(ui)); await snap(page, '80-approved-after-reload')
  console.log('console/network problems:', problems.length ? problems.slice(0, 4) : 'none')
  await browser.close()
})()

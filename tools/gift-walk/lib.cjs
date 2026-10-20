const { chromium } = require('E:/Dev/_recovery-staging/rail-verify/node_modules/playwright-core')
const sharp = require('E:/Dev/_recovery-staging/vw-push/node_modules/sharp')
const fs = require('fs')
const OUT = 'E:/Dev/_recovery-staging/frontend-deploy-review/walk-20261019/'
fs.mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:3777'
async function open(viewport = { width: 1660, height: 900 }, storage) {
  const browser = await chromium.launch({ headless: true, executablePath: 'C://Program Files//Google//Chrome//Application//chrome.exe' })
  const context = await browser.newContext({ viewport, storageState: storage })
  const page = await context.newPage()
  const problems = []
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push('console.' + m.type() + ': ' + m.text().slice(0, 220)) })
  page.on('pageerror', e => problems.push('pageerror: ' + String(e).slice(0, 220)))
  page.on('requestfailed', r => problems.push('requestfailed: ' + r.url().replace(BASE, '')))
  page.on('response', r => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url().replace(BASE, '')) })
  return { browser, context, page, problems }
}
async function snap(page, name) { await page.screenshot({ path: OUT + name + '.png' }); return OUT + name + '.png' }
async function report(page, problems, label) {
  const view = await page.evaluate(() => document.getElementById('screen')?.dataset.view || '(no screen)')
  const primary = await page.evaluate(() => { const b = document.getElementById('primary'); return b ? { text: b.textContent.trim(), disabled: b.disabled, visible: (() => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0 })() } : null })
  const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.textContent.trim().slice(0, 40) + (b.disabled ? ' [disabled]' : ''))).slice(0, 30))
  const text = (await page.locator('#screen').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)
  const err = await page.evaluate(() => document.getElementById('error')?.textContent || '')
  console.log(`--- ${label}\nview=${view} primary=${JSON.stringify(primary)} error=${JSON.stringify(err)}\nbuttons=${JSON.stringify(buttons)}\ntext=${text}\nproblems=${JSON.stringify([...new Set(problems)])}`)
}
const photoPath = async () => { const p = 'E:/Dev/_recovery-staging/frontend-deploy-review/walk-20261019/walker-photo-' + Date.now() + '.jpg'; await sharp('E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/scene-completion-2026-10-19/portraits-fine_art-generated.png').resize(1100 + Math.floor(Math.random() * 200), 1100 + Math.floor(Math.random() * 200), { fit: 'cover' }).jpeg({ quality: 70 + Math.floor(Math.random() * 20) }).toFile(p); return p }
const state = async () => (await fetch(BASE + '/__walk/state')).json()
module.exports = { open, snap, report, photoPath, state, OUT, BASE }
module.exports.reset = async () => { for (let i = 0; i < 6; i++) { const r = await (await fetch(BASE + '/api/v1/gift/sessions')).json(); if (!r.current) return; await fetch(BASE + '/api/v1/gift/sessions/' + r.current.sessionId, { method: 'DELETE' }) } }

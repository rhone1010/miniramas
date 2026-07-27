// Headless boot harness — extracts the inline <script> blocks and runs the
// engine with a permissive DOM stub to catch TDZ / ordering / runtime faults at
// boot (what braces + tsc cannot). Usage: node boot-test.js <file.html>
const fs = require('fs')
const html = fs.readFileSync(process.argv[2], 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])

const NUM_PROPS = new Set(['offsetWidth','offsetHeight','offsetTop','offsetLeft','clientWidth','clientHeight',
  'clientTop','clientLeft','scrollWidth','scrollHeight','scrollTop','scrollLeft','naturalWidth','naturalHeight',
  'innerWidth','innerHeight','pageXOffset','pageYOffset','x','y','width','height','top','left','right','bottom'])
function stub() {
  return new Proxy(function () {}, {
    get(_t, k) {
      if (k === 'style') return stub()
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false } }
      if (k === 'dataset') return {}
      if (k === 'children' || k === 'files' || k === 'childNodes') return []
      if (k === 'value' || k === 'textContent' || k === 'innerHTML' || k === 'src' || k === 'className') return ''
      if (k === 'length') return 0
      if (k === 'getBoundingClientRect') return () => ({ x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 })
      if (typeof k === 'string' && NUM_PROPS.has(k)) return 0
      if (k === Symbol.toPrimitive) return () => 0
      if (k === Symbol.iterator) return [][Symbol.iterator].bind([])
      return stub()
    },
    set() { return true },
    apply() { return stub() },
    has() { return true },
  })
}
const listeny = { getItem() { return null }, setItem() {}, removeItem() {} }
global.document = new Proxy({}, { get(_t, k) {
  if (k === 'getElementById' || k === 'querySelector') return () => stub()
  if (k === 'querySelectorAll') return () => []
  if (k === 'createElement' || k === 'createElementNS') return () => stub()
  if (k === 'addEventListener' || k === 'removeEventListener') return () => {}
  if (k === 'body' || k === 'documentElement' || k === 'head') return stub()
  if (k === 'fonts') return { ready: Promise.resolve(), addEventListener() {} }
  if (k === 'cookie') return ''
  return stub()
}, set() { return true } })
global.window = new Proxy({}, { get(_t, k) {
  if (k === 'matchMedia') return () => ({ matches: false, addEventListener() {}, addListener() {} })
  if (k === 'location') return { href: '', reload() {}, search: '' }
  if (k === 'localStorage' || k === 'sessionStorage') return listeny
  if (k === 'addEventListener' || k === 'removeEventListener') return () => {}
  if (k === 'getComputedStyle') return () => stub()
  if (k === 'requestAnimationFrame') return (cb) => setTimeout(cb, 0)
  return stub()
}, set() { return true } })
global.navigator = { userAgent: '', language: 'en', clipboard: { writeText() {} } }
global.localStorage = listeny
global.sessionStorage = listeny
global.location = { href: '', reload() {}, search: '' }
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), blob: () => Promise.resolve({}) })
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.ResizeObserver = class { observe() {} disconnect() {} }
global.MutationObserver = class { observe() {} disconnect() {} }
global.URL = global.URL || class { constructor() {} static createObjectURL() { return '' } static revokeObjectURL() {} }
global.FileReader = class { readAsDataURL() {} }
global.Image = class {}

const engine = scripts.slice().sort((a, b) => b.length - a.length)[0] || ''
try {
  new Function(engine)()
  console.log('BOOT OK — engine script ran with no synchronous throw')
} catch (e) {
  console.log('BOOT THREW:', e.message)
  console.log((e.stack || '').split('\n').slice(0, 4).join('\n'))
  process.exitCode = 1
}

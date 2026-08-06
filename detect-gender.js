// detect-gender.js
// Liten and Co - STEP 1. Gender + age detection over a folder of photographs.
//
// Standalone. Touches no engine file, renders nothing, writes nothing except
// a CSV of results. Uses the same model and the same JSON discipline the
// engine uses, so a good hit rate here means the engine can rely on it.
//
//   node detect-gender.js                     (defaults to _test_source_aug3)
//   node detect-gender.js D:\some\other\folder
//
// Prints one row per image and a summary. Writes detect-gender.csv.

const fs   = require('fs')
const path = require('path')

const REPO   = 'D:\\minramas'
const FOLDER = process.argv[2] || path.join(REPO, '_test_source_aug3')
const OUT    = path.join(REPO, 'detect-gender.csv')

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const MODEL     = 'gpt-4o'
const CONCURRENCY = 4

const PROMPT = `You are looking at a source photograph of one person. Report only what is visible.

Return:
- "gender": the apparent gender presentation of the hero subject. "f" (female) or "m" (male). Use your best visual estimate; do not return null.
- "age_group": one of "child" (roughly 0-11), "teen" (12-17), "young" (18-29), "adult" (30-49), "mature" (50-64), "senior" (65+).
- "confidence": "high", "medium" or "low" - how certain you are about the gender call specifically.
- "note": at most twelve words on anything that made the call hard. Empty string if nothing did.

Respond with ONLY a JSON object:
{"gender":"f","age_group":"adult","confidence":"high","note":""}

No preamble, no markdown.`

function readKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const p = path.join(REPO, '.env.local')
  if (!fs.existsSync(p)) return null
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

function mimeFor(f) {
  const e = path.extname(f).toLowerCase()
  if (e === '.png')  return 'image/png'
  if (e === '.webp') return 'image/webp'
  return 'image/jpeg'
}

async function detect(file, key) {
  const b64 = fs.readFileSync(file).toString('base64')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: {
              url: `data:${mimeFor(file)};base64,${b64}`, detail: 'high' } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })

  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 140)}`)

  const data = await res.json()
  const raw  = data.choices?.[0]?.message?.content || '{}'
  const p    = JSON.parse(raw)

  return {
    gender:     p.gender === 'f' || p.gender === 'm' ? p.gender : null,
    age_group:  typeof p.age_group === 'string' ? p.age_group : null,
    confidence: typeof p.confidence === 'string' ? p.confidence : null,
    note:       typeof p.note === 'string' ? p.note.slice(0, 80) : '',
  }
}

// A filename containing man/woman/boy/girl is treated as the expected answer,
// so the hit rate is computed automatically where the name allows it.
function expectedFrom(name) {
  const n = name.toLowerCase()
  if (n.includes('woman') || n.includes('girl') || n.includes('female') || /-f-|_f_/.test(n)) return 'f'
  if (n.includes('man')   || n.includes('boy')  || n.includes('male')   || /-m-|_m_/.test(n)) return 'm'
  return null
}

async function main() {
  if (!fs.existsSync(FOLDER)) {
    console.log(`\nFolder not found: ${FOLDER}\n`); return
  }

  const key = readKey()
  if (!key) { console.log('\nOPENAI_API_KEY not found in env or .env.local\n'); return }

  const files = fs.readdirSync(FOLDER)
    .filter(f => IMAGE_EXT.includes(path.extname(f).toLowerCase()))
    .sort()

  if (files.length === 0) { console.log(`\nNo images in ${FOLDER}\n`); return }

  console.log(`\n${files.length} image(s) in ${FOLDER}\n`)

  const rows = new Array(files.length)
  let next = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= files.length) return
      const f = files[i]
      try {
        const r = await detect(path.join(FOLDER, f), key)
        rows[i] = { file: f, ...r, error: '' }
      } catch (e) {
        rows[i] = { file: f, gender: null, age_group: null, confidence: null, note: '', error: e.message }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const pad = Math.max(...files.map(f => f.length)) + 2
  let hits = 0, checked = 0, nulls = 0

  console.log('file'.padEnd(pad) + 'gender  age      conf    match  note')
  console.log('-'.repeat(pad + 44))

  for (const r of rows) {
    if (r.error) { console.log(r.file.padEnd(pad) + 'ERROR   ' + r.error); continue }
    if (!r.gender) nulls++

    const exp = expectedFrom(r.file)
    let match = '-'
    if (exp) {
      checked++
      if (exp === r.gender) { match = 'ok';   hits++ }
      else                  { match = 'MISS' }
    }

    console.log(
      r.file.padEnd(pad) +
      String(r.gender || '?').padEnd(8) +
      String(r.age_group || '?').padEnd(9) +
      String(r.confidence || '?').padEnd(8) +
      match.padEnd(7) +
      r.note,
    )
  }

  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`
  fs.writeFileSync(OUT,
    'file,gender,age_group,confidence,expected,match,note,error\n' +
    rows.map(r => {
      const exp = expectedFrom(r.file)
      const m = !exp ? '' : (exp === r.gender ? 'ok' : 'MISS')
      return [r.file, r.gender, r.age_group, r.confidence, exp, m, r.note, r.error].map(esc).join(',')
    }).join('\n') + '\n')

  console.log('')
  if (checked > 0) {
    console.log(`gender hit rate : ${hits}/${checked} (filenames that state a gender)`)
  }
  console.log(`null gender     : ${nulls}`)
  console.log(`csv             : ${OUT}`)
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })

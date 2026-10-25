import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { analyzeSourceSet } from '../lib/v1/groups/groups-refine'
async function main() {
  const dirs = ['H:/litenco groups/images', 'H:/litenco groups/October', 'H:/litenco groups/images/retired', 'E:/Dev/liten-auth-return-preview-20261005/LitenBench/sources']
  const files = dirs.flatMap(d => fs.readdirSync(d).filter(f => /\.(jpe?g|png)$/i.test(f)).filter(f => !(d.includes('LitenBench') && !/^(group_|portrait_|best)/.test(f))).map(f => path.join(d, f)))
  const out: any[] = []
  for (const f of files) {
    try {
      const jpg = await sharp(fs.readFileSync(f)).rotate().jpeg({ quality: 90 }).toBuffer()
      const r: any = await analyzeSourceSet({ primaryB64: jpg.toString('base64'), openaiApiKey: process.env.OPENAI_API_KEY || '' })
      out.push({ file: f, w: (await sharp(jpg).metadata()).width, h: (await sharp(jpg).metadata()).height, total: r.total_subjects, faces: r.per_photo?.[0]?.faces?.length ?? null, verdict: r.verdict, smallest: r.smallest_face_min_dim_px })
      console.log(String(r.total_subjects).padStart(3), String(r.per_photo?.[0]?.faces?.length ?? '?').padStart(3), r.verdict, path.basename(f))
    } catch (e: any) { console.log('ERR', path.basename(f), String(e.message).slice(0, 60)) }
  }
  fs.writeFileSync('E:/Dev/_recovery-staging/mug-experiment/source-counts.json', JSON.stringify(out, null, 1))
}
main()

// Rebuild the wrap, previews and diagnostics of an already generated case from its saved raw NB2.1 composition (no model call).
import fs from 'node:fs'
import { BAND, FACES, WRAP, buildBand, curvatureDiagnostic, renderMug, toWrap } from './lib'
const dir = process.argv[2], panelW = 880, strategy = process.argv[3] as 'two_sided' | 'full_wrap'
async function main() {
  const raw = fs.readFileSync(`${dir}/raw-nb21.png`); const { band } = await buildBand(raw, strategy === 'two_sided' ? [FACES.front, FACES.back] : [FACES.front], panelW)
  const wrap = await toWrap(band); fs.writeFileSync(`${dir}/wrap-2670x1110.png`, wrap)
  fs.writeFileSync(`${dir}/preview-front.png`, await renderMug(wrap, FACES.front, 'rb-front')); fs.writeFileSync(`${dir}/preview-back.png`, await renderMug(wrap, FACES.back, 'rb-back'))
  fs.writeFileSync(`${dir}/curvature-front.png`, await curvatureDiagnostic(wrap, FACES.front, 'front')); fs.writeFileSync(`${dir}/curvature-back.png`, await curvatureDiagnostic(wrap, FACES.back, 'back'))
}
main()

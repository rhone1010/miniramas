import fs from 'node:fs'
import { FACES, curvatureDiagnostic } from './lib'
async function main() {
  const root = 'E:/Dev/_recovery-staging/mug-experiment/cases'
  for (const d of fs.readdirSync(root)) { const w = `${root}/${d}/wrap-2670x1110.png`; if (!fs.existsSync(w)) continue; const wrap = fs.readFileSync(w)
    fs.writeFileSync(`${root}/${d}/curvature-front.png`, await curvatureDiagnostic(wrap, FACES.front, `front face (file column ${FACES.front}), +-90 deg, orthographic cylinder - diagnostic only`)); fs.writeFileSync(`${root}/${d}/curvature-back.png`, await curvatureDiagnostic(wrap, FACES.back, `back face (file column ${FACES.back}), +-90 deg, orthographic cylinder - diagnostic only`)) }
}
main()

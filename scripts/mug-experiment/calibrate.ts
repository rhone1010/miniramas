// Calibration: render the numbered grid through OUR cylindrical preview renderer for the front and back views, and save them with the theoretical window from the mapping parameters.
import fs from 'node:fs'
import { calibrationGrid, renderMug, FACES, WRAP } from './lib'

const OUT = 'E:/Dev/_recovery-staging/mug-experiment/calibration'
async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const grid = await calibrationGrid(); fs.writeFileSync(`${OUT}/grid-2670x1110.png`, grid)
  fs.writeFileSync(`${OUT}/preview-front.png`, await renderMug(grid, FACES.front, 'calib-front')); fs.writeFileSync(`${OUT}/preview-back.png`, await renderMug(grid, FACES.back, 'calib-back'))
  // theory: the mapping is cylindrical, centerX 0.5, radiusX 0.5, assumed wrap angle 2 pi: the mask shows +-90 degrees (half the circumference) about the file column that is rolled to the middle
  const half = WRAP.w / 4
  console.log(JSON.stringify({ front: { centre: FACES.front, theoreticalVisible: [FACES.front - half, FACES.front + half] }, back: { centre: FACES.back, theoreticalVisible: [FACES.back - half, FACES.back + half] }, pxPerDegree: WRAP.w / 360 }))
}
main()

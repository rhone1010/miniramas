import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

for (const file of ['public/pets.html','public/discovery-consolidated-draft.html']) {
 describe(file + ' shared Full Size ratios', () => {
  const html=readFileSync(file,'utf8')
  const mapping=html.match(/var LBOX_AR = .*;/)![0]
  const fn=html.match(/function lboxAspectFor\(p\)\{[\s\S]*?\n\}/)![0]
  const ctx:any={};runInNewContext(mapping+'\n'+fn,ctx)
  for (const series of ['portraits','pets','groups']) {
   it(series + ' uses the same map without changing established ratios', () => {
    for (const [aspect,ratio] of Object.entries({'1:1':'1','3:4':'0.75','4:3':'1.3333','9:16':'0.5625','2:3':'0.6667','3:2':'1.5','16:9':'1.7778'})) {
     expect(ctx.lboxAspectFor({series,aspect})).toBe(ratio)
    }
   })
  }
  it('preserves unknown/missing aspect behavior',()=>{
   expect(ctx.lboxAspectFor(null)).toBe(null)
   expect(ctx.lboxAspectFor({aspect:'unknown'})).toBe(null)
  })
 })
}

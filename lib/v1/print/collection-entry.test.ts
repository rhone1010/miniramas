import {it,expect} from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
for(const file of ['public/discovery-consolidated-draft.html','public/pets.html'])it(`${file} exposes all native formats and rejects locked or incompatible candidates`,()=>{
 const s=fs.readFileSync(file,'utf8'),at=s.indexOf('function printEntranceCandidate(p)'),end=s.indexOf('\n}',at)+2
 const context:any={location:{hostname:'miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app'}};vm.createContext(context);vm.runInContext(s.slice(at,end),context)
 for(const aspect of ['1:1','2:3','3:2','3:4','4:3','9:16','16:9'])expect(context.printEntranceCandidate({aspect,locked:false,previewId:'owned'})).toBe(true)
 for(const aspect of ['1:3','3:1'])expect(context.printEntranceCandidate({aspect,locked:false,previewId:'owned'})).toBe(false)
 expect(context.printEntranceCandidate({aspect:'2:3',locked:true,previewId:'locked'})).toBe(false)
})

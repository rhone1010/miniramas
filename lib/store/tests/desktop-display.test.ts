import {readFileSync} from 'fs'
import {runInNewContext} from 'vm'
import {it,expect} from 'vitest'
const code=readFileSync('public/desktop-display.js','utf8')
it.each([['small','0.9'],['standard','1'],['large','1.15'],['invalid','1']])('restores %s display preference', (saved,expected)=>{
 let scale=''; const control={value:'',addEventListener(){}}
 runInNewContext(code,{localStorage:{getItem:()=>saved},document:{documentElement:{style:{setProperty:(_k:string,v:string)=>scale=v}},getElementById:()=>control},window:{addEventListener(){}}})
 expect(scale).toBe(expected)
})
it('persists deliberate selection without touching any other local state',()=>{
 const saved:Record<string,string>={};let change=()=>{}
 const control={value:'standard',addEventListener:(_k:string,fn:()=>void)=>change=fn}
 runInNewContext(code,{localStorage:{getItem:(k:string)=>saved[k],setItem:(k:string,v:string)=>saved[k]=v},document:{documentElement:{style:{setProperty(){}}},getElementById:()=>control},window:{addEventListener(){}}})
 control.value='large';change();expect(saved).toEqual({'liten.desktopDisplay':'large'})
})

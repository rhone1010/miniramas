import {readFileSync} from 'fs'
import {runInNewContext} from 'vm'
import {describe,it,expect} from 'vitest'
const html=readFileSync('public/discovery-consolidated-draft.html','utf8')
const code=html.slice(html.indexOf('  function syncGo(small){'),html.indexOf('  function openRail(){'))
describe('mobile continuation preserves the real action gate',()=>{
  it.each([false,true])('labels the existing step; format=%s',format=>{
    let appended=false
    const go={textContent:'',disabled:true,classList:{toggle:()=>{}},parentNode:null}
    const real={textContent:'Original desktop label',classList:{contains:()=>true}}
    const scope={go,rail:{querySelector:()=>real},coll:{classList:{contains:()=>true},appendChild:()=>{appended=true}},document:{body:{classList:{contains:()=>format}}}}
    runInNewContext(code+'\nsyncGo(true);',scope)
    expect(go.textContent).toBe(format?'Craft My Photo →':'Choose A Shape →')
    expect(go.disabled).toBe(false)
    expect(real.textContent).toBe('Original desktop label')
    expect(appended).toBe(true)
    real.classList.contains=()=>false
    runInNewContext('syncGo(true)',scope)
    expect(go.disabled).toBe(true)
  })
})

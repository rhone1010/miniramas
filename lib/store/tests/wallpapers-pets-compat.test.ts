import {it,expect} from 'vitest'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {PETS_WALLPAPERS} from '@/lib/v1/wallpapers/wallpapers-pets'

it('preserves the complete pre-replacement Wallpapers catalog byte-for-byte',()=>{
  expect(createHash('sha256').update(JSON.stringify(PETS_WALLPAPERS)).digest('hex')).toBe('ab7b6fb00e5deb5de8a277cad3bd9dd69365998d9b4df74fe42dd3e910f074a8')
})
it('keeps its compatibility input unchanged and isolated from the revised Pets catalog',()=>{
  expect(createHash('sha256').update(fs.readFileSync('lib/v1/wallpapers/pets-catalog-compat.ts')).digest('hex')).toBe('5e3fc51b9d562c62422b774b941f7b1723b903c516e6ccfac9c45d73f4585dfc')
  expect(fs.readFileSync('lib/v1/wallpapers/wallpapers-pets.ts','utf8')).toContain("from './pets-catalog-compat'")
})

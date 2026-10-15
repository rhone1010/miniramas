// lib/v1/print/upscale/checks.ts
//
// Deterministic checks on the file that would go to Prodigi. No model, no network.
// A file that fails here is never sent, whatever the visual inspection says.

import { createHash } from 'node:crypto'
import sharp from 'sharp'

export interface FileFacts { format?: string; width: number; height: number; space?: string; channels?: number; chroma?: string; bytes: number; sha256: string }
export interface FileCheck { ok: boolean; errors: string[]; facts: FileFacts }

const MIN_BYTES = 20_000          // a real print file is megabytes; this catches empty and truncated writes
const MAX_BYTES = 80 * 1024 * 1024

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

export async function checkFinalAsset(buf: Buffer, expected: { w: number; h: number }): Promise<FileCheck> {
  const errors: string[] = []
  const facts: FileFacts = { width: 0, height: 0, bytes: buf?.length ?? 0, sha256: buf ? sha256(buf) : '' }
  try {
    if (!buf || buf.length < MIN_BYTES) errors.push('file_too_small')
    if (buf && buf.length > MAX_BYTES) errors.push('file_too_large')
    const img = sharp(buf, { failOn: 'error' })
    const md = await img.metadata()
    facts.format = md.format; facts.width = md.width ?? 0; facts.height = md.height ?? 0
    facts.space = md.space; facts.channels = md.channels; facts.chroma = (md as any).chromaSubsampling
    if (md.format !== 'jpeg') errors.push('not_jpeg')
    if (facts.width !== expected.w || facts.height !== expected.h) errors.push('wrong_dimensions')
    if (md.space !== 'srgb') errors.push('not_srgb')
    if (md.channels !== 3) errors.push('not_three_channel')
    if (facts.chroma !== '4:4:4') errors.push('chroma_not_444')
    // A full decode proves the file is intact, not just that its header parses.
    const stats = await sharp(buf, { failOn: 'error' }).stats()
    if (!stats.channels.length || stats.channels.every(c => c.max === c.min)) errors.push('blank_image')
  } catch (e) {
    errors.push('unreadable_or_corrupt')
  }
  return { ok: errors.length === 0, errors, facts }
}

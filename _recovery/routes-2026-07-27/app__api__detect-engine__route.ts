// app/api/detect-engine/route.ts

import { NextRequest, NextResponse } from 'next/server'
import openai from '@/lib/openai'
const SYSTEM = `You are an image classifier for a miniature diorama generation system.

Classify the photo into ONE of these engines:
- people: portraits, individuals, families, groups (not in a sports venue)
- sports: people at a sports event, stadium, arena, game day
- architecture: buildings, houses, structures
- landscape: outdoor environments, nature, no people
- dollhouse: interior rooms, cutaway scenes

Respond ONLY as JSON:
{
  "engine": "people|sports|architecture|landscape|dollhouse",
  "label": "short human-readable label e.g. Victorian house",
  "confidence": 85,
  "reason": "one sentence explanation"
}`

async function classifyWithGPT4o(base64: string, mediaType: string) {
  const res = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      150,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: 'text', text: 'Classify this image and respond with JSON.' },
        ],
      },
    ],
  })
  return JSON.parse(res.choices[0]?.message?.content || '{}')
}



export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file     = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer    = Buffer.from(await file.arrayBuffer())
    const base64    = buffer.toString('base64')
    const ct        = file.type || 'image/jpeg'
    const mediaType = ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : 'image/jpeg'

    let result: any = null

    result = await classifyWithGPT4o(base64, mediaType)

    const validEngines = ['people', 'sports', 'architecture', 'landscape', 'dollhouse']
    if (!validEngines.includes(result?.engine)) {
      result = { engine: 'people', label: 'Photo', confidence: 50, reason: 'Could not classify' }
    }

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('detect-engine error:', err)
    return NextResponse.json({ error: err.message || 'Detection failed' }, { status: 500 })
  }
}

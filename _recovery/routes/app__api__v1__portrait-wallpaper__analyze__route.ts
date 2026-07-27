// app/api/v1/portrait-wallpaper/analyze/route.ts
//
// PORTRAIT WALLPAPER — analyze route. Self-contained (drop-in).
// GPT-4o vision reads the photo and returns whether it will make a good
// vertical phone wallpaper: one clear subject, readable face, enough
// resolution. Advisory only — never blocks; the Curator relays `reason`.
//
// Request:  { source_image_b64 }
// Response: { quality_verdict: 'green'|'yellow'|'red', reason }

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const PROMPT = `You are assessing a customer photo for use as a vertical phone wallpaper crafted by an art studio. The subject (a person) will be rendered in an artistic material and composed tall for a phone.

Assess quality_verdict:
- "green" — one clear subject, face sharp and well-lit, works beautifully as a tall composition
- "yellow" — workable but compromised: soft focus, busy background, subject small, or awkward crop for vertical
- "red" — unusable: no clear person, severe blur, or heavy obstruction

Respond with ONLY a JSON object:
{ "quality_verdict": "green|yellow|red", "reason": "<one plain sentence for the customer>" }
No preamble, no markdown fences.`

export async function POST(request: NextRequest) {
  try {
    const { source_image_b64 } = await request.json()
    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })

    const openai = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 150,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${source_image_b64}`, detail: 'low' } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const content = (response.choices[0]?.message?.content || '{}').trim()
    let verdict = 'yellow'; let reason = 'Assessed.'
    try {
      const parsed = JSON.parse(content)
      if (['green', 'yellow', 'red'].includes(parsed.quality_verdict)) verdict = parsed.quality_verdict
      reason = String(parsed.reason || '').slice(0, 240) || reason
    } catch { /* conservative default */ }

    return NextResponse.json({ quality_verdict: verdict, reason })
  } catch (e: unknown) {
    // Conservative, non-blocking default on any failure.
    return NextResponse.json({
      quality_verdict: 'yellow',
      reason: 'We could not fully read the photo — a clear, well-lit shot works best.',
    })
  }
}

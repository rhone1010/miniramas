// app/api/messages/route.ts
// Thin Anthropic SDK proxy — used by the lab frontend to convert
// plain-English user prompts into gpt-image-1 prompt instructions.
// Only accepts claude-sonnet-* models, max_tokens capped at 1000.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ALLOWED_MODELS = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514',
  'claude-opus-4-5',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      model      = 'claude-sonnet-4-5',
      max_tokens = 600,
      messages,
      system,
    } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }

    // Safety: only allow Sonnet/Opus, cap tokens
    const safeModel     = ALLOWED_MODELS.includes(model) ? model : 'claude-sonnet-4-5'
    const safeMaxTokens = Math.min(Number(max_tokens) || 600, 1000)

    const params: any = {
      model:      safeModel,
      max_tokens: safeMaxTokens,
      messages,
    }
    if (system) params.system = system

    const response = await anthropic.messages.create(params)

    return NextResponse.json({
      content: response.content,
      model:   response.model,
      usage:   response.usage,
    })

  } catch (err: any) {
    console.error('Messages proxy error:', err)
    return NextResponse.json(
      { error: err?.message || 'Anthropic API call failed' },
      { status: err?.status || 500 },
    )
  }
}

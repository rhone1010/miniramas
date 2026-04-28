// app/api/v1/landscapes/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runLandscapesGeneration } from '@/lib/v1/runners/landscapes'
import { classifyError }           from '@/lib/v1/error-classification'
import { errorResponse }           from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runLandscapesGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[landscapes/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

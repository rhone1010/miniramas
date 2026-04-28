// app/api/v1/moments/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runMomentsGeneration } from '@/lib/v1/runners/moments'
import { classifyError }        from '@/lib/v1/error-classification'
import { errorResponse }        from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runMomentsGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[moments/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

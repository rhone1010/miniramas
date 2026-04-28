// app/api/v1/stadium/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runStadiumGeneration } from '@/lib/v1/runners/stadium'
import { classifyError }        from '@/lib/v1/error-classification'
import { errorResponse }        from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runStadiumGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[stadium/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

// app/api/v1/sportsmem/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runSportsmemGeneration } from '@/lib/v1/runners/sportsmem'
import { classifyError }          from '@/lib/v1/error-classification'
import { errorResponse }          from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runSportsmemGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[sportsmem/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

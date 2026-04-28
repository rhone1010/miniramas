// app/api/v1/actionmini/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runActionminiGeneration } from '@/lib/v1/runners/actionmini'
import { classifyError }           from '@/lib/v1/error-classification'
import { errorResponse }           from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runActionminiGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[actionmini/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

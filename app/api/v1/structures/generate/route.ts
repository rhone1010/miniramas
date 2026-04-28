// app/api/v1/structures/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runStructuresGeneration } from '@/lib/v1/runners/structures'
import { classifyError }           from '@/lib/v1/error-classification'
import { errorResponse }           from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runStructuresGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[structures/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

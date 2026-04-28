// app/api/v1/interior/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runInteriorGeneration } from '@/lib/v1/runners/interior'
import { classifyError }         from '@/lib/v1/error-classification'
import { errorResponse }         from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runInteriorGeneration(body)
    return NextResponse.json(result)
  } catch (err) {
    const classified = classifyError(err)
    console.error('[interior/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

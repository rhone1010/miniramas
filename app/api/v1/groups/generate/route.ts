// app/api/v1/groups/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runGroupsGeneration } from '@/lib/v1/runners/groups'
import { classifyError }       from '@/lib/v1/error-classification'
import { errorResponse }       from '@/lib/v1/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runGroupsGeneration(body)
    if (result.rejected) {
      return NextResponse.json(
        { rejected: true, tier: result.tier, message: result.message },
        { status: 400 },
      )
    }
    return NextResponse.json({ result: result.result })
  } catch (err) {
    const classified = classifyError(err)
    console.error('[groups/generate]', classified.category, classified.originalMessage)
    return errorResponse(classified)
  }
}

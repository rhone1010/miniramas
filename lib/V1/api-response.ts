// api-response.ts
// lib/v1/api-response.ts
//
// Standardized JSON error response for every generation route. The frontend
// uses `code` to decide which error component to render, and `retryable` as
// a hint for whether "Try Again" is meaningful.

import { NextResponse } from 'next/server'
import type { ClassifiedError, ErrorCategory } from './error-classification'

const MESSAGES: Record<ErrorCategory, string> = {
  upstream_overload: 'Our image studio is busy right now. Please try again in a few minutes.',
  upstream_error:    'We hit a problem with the image service. Please try again or contact support.',
  our_error:         'Something went wrong on our end. Please try again or contact support.',
}

export function errorResponse(classified: ClassifiedError): NextResponse {
  const httpStatus = classified.category === 'upstream_overload' ? 503 : 500
  return NextResponse.json(
    {
      error:     MESSAGES[classified.category],
      code:      classified.category,
      retryable: classified.category !== 'our_error',
    },
    { status: httpStatus },
  )
}

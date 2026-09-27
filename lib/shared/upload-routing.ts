import { classifySubject, decideRedirect, type SubjectClassification } from './subject-redirect'

export const UPLOAD_SERIES = ['portraits', 'pets', 'groups'] as const
export type UploadSeries = typeof UPLOAD_SERIES[number]

// The approved three-series upload flow uses the existing classifier and
// confidence/override rules. Activity does not send these uploads to Action.
export function uploadRouting(classification: SubjectClassification) {
  const routingSubject = { ...classification, activityDetected: false }
  return {
    classification,
    decisions: Object.fromEntries(UPLOAD_SERIES.map(series =>
      [series, decideRedirect({ classification: routingSubject, currentSeries: series })])),
  }
}

export async function analyzeUploadRouting(sourceImageB64: string, peopleInSet?: number) {
  try {
    const classification = await classifySubject({ sourceImageB64, openaiApiKey: process.env.OPENAI_API_KEY || '' })
    // Groups' existing set analyzer already deduplicates people across photos.
    if (peopleInSet && peopleInSet > 1 && classification.subjectType === 'person_single') {
      classification.subjectType = 'person_group'
    }
    return uploadRouting(classification)
  } catch {
    // Preserve the classifier's existing availability-first behavior.
    return null
  }
}

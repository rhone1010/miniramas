// queue/types.ts
// lib/queue/types.ts

export type QueuedJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type QueuedProduct =
  | 'groups'
  | 'structures'
  | 'landscapes'
  | 'interior'
  | 'stadium'
  | 'actionmini'
  | 'sportsmem'
  | 'moments'

export const QUEUED_PRODUCTS: QueuedProduct[] = [
  'groups',
  'structures',
  'landscapes',
  'interior',
  'stadium',
  'actionmini',
  'sportsmem',
  'moments',
]

export interface QueuedJob {
  id:           string
  email:        string
  product:      QueuedProduct
  requestBody:  Record<string, unknown>
  status:       QueuedJobStatus
  attemptCount: number
  resultUrl:    string | null
  errorMessage: string | null
  createdAt:    string
  startedAt:    string | null
  completedAt:  string | null
}

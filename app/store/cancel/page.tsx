import { Suspense } from 'react'
import CancelInner from './CancelInner'

export default function StoreCancelPage() {
  return (
    <Suspense fallback={null}>
      <CancelInner />
    </Suspense>
  )
}

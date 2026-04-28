import { Suspense } from 'react'
import SuccessInner from './SuccessInner'

export default function StoreSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  )
}

'use client'

import { useParams } from 'next/navigation'

import { BatchView } from '@/components/batches'

export default function BatchPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <main className="app-page app-container py-8 sm:py-10">
      <BatchView id={id} />
    </main>
  )
}

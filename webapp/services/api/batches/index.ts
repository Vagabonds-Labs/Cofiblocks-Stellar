import { api } from '@/lib/api'
import { toQueryString } from '@/lib/query'
import type { PreparedTransaction } from '@/types/contracts'
import type { BatchesPage, BatchStage, PilotSummary, Reception } from '@/types/traceability'

export interface ReceptionInput {
  weightKg: number
  /** SHA-256 (hex) of the receipt photo. */
  receiptSha256: string
  notes?: string | null
}

const receptionBody = (input: ReceptionInput) => ({
  weight_kg: input.weightKg,
  receipt_sha256: input.receiptSha256,
  notes: input.notes || null,
})

export const batchesService = {
  async list(filters: {
    stage?: BatchStage
    collectionCenterId?: string
    organizationId?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<BatchesPage> {
    const query = toQueryString({
      stage: filters.stage,
      collection_center_id: filters.collectionCenterId,
      organization_id: filters.organizationId,
      search: filters.search,
      limit: filters.limit,
      offset: filters.offset,
    })
    const response = await api.get<{ data: BatchesPage }>(`/batches${query}`)
    return response.data
  },

  async summary(): Promise<PilotSummary> {
    const response = await api.get<{ data: { summary: PilotSummary } }>('/batches/summary')
    return response.data.summary
  },

  /** Collector, step 1: the `record_reception` transaction to sign. */
  async prepareReception(batchId: string, input: ReceptionInput): Promise<PreparedTransaction> {
    const response = await api.post<{ data: { prepared: PreparedTransaction } }>(
      `/batches/${batchId}/reception/prepare`,
      receptionBody(input)
    )
    return response.data.prepared
  },

  /** Collector, step 2: the signed transaction; the backend sends it and pays the fee. */
  async submitReception(batchId: string, input: ReceptionInput, signedXdr: string): Promise<Reception> {
    const response = await api.post<{ data: { reception: Reception } }>(`/batches/${batchId}/reception`, {
      ...receptionBody(input),
      signed_xdr: signedXdr,
    })
    return response.data.reception
  },
}

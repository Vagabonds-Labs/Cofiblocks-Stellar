import { api } from '@/lib/api'
import { toQueryString } from '@/lib/query'
import type { PreparedTransaction } from '@/types/contracts'
import type {
  BatchDetail,
  BatchDocument,
  BatchesPage,
  BatchStage,
  BatchVerification,
  DocumentKind,
  PilotSummary,
  Reception,
  StageStep,
} from '@/types/traceability'

export interface BatchFilters {
  stage?: BatchStage
  collectionCenterId?: string
  organizationId?: string
  search?: string
  /** Only the batches the viewer's role can move forward now. */
  forMe?: boolean
}

export interface StageInput {
  stage: BatchStage
  weightKg?: number | null
  notes?: string | null
}

const filterQuery = (filters: BatchFilters) => ({
  stage: filters.stage,
  collection_center_id: filters.collectionCenterId,
  organization_id: filters.organizationId,
  search: filters.search,
  for_me: filters.forMe ? 'true' : undefined,
})

const stageBody = (input: StageInput) => ({
  stage: input.stage,
  weight_kg: input.weightKg ?? null,
  notes: input.notes || null,
})

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
  async list(filters: BatchFilters & { limit?: number; offset?: number }): Promise<BatchesPage> {
    const query = toQueryString({ ...filterQuery(filters), limit: filters.limit, offset: filters.offset })
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

  async get(id: string): Promise<BatchDetail> {
    const response = await api.get<{ data: { batch: BatchDetail } }>(`/batches/${id}`)
    return response.data.batch
  },

  /** Compares the stored history and documents with the contract. */
  async verify(id: string): Promise<BatchVerification> {
    const response = await api.get<{ data: { verification: BatchVerification } }>(`/batches/${id}/verify`)
    return response.data.verification
  },

  /** The batches (same filters as the list) as a CSV file. */
  async exportCsv(filters: BatchFilters) {
    return api.download(`/batches/export.csv${toQueryString(filterQuery(filters))}`)
  },

  /** Step 1: the `advance_stage` transaction to sign. */
  async prepareStage(batchId: string, input: StageInput): Promise<PreparedTransaction> {
    const response = await api.post<{ data: { prepared: PreparedTransaction } }>(
      `/batches/${batchId}/stage/prepare`,
      stageBody(input)
    )
    return response.data.prepared
  },

  /** Step 2: the signed transaction; the backend sends it and pays the fee. */
  async submitStage(batchId: string, input: StageInput, signedXdr: string): Promise<StageStep> {
    const response = await api.post<{ data: { step: StageStep } }>(`/batches/${batchId}/stage`, {
      ...stageBody(input),
      signed_xdr: signedXdr,
    })
    return response.data.step
  },

  /** Documents, step 1: upload the file (not attached on chain yet). */
  async uploadDocument(batchId: string, file: File, kind: DocumentKind): Promise<BatchDocument> {
    const form = new FormData()
    form.append('kind', kind)
    form.append('file', file)
    const response = await api.post<{ data: { document: BatchDocument } }>(`/batches/${batchId}/documents`, form)
    return response.data.document
  },

  /** Documents, step 2: the `attach_document` transaction to sign. */
  async prepareAttach(batchId: string, documentId: string): Promise<PreparedTransaction> {
    const response = await api.post<{ data: { prepared: PreparedTransaction } }>(
      `/batches/${batchId}/documents/${documentId}/prepare`
    )
    return response.data.prepared
  },

  /** Documents, step 3: the signed transaction. */
  async attach(batchId: string, documentId: string, signedXdr: string): Promise<BatchDocument> {
    const response = await api.post<{ data: { document: BatchDocument } }>(
      `/batches/${batchId}/documents/${documentId}/attach`,
      { signed_xdr: signedXdr }
    )
    return response.data.document
  },

  async downloadDocument(batchId: string, documentId: string) {
    return api.download(`/batches/${batchId}/documents/${documentId}/file`)
  },
}

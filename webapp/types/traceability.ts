/** Pilot staff roles. They match the backend's `StaffRole`. */
export const STAFF_ROLES = [
  'COLLECTOR',
  'COMMITTEE_MEMBER',
  'INDUSTRY_MANAGER',
  'STORE_KEEPER',
  'EXPORT_MANAGER',
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export type OrganizationKind = 'COOPERATIVE' | 'UNION'

export type FarmerStatus = 'PRELOADED' | 'LINKED' | 'REGISTERED' | 'CONSENTED'

export interface CollectionCenter {
  id: string
  name: string
  chainId: number
}

export interface Organization {
  id: string
  kind: OrganizationKind
  name: string
  code: string
  chainId: number
  region: string | null
  zone: string | null
  woreda: string | null
  collectionCenters: CollectionCenter[]
  _count: { farmers: number; users: number }
}

export interface Farmer {
  id: string
  coopFarmerId: string
  fullName: string | null
  phone: string | null
  status: FarmerStatus
  telegramUsername: string | null
  linkedAt: string | null
  organization: { id: string; code: string; name: string }
  collectionCenter: { id: string; name: string } | null
}

export interface FarmerImportResult {
  dryRun: boolean
  created: number
  updated: number
  unchanged: number
  errors: { line: number; message: string }[]
}

/** Batch stages, in order. Same names as the contract's `Stage`. */
export const BATCH_STAGES = [
  'DELIVERED',
  'RECEIVED',
  'WASHING',
  'FERMENTATION',
  'DRYING',
  'STORAGE',
  'IN_TRANSPORT_TO_UNION',
  'PREPARED_WITH_EXPORTABLE_BAG',
  'SOLD',
] as const

export type BatchStage = (typeof BATCH_STAGES)[number]

/** A batch as the API returns it. Farmers appear only by their pseudonymous `farmerRef`. */
export interface Batch {
  id: string
  number: string
  stage: BatchStage
  farmerRef: string
  organization: { id: string; code: string; name: string }
  collectionCenter: { id: string; name: string }
  deliveredAt: string
  estimatedKg: number | null
  ripeness: string | null
  weightKg: number | null
  receiptHash: string | null
  receivedAt: string | null
  dataHash: string
  createTx: string | null
  receptionTx: string | null
  onChain: boolean
}

export interface BatchesPage {
  total: number
  batches: Batch[]
  stageCounts: Partial<Record<BatchStage, number>>
}

export interface Reception {
  batch_id: string
  stage: 'RECEIVED'
  weight_grams: string
  receipt_sha256: string
  data_hash: string
  tx_hash: string
  explorer_url: string
}

/** The pilot at a glance (`GET /batches/summary`). */
export interface PilotSummary {
  farmers: { total: number; linked: number; consented: number }
  batches: { total: number; byStage: Partial<Record<BatchStage, number>> }
  receivedKg: number
  cooperatives: {
    id: string
    code: string
    name: string
    farmers: number
    farmersLinked: number
    batches: number
    receivedKg: number
    collectionCenters: number
    byStage: Partial<Record<BatchStage, number>>
  }[]
  recent: {
    stage: BatchStage
    at: string
    txHash: string
    batch: Pick<
      Batch,
      | 'id'
      | 'number'
      | 'farmerRef'
      | 'organization'
      | 'collectionCenter'
      | 'estimatedKg'
      | 'weightKg'
    >
  }[]
}

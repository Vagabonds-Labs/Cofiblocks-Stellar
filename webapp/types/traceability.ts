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
  /** Weight the Collector recorded at delivery and the farmer confirmed in the bot. */
  confirmedKg: number | null
  weightKg: number | null
  receiptHash: string | null
  receivedAt: string | null
  dataHash: string
  createTx: string | null
  receptionTx: string | null
  onChain: boolean
}

/** One step of a batch's history, with the record whose hash is on chain. */
export interface BatchEvent {
  stage: BatchStage
  actorAddress: string
  actor: { name: string | null; role: StaffRole | null } | null
  data: Record<string, unknown>
  dataHash: string
  /** The stored record still hashes to `dataHash`. */
  dataHashMatches: boolean
  txHash: string
  at: string
}

export const DOCUMENT_KINDS = ['receipt', 'certificate', 'quality', 'sale', 'other'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export interface BatchDocument {
  id: string
  kind: DocumentKind
  fileName: string
  contentType: string
  sizeBytes: number
  sha256: string
  /** Set once `attach_document` is confirmed. */
  txHash: string | null
  attachedAt: string | null
  uploadedAt: string
  uploadedBy: { name: string | null; role: StaffRole | null } | null
}

/** `GET /batches/:id`: the batch, its history, documents and what the viewer can do. */
export interface BatchDetail extends Batch {
  events: BatchEvent[]
  documents: BatchDocument[]
  /** Stages the viewer can move the batch to now. */
  nextStages: BatchStage[]
  stageInFlight: boolean
  canAttach: boolean
}

/** `GET /batches/:id/verify`: the stored history compared with the contract. */
export interface BatchVerification {
  verified: boolean
  checkedAt: string
  onChain: boolean
  stage: { stored: BatchStage; onChain: BatchStage | null }
  stageMatches: boolean
  weightMatches: boolean
  steps: { stage: BatchStage; txHash: string; recordMatches: boolean; onChain: boolean }[]
  documents: { id: string; sha256: string; onChain: boolean }[]
}

export interface StageStep {
  batch_id: string
  stage: BatchStage
  data_hash: string
  tx_hash: string
  explorer_url: string
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
      | 'confirmedKg'
      | 'weightKg'
    >
  }[]
}

export type DeliveryStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

/** A delivery the Collector recorded, waiting for (or answered by) the farmer in the bot. */
export interface Delivery {
  id: string
  farmerRef: string
  farmerName: string | null
  collectionCenter: { id: string; name: string }
  weightKg: number
  deliveredAt: string
  status: DeliveryStatus
  expiresAt: string
  answeredAt: string | null
  createdAt: string
  /** Set once the farmer confirmed and the batch is on Stellar. */
  batch: { id: string; number: string } | null
}

/** A farmer the Collector can record a delivery for. */
export interface DeliveryFarmer {
  id: string
  farmerRef: string
  name: string | null
  collectionCenterId: string | null
  /** Linked the bot: they can be asked to confirm. */
  linked: boolean
  consented: boolean
}

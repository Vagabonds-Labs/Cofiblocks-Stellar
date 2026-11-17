import { useTranslations } from 'next-intl'

import type { BatchStage } from '@/types/traceability'

/** Colors go from warm (just delivered) to green (sold). */
const STAGE_STYLES: Record<BatchStage, string> = {
  DELIVERED: 'bg-[#fff1d4] text-[#7a4f12]',
  RECEIVED: 'bg-[#e0eefa] text-[#164e63]',
  WASHING: 'bg-[#e3f2f4] text-[#155e63]',
  FERMENTATION: 'bg-[#efe7f6] text-[#5b2d7a]',
  DRYING: 'bg-[#fbeee0] text-[#7c3d12]',
  STORAGE: 'bg-[#eef1ee] text-[#3f4a44]',
  IN_TRANSPORT_TO_UNION: 'bg-[#e6ecf7] text-[#1e3a6e]',
  PREPARED_WITH_EXPORTABLE_BAG: 'bg-[#e4f1e7] text-[#1f5c33]',
  SOLD: 'bg-[#dcefe5] text-[#14532d]',
}

export function StageChip({ stage }: { stage: BatchStage }) {
  const t = useTranslations('stages')
  return <span className={`chip whitespace-nowrap ${STAGE_STYLES[stage]}`}>{t(stage)}</span>
}

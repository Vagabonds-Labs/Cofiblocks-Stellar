import { Farm } from '@/services/api/farms'

export interface FarmCardProps {
    farm: Farm
    onDelete?: () => void
  }

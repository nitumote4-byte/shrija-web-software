import type { LucideIcon } from 'lucide-react'
import { Flame, Sparkles, Wrench } from 'lucide-react'
import {
  UNIFIED_WEIGHT_SERVICE_SUBTITLE,
  isUnifiedWeightServiceType,
  type OtherServiceType,
} from '../../../data/otherServices'

export type ServiceAccent = 'laser' | 'vibrator' | 'polish' | 'manual'

export type ServiceVisual = {
  accent: ServiceAccent
  icon: LucideIcon
  lines: string[]
}

export function serviceVisual(type: OtherServiceType): ServiceVisual {
  const name = type.name.trim().toLowerCase()
  if (type.id === 'os-type-laser' || name.includes('laser') || name.includes('solder')) {
    return { accent: 'laser', icon: Flame, lines: ['Item wise charges'] }
  }
  if (isUnifiedWeightServiceType(type) || type.kind === 'weight') {
    return {
      accent: 'polish',
      icon: Sparkles,
      lines: [UNIFIED_WEIGHT_SERVICE_SUBTITLE, 'Multi-item · Rate per KG'],
    }
  }
  if (type.kind === 'piece') {
    return { accent: 'laser', icon: Flame, lines: ['Item wise charges'] }
  }
  return { accent: 'manual', icon: Wrench, lines: ['Custom charges'] }
}

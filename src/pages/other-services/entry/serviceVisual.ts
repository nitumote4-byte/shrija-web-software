import type { LucideIcon } from 'lucide-react'
import { Flame, Sparkles, Vibrate, Wrench } from 'lucide-react'
import type { OtherServiceType } from '../../../data/otherServices'

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
  if (type.id === 'os-type-vibrator' || name.includes('vibrator')) {
    return { accent: 'vibrator', icon: Vibrate, lines: ['Rate per KG', 'Enter in g or kg'] }
  }
  if (type.id === 'os-type-silver-polish' || name.includes('polish')) {
    return { accent: 'polish', icon: Sparkles, lines: ['Rate per KG', 'Enter in g or kg'] }
  }
  if (type.kind === 'piece') {
    return { accent: 'laser', icon: Flame, lines: ['Item wise charges'] }
  }
  if (type.kind === 'weight') {
    return { accent: 'vibrator', icon: Vibrate, lines: ['Rate per KG', 'Enter in g or kg'] }
  }
  return { accent: 'manual', icon: Wrench, lines: ['Custom charges'] }
}

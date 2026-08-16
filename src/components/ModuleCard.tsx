import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ModuleDef } from '../data/modules'

export function ModuleCard({ module, delay = 0 }: { module: ModuleDef; delay?: number }) {
  const Icon = module.icon
  return (
    <Link
      to={module.path}
      className="module-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="module-card-header">
        <div className="module-icon">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <span className="launch-arrow" aria-hidden>
          <ArrowRight size={14} />
        </span>
      </div>
      <h3 className="module-card-title">{module.title}</h3>
      <p className="module-card-desc">{module.description}</p>
    </Link>
  )
}


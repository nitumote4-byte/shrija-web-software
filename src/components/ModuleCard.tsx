import { Link } from 'react-router-dom'
import type { ModuleDef } from '../data/modules'

export function ModuleCard({ module, delay = 0 }: { module: ModuleDef; delay?: number }) {
  const Icon = module.icon
  return (
    <Link
      to={module.path}
      className="module-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="module-icon">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3>{module.title}</h3>
      <p>{module.description}</p>
      <span className="launch-link">
        Open <span aria-hidden>→</span>
      </span>
    </Link>
  )
}

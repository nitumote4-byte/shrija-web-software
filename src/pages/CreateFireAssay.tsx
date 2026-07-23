import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, Flame, FlaskConical, Hand } from 'lucide-react'

const options = [
  {
    title: 'Cornet Fire Assay',
    description: 'CG weight + purity BIS auto-fill, Fill Jobs, Create Sheet → Manak.',
    path: '/create-fire-assay/cornet-auto',
    icon: Flame,
  },
  {
    title: 'Cg Auto Fire Assay',
    description: 'Same cornet sheet flow (CG stock + Manak bridge).',
    path: '/create-fire-assay/cg-auto',
    icon: FlaskConical,
  },
  {
    title: 'Cornet Fire Assay MS M2',
    description: 'Cornet sheet variant (MS M2).',
    path: '/create-fire-assay/cornet-ms-m2',
    icon: Flame,
  },
  {
    title: 'Manual Fire Assay',
    description: 'Manual sheet with Excel template upload.',
    path: '/create-fire-assay/manual',
    icon: Hand,
  },
  {
    title: 'View Fire Assay',
    description: 'Search and view fire assay records.',
    path: '/view-fire-assay',
    icon: Eye,
  },
]

export function CreateFireAssay() {
  return (
    <div className="fire-assay-hub">
      <div className="others-hub-head">
        <h1>Select Fire Assay Version</h1>
        <p>Choose an automated or manual fire assay workflow to continue.</p>
      </div>

      <div className="fire-assay-grid">
        {options.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.path} to={item.path} className="fire-assay-card">
              <div className="fire-assay-card-icon">
                <Icon size={28} strokeWidth={1.75} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="launch-link">
                Open <ArrowRight size={14} />
              </span>
            </Link>
          )
        })}
      </div>

      <div className="manual-actions">
        <Link to="/" className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    </div>
  )
}

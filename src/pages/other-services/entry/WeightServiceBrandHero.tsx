import { Sparkles } from 'lucide-react'
import jewelleryHero from '../../../assets/other-services/silver-polish-jewellery-hero.png'
import {
  UNIFIED_WEIGHT_SERVICE_NAME,
  UNIFIED_WEIGHT_SERVICE_SUBTITLE,
} from '../../../data/otherServices'

export function WeightServiceBrandHero({
  title = UNIFIED_WEIGHT_SERVICE_NAME,
  subtitle = UNIFIED_WEIGHT_SERVICE_SUBTITLE,
  slipNo,
}: {
  title?: string
  subtitle?: string
  slipNo?: string
}) {
  return (
    <section className="nse-brand-hero" aria-label={`${title} service banner`}>
      <div className="nse-brand-hero-left">
        <div className="nse-brand-hero-icon" aria-hidden>
          <Sparkles size={24} strokeWidth={1.9} />
        </div>
        <div className="nse-brand-hero-copy">
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {slipNo ? <span className="nse-slip-pill">Slip {slipNo}</span> : null}
        </div>
      </div>
      <div className="nse-brand-hero-media">
        <img
          src={jewelleryHero}
          alt="Elegant silver jewellery — payal, ring and ornaments"
          width={640}
          height={360}
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="nse-brand-hero-tagline">
        <strong>Clean • Shine • Finish</strong>
        <span>Give new life to your silver jewellery.</span>
      </div>
    </section>
  )
}

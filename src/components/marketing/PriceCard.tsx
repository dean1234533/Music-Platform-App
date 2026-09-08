import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

export interface PriceCardProps {
  index: number
  title: string
  price: string
  suffix?: string
  description: string
  features: string[]
  cta: string
  to: string
  featured?: boolean
}

export function PriceCard({ index, title, price, suffix, description, features, cta, to, featured = false }: PriceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = cardRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.28 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={cardRef} className={`price-card-reveal price-card-delay-${index} ${visible ? 'is-visible' : ''} relative flex min-h-[28rem] flex-col rounded-[1.5rem] p-7 ${featured ? 'border border-brand-400/25 bg-[radial-gradient(circle_at_82%_0%,rgba(200,243,63,.16),transparent_18rem),linear-gradient(145deg,#182016,#0b0f0a)] text-ink-0 shadow-[0_30px_90px_rgba(200,243,63,.08)]' : 'premium-panel'}`}>
      {featured ? <span className="absolute right-5 top-5 rounded-full border border-brand-400/15 bg-brand-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-400">Most meaningful</span> : null}
      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${featured ? 'text-brand-400/80' : 'text-ink-3'}`}>{title}</p>
      <p className="mt-6 text-5xl font-medium tracking-[-0.055em]">{price}<span className="ml-1 text-sm font-medium tracking-normal text-ink-2">{suffix}</span></p>
      <p className="mt-4 text-sm leading-6 text-ink-2">{description}</p>
      <ul className="mt-8 space-y-3">{features.map((feature) => <li key={feature} className="flex items-center gap-3 text-sm"><Check className="h-4 w-4 shrink-0" />{feature}</li>)}</ul>
      <div className="mt-auto pt-10">
        <Link to={to} className={`block rounded-full px-5 py-3 text-center text-sm font-semibold transition ${featured ? 'bg-brand-500 text-surface-0 hover:bg-brand-400' : 'bg-ink-0 text-surface-0 hover:bg-brand-400'}`}>{cta}</Link>
      </div>
    </div>
  )
}

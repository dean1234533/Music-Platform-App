import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Headphones, Mic2, Radio, Sparkles } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'

const roles = [
  { icon: Headphones, label: 'Listen', title: 'Find the signal', copy: 'Independent releases, shaped around your taste—not an opaque chart.', to: '/sign-up?role=fan' },
  { icon: Mic2, label: 'Create', title: 'Own your audience', copy: 'Release music, build recurring support, and see exactly what moves.', to: '/sign-up?role=artist' },
  { icon: Radio, label: 'Select', title: 'Clear it properly', copy: 'Discover early, speak directly, and license tracks without the runaround.', to: '/sign-up?role=dj' },
]

const steps = [
  ['01', 'Discover without the noise', 'Follow artists, save releases, and build a library around music you genuinely care about.'],
  ['02', 'Put your membership to work', 'Choose which followed artists receive your monthly support. You stay in control of the split.'],
  ['03', 'Move music forward', 'Artists grow sustainable audiences while DJs clear tracks through a direct, documented workflow.'],
]

export function LandingPage() {
  return (
    <div className="min-h-svh overflow-hidden bg-surface-0 text-ink-0">
      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <BrandMark />
        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Primary navigation">
          <a href="#how-it-works" className="hidden rounded-full px-3 py-2.5 text-sm font-medium text-ink-2 transition hover:text-white md:block">How it works</a>
          <a href="#pricing" className="hidden rounded-full px-3 py-2.5 text-sm font-medium text-ink-2 transition hover:text-white md:block">Pricing</a>
          <Link to="/sign-in" className="rounded-full px-4 py-2.5 text-sm font-medium text-ink-1 transition hover:text-white">Sign in</Link>
          <Link to="/sign-up" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-[#090b06] transition hover:bg-brand-400">Join Wavelength</Link>
        </nav>
      </header>

      <main>
        <section className="hero-shell relative mx-auto grid min-h-[720px] max-w-[1440px] items-center gap-10 overflow-hidden px-5 pb-20 pt-14 sm:px-8 xl:grid-cols-[0.86fr_1.14fr] xl:overflow-visible xl:px-12 xl:py-20">
          <div className="hero-copy relative z-10 max-w-2xl">
            <p className="eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Independent sounds. Direct support.</p>
            <h1 className="mt-7 text-balance text-[clamp(3.6rem,8vw,7.6rem)] font-medium leading-[0.84] tracking-[-0.07em]">
              Music with<br /><span className="text-brand-400">a pulse.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-ink-1 sm:text-xl">A listening platform where discovery feels human, artists keep control, and every subscription has somewhere meaningful to go.</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/sign-up?role=fan" className="group inline-flex items-center gap-3 rounded-full bg-ink-0 px-6 py-3.5 text-sm font-semibold text-surface-0 transition hover:bg-brand-400">
                Start listening <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/sign-up?role=artist" className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-ink-0 transition hover:border-white/30 hover:bg-white/[0.05]">For artists</Link>
            </div>
            <div className="mt-16 flex items-center gap-8 border-t border-white/10 pt-6 text-sm text-ink-2">
              <div><strong className="block text-lg font-medium text-ink-0">100%</strong> independent</div>
              <div><strong className="block text-lg font-medium text-ink-0">Direct</strong> artist support</div>
              <div><strong className="block text-lg font-medium text-ink-0">Clear</strong> DJ licensing</div>
            </div>
          </div>

          <div className="hero-art relative min-h-[420px] xl:min-h-[620px]">
            <div className="absolute -inset-24 bg-[radial-gradient(circle,rgba(43,78,255,.22),transparent_55%)]" />
            <div className="art-drift premium-panel absolute inset-0 overflow-hidden rounded-[2.25rem] p-2">
              <img src="/wavelength-hero.png" alt="A curated collection of translucent vinyl and sculptural record sleeves" className="h-full w-full rounded-[1.85rem] object-cover object-[68%_center]" />
              <div className="absolute inset-x-5 bottom-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/55 px-5 py-4 backdrop-blur-xl">
                <div><p className="text-xs uppercase tracking-[0.16em] text-ink-2">Now in rotation</p><p className="mt-1 text-sm font-medium">The independent frequency</p></div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-surface-0"><ArrowRight className="h-4 w-4 -rotate-45" /></span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
          <div className="mb-9 flex flex-col justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-end">
            <div><p className="eyebrow">One ecosystem</p><h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">Built around the people who move music.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-ink-2">From first play to fair payment, every part of the relationship stays connected.</p>
          </div>
          <div className="audience-slider grid gap-3 xl:grid-cols-3" role="region" aria-label="Ways to join Wavelength">
            {roles.map((role, index) => (
              <Link key={role.label} to={role.to} className="group premium-panel relative min-h-72 overflow-hidden rounded-[1.5rem] p-7 transition duration-300 hover:-translate-y-1 hover:border-white/20">
                <div className="flex items-start justify-between"><role.icon className="h-6 w-6 text-brand-400" /><span className="text-xs tabular-nums text-ink-3">0{index + 1}</span></div>
                <div className="absolute inset-x-7 bottom-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">{role.label}</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.03em]">{role.title}</h3><p className="mt-3 text-sm leading-6 text-ink-2">{role.copy}</p><ArrowRight className="mt-6 h-5 w-5 text-ink-1 transition-transform group-hover:translate-x-1" /></div>
              </Link>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/[0.08] bg-white/[0.018]">
          <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="mt-4 max-w-md text-4xl font-medium leading-[1.04] tracking-[-0.045em] sm:text-5xl">A fairer route from first listen to lasting support.</h2>
              </div>
              <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {steps.map(([number, title, copy]) => (
                  <div key={number} className="grid gap-4 py-7 sm:grid-cols-[4rem_1fr_1fr] sm:items-start">
                    <span className="text-xs tabular-nums text-brand-400">{number}</span>
                    <h3 className="text-lg font-medium tracking-[-0.02em]">{title}</h3>
                    <p className="text-sm leading-6 text-ink-2">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Simple pricing</p>
            <h2 className="mt-4 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">Join free. Support when it matters.</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink-2">Explore the platform without a membership. Subscribe when you’re ready to direct meaningful monthly support to artists.</p>
          </div>
          <div className="price-grid mx-auto mt-12 grid max-w-5xl gap-3 md:grid-cols-3">
            <PriceCard index={0} title="Listener" price="Free" description="Discover, follow, save, and build playlists." features={['Full discovery catalogue', 'Personal library and playlists', 'Follow independent artists']} cta="Create free account" to="/sign-up?role=fan" />
            <PriceCard index={1} featured title="Supporter" price="£10" suffix="/month" description="Turn listening into direct artist support." features={['Everything in Listener', 'Allocate support each month', 'Access supporter-only posts']} cta="Become a supporter" to="/sign-up?role=fan" />
            <PriceCard index={2} title="Artist & DJ" price="Free" description="Publish, connect, and agree opportunities directly." features={['Artist profiles and releases', 'DJ discovery and requests', 'Documented licensing flow']} cta="Join the platform" to="/sign-up" />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-ink-3">Licensing fees are agreed directly between artists and DJs. Applicable platform fees are shown before payment or payout.</p>
        </section>

        <section className="px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
          <div className="premium-panel relative mx-auto flex min-h-[22rem] max-w-[1344px] flex-col items-start justify-end gap-8 overflow-hidden rounded-[2rem] px-7 py-10 sm:min-h-[25rem] sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:px-14 lg:py-14">
            <img src="/wavelength-cta-instruments.jpg" alt="A cobalt guitar, microphone, amplifier and drum kit ready on stage" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
            <div className="relative z-10"><p className="eyebrow">Your music, better connected</p><h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-white sm:text-4xl">Ready to tune in?</h2></div>
            <Link to="/sign-up" className="group relative z-10 inline-flex items-center gap-3 rounded-full bg-brand-500 px-6 py-3.5 text-sm font-semibold text-surface-0 transition hover:bg-brand-400">Join Wavelength <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-12 lg:py-16">
          <div><BrandMark /><p className="mt-5 max-w-xs text-sm leading-6 text-ink-2">Independent music, direct support, and clearer connections between the people who move culture.</p></div>
          <FooterGroup title="Platform" links={[['How it works', '/#how-it-works'], ['Pricing', '/#pricing'], ['Sign in', '/sign-in']]} />
          <FooterGroup title="Join" links={[['For listeners', '/sign-up?role=fan'], ['For artists', '/sign-up?role=artist'], ['For DJs', '/sign-up?role=dj']]} />
          <FooterGroup title="Legal" links={[['Terms & conditions', '/terms'], ['Privacy policy', '/privacy']]} />
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-white/[0.07] px-5 py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p>© {new Date().getFullYear()} Wavelength.</p><p>Independent by design.</p></div>
      </footer>
    </div>
  )
}

function PriceCard({ index, title, price, suffix, description, features, cta, to, featured = false }: { index: number; title: string; price: string; suffix?: string; description: string; features: string[]; cta: string; to: string; featured?: boolean }) {
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
    <div ref={cardRef} className={`price-card-reveal price-card-delay-${index} ${visible ? 'is-visible' : ''} relative flex min-h-[28rem] flex-col rounded-[1.5rem] p-7 ${featured ? 'bg-brand-500 text-surface-0 shadow-[0_30px_90px_rgba(200,243,63,.12)]' : 'premium-panel'}`}>
      {featured ? <span className="absolute right-5 top-5 rounded-full bg-black/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">Most meaningful</span> : null}
      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${featured ? 'text-surface-0/60' : 'text-ink-3'}`}>{title}</p>
      <p className="mt-6 text-5xl font-medium tracking-[-0.055em]">{price}<span className={`ml-1 text-sm font-medium tracking-normal ${featured ? 'text-surface-0/60' : 'text-ink-2'}`}>{suffix}</span></p>
      <p className={`mt-4 text-sm leading-6 ${featured ? 'text-surface-0/70' : 'text-ink-2'}`}>{description}</p>
      <ul className="mt-8 space-y-3">{features.map((feature) => <li key={feature} className="flex items-center gap-3 text-sm"><Check className="h-4 w-4 shrink-0" />{feature}</li>)}</ul>
      <Link to={to} className={`mt-auto block rounded-full px-5 py-3 text-center text-sm font-semibold transition ${featured ? 'bg-surface-0 text-ink-0 hover:bg-surface-2' : 'bg-ink-0 text-surface-0 hover:bg-brand-400'}`}>{cta}</Link>
    </div>
  )
}

function FooterGroup({ title, links }: { title: string; links: [string, string][] }) {
  return <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-3">{title}</h2><ul className="mt-5 space-y-3">{links.map(([label, to]) => <li key={label}><Link to={to} className="text-sm text-ink-1 transition hover:text-brand-400">{label}</Link></li>)}</ul></div>
}

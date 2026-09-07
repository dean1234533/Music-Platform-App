import { Link } from 'react-router-dom'
import { ArrowRight, Headphones, Mic2, Radio, Sparkles } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'

const roles = [
  { icon: Headphones, label: 'Listen', title: 'Find the signal', copy: 'Independent releases, shaped around your taste—not an opaque chart.', to: '/sign-up?role=fan' },
  { icon: Mic2, label: 'Create', title: 'Own your audience', copy: 'Release music, build recurring support, and see exactly what moves.', to: '/sign-up?role=artist' },
  { icon: Radio, label: 'Select', title: 'Clear it properly', copy: 'Discover early, speak directly, and license tracks without the runaround.', to: '/sign-up?role=dj' },
]

export function LandingPage() {
  return (
    <div className="min-h-svh overflow-hidden bg-surface-0 text-ink-0">
      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <BrandMark />
        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Account">
          <Link to="/sign-in" className="rounded-full px-4 py-2.5 text-sm font-medium text-ink-1 transition hover:text-white">Sign in</Link>
          <Link to="/sign-up" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-[#090b06] transition hover:bg-brand-400">Join Wavelength</Link>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[720px] max-w-[1440px] items-center gap-10 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-12 lg:py-20">
          <div className="relative z-10 max-w-2xl">
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

          <div className="relative min-h-[420px] lg:min-h-[620px]">
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
          <div className="grid gap-3 md:grid-cols-3">
            {roles.map((role, index) => (
              <Link key={role.label} to={role.to} className="group premium-panel relative min-h-72 overflow-hidden rounded-[1.5rem] p-7 transition duration-300 hover:-translate-y-1 hover:border-white/20">
                <div className="flex items-start justify-between"><role.icon className="h-6 w-6 text-brand-400" /><span className="text-xs tabular-nums text-ink-3">0{index + 1}</span></div>
                <div className="absolute inset-x-7 bottom-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">{role.label}</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.03em]">{role.title}</h3><p className="mt-3 text-sm leading-6 text-ink-2">{role.copy}</p><ArrowRight className="mt-6 h-5 w-5 text-ink-1 transition-transform group-hover:translate-x-1" /></div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-4 border-t border-white/10 px-5 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><BrandMark /><p>© {new Date().getFullYear()} Wavelength. Independent by design.</p></footer>
    </div>
  )
}

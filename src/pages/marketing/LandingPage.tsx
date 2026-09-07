import { Link } from 'react-router-dom'
import { Music2, Headphones, Mic2, Radio } from 'lucide-react'

const sections = [
  {
    icon: Headphones,
    tag: 'FOR FANS',
    copy: 'Discover independent artists, follow your favourites, and make your monthly subscription directly support the musicians you choose.',
    cta: { label: 'Start Listening', to: '/sign-up?role=fan' },
    accent: 'text-brand-400',
  },
  {
    icon: Mic2,
    tag: 'FOR ARTISTS',
    copy: 'Build followers, gain paying supporters, earn recurring income, and control how DJs access your music.',
    cta: { label: 'Join as an Artist', to: '/sign-up?role=artist' },
    accent: 'text-support-400',
  },
  {
    icon: Radio,
    tag: 'FOR DJs',
    copy: 'Discover new independent tracks, speak directly with artists, agree usage terms, and securely download approved music.',
    cta: { label: 'Join as a DJ', to: '/sign-up?role=dj' },
    accent: 'text-dj-400',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Music2 className="h-6 w-6 text-brand-400" />
          <span className="text-lg font-semibold tracking-tight">Wavelength</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/sign-in" className="rounded-lg px-4 py-2 text-sm font-medium text-ink-1 hover:text-ink-0">
            Sign in
          </Link>
          <Link
            to="/sign-up"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="gradient-glow relative overflow-hidden px-6 pb-20 pt-16 text-center sm:pt-24">
        <h1 className="text-balance mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Support the artists you actually listen to.
        </h1>
        <p className="text-balance mx-auto mt-6 max-w-xl text-lg text-ink-2">
          Discover independent music, support artists directly, and give DJs a better way to find
          what comes next.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/sign-up?role=fan"
            className="rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600"
          >
            Start Listening
          </Link>
          <Link
            to="/sign-up?role=artist"
            className="rounded-xl border border-surface-border bg-surface-2 px-6 py-3.5 text-sm font-semibold text-ink-0 hover:bg-surface-3"
          >
            Join as an Artist
          </Link>
          <Link
            to="/sign-up?role=dj"
            className="rounded-xl border border-surface-border bg-surface-2 px-6 py-3.5 text-sm font-semibold text-ink-0 hover:bg-surface-3"
          >
            Join as a DJ
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.tag}
            className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-1 p-8"
          >
            <section.icon className={`h-8 w-8 ${section.accent}`} />
            <h2 className="text-xs font-bold tracking-widest text-ink-3">{section.tag}</h2>
            <p className="flex-1 text-sm leading-relaxed text-ink-1">{section.copy}</p>
            <Link
              to={section.cta.to}
              className="text-sm font-semibold text-ink-0 underline decoration-surface-border underline-offset-4 hover:decoration-ink-0"
            >
              {section.cta.label} &rarr;
            </Link>
          </div>
        ))}
      </section>

      <footer className="border-t border-surface-border px-6 py-8 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} Wavelength. Built for independent artists, fans, and DJs.
      </footer>
    </div>
  )
}

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Copy, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { BrandMark } from '@/components/common/BrandMark'
import { useSeo } from '@/lib/seo'
import { useSmartBack } from '@/hooks/useSmartBack'

type ToolCategory = 'artist' | 'dj'

const CATEGORY_LABEL: Record<ToolCategory, string> = { artist: 'For artists', dj: 'For DJs' }

const toolLinks: { label: string; href: string; category: ToolCategory; blurb: string }[] = [
  { label: 'Release planner', href: '/tools/release-planner', category: 'artist', blurb: 'Build a week-by-week timeline for your next single, EP or album.' },
  { label: 'Artist bio generator', href: '/tools/artist-bio-generator', category: 'artist', blurb: 'Draft a bio for your Spotify profile, press kit or website.' },
  { label: 'DJ licence request tool', href: '/tools/dj-licence-request', category: 'dj', blurb: 'Send a clear, professional first message to request a track licence.' },
  { label: 'DJ name generator', href: '/tools/dj-name-generator', category: 'dj', blurb: 'Four real stage-name options built from your sound, mood and location.' },
  { label: 'Song title generator', href: '/tools/song-title-generator', category: 'artist', blurb: 'Six title directions from your theme, genre and mood — not just your words reshuffled.' },
  { label: 'Royalty calculator', href: '/tools/royalty-calculator', category: 'artist', blurb: 'Estimate what a release could earn from streams.' },
  { label: 'BPM and key finder', href: '/tools/bpm-key-finder', category: 'dj', blurb: 'Real Camelot-wheel key matches and compatible tempos, worked out properly.' },
  { label: 'Playlist pitch template', href: '/tools/playlist-pitch-template', category: 'artist', blurb: 'Write a focused pitch for an editor, curator or DJ.' },
  { label: 'Social caption generator', href: '/tools/social-caption-generator', category: 'artist', blurb: 'Generate launch, behind-the-scenes and thank-you captions.' },
  { label: 'DJ setlist planner', href: '/tools/dj-setlist-planner', category: 'dj', blurb: 'Map the energy arc of your next set from warm-up to close.' },
  { label: 'Music genre guide', href: '/tools/music-genre-guide', category: 'artist', blurb: 'Look up a genre’s real tempo range, description and related styles.' },
]

function ToolShell({ eyebrow, title, description, path, children }: { eyebrow: string; title: string; description: string; path: string; children: ReactNode }) {
  useSeo({ title, description, path })
  // The hub page itself (/tools) falls back to the homepage; every individual tool page falls
  // back to the hub — so a tool opened via a direct/shared link (no in-app history) still goes
  // somewhere sensible instead of navigate(-1) silently doing nothing.
  const goBack = useSmartBack(path === '/tools' ? '/' : '/tools')
  return <div className="min-h-svh bg-surface-0 text-ink-0">
    <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="shrink-0"><BrandMark /></Link>
          <button type="button" onClick={goBack} className="flex shrink-0 items-center gap-1.5 text-sm text-ink-2 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-4">{path !== '/tools' ? <Link to="/tools" className="hidden text-sm text-ink-2 hover:text-white sm:block">All tools</Link> : null}<Link to="/sign-up?role=artist" className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-surface-0">Join free</Link></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="eyebrow">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">{title}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-ink-2">{description}</p>
      <div className="mt-12">{children}</div>
    </main>
  </div>
}

function OutputCard({ value, onCopy }: { value: string; onCopy: () => void }) {
  return <div className="rounded-2xl border border-brand-400/25 bg-brand-400/[0.06] p-5"><div className="flex items-center justify-between gap-4"><p className="eyebrow">Your result</p><button type="button" onClick={onCopy} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink-1 hover:text-white"><Copy className="h-3.5 w-3.5" /> Copy</button></div><pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-ink-1">{value}</pre><Link to="/sign-up?role=artist" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-400 hover:text-brand-300">Save this in BackTheVibes <ArrowRight className="h-4 w-4" /></Link></div>
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-ink-1">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink-0 outline-none placeholder:text-ink-3 focus:border-brand-400/60" /></label>
}

/** Raw user input is often all-lowercase — inserting it straight into a title/name looked sloppy. */
function titleCase(input: string): string {
  return input.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

/** Deterministic (not random) so the same inputs always produce the same suggestions. */
function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  return hash
}

function pick<T>(list: T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length]
}

export function ToolsHubPage() {
  useSeo({ title: 'Free Music Tools for Artists and DJs', description: 'Free practical tools for independent artists and DJs: plan releases, write an artist bio, and prepare professional licence requests.', path: '/tools' })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | ToolCategory>('all')
  const [expanded, setExpanded] = useState(false)
  // Dumping all 11 cards on screen at once is mostly a mobile problem (one column, so it's 11
  // full-height cards of scroll) — cap the initial view and let a search/category pick or this
  // button reveal the rest, rather than always showing the whole list up front.
  const COLLAPSED_COUNT = 6

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return toolLinks.filter((tool) => {
      const matchesCategory = category === 'all' || tool.category === category
      const matchesQuery = !q || tool.label.toLowerCase().includes(q) || tool.blurb.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [query, category])
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT)
  const hiddenCount = filtered.length - visible.length

  return <ToolShell eyebrow="BackTheVibes tools" title="Useful tools for the people moving music forward." description="Free, practical tools for independent artists and DJs. Use them without an account, then save your work in BackTheVibes when you are ready." path="/tools">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setExpanded(false) }}
          placeholder="Search tools…"
          aria-label="Search tools"
          className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-ink-0 outline-none placeholder:text-ink-3 focus:border-brand-400/60"
        />
      </div>
      <div className="flex items-center gap-2">
        {(['all', 'artist', 'dj'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => { setCategory(option); setExpanded(false) }}
            className={clsx(
              'rounded-full border px-4 py-2 text-xs font-semibold transition',
              category === option ? 'border-brand-400/50 bg-brand-400/15 text-brand-300' : 'border-white/10 bg-white/[0.03] text-ink-2 hover:text-white',
            )}
          >
            {option === 'all' ? 'All tools' : CATEGORY_LABEL[option]}
          </button>
        ))}
      </div>
    </div>

    {filtered.length === 0 ? (
      <p className="mt-12 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm leading-6 text-ink-2">
        No tools match "{query}". Try a different search or clear the filter.
      </p>
    ) : (
      <>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {visible.map((tool, index) => (
            <Link key={tool.href} to={tool.href} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-brand-400/40">
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-400">{String(index + 1).padStart(2, '0')}</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">{CATEGORY_LABEL[tool.category]}</span>
              </div>
              <h2 className="mt-8 text-xl font-medium">{tool.label}</h2>
              <p className="mt-3 text-sm leading-6 text-ink-2">{tool.blurb}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-1 group-hover:text-brand-400">Open tool <ArrowRight className="h-4 w-4" /></span>
            </Link>
          ))}
        </div>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mx-auto mt-8 block rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-ink-1 transition hover:border-brand-400/40 hover:text-white"
          >
            Show {hiddenCount} more tool{hiddenCount === 1 ? '' : 's'}
          </button>
        ) : null}
      </>
    )}
  </ToolShell>
}

const RELEASE_TIMELINES: Record<string, string> = {
  single: '4 weeks before — Lock the final master, artwork and metadata.\n3 weeks before — Submit playlist pitches and set up your pre-save link.\n2 weeks before — Announce the release date and start teaser content.\n1 week before — Send private previews to press, DJs and playlist contacts.\nRelease day — Publish everywhere, email your list, post your launch content.\n1 week after — Share early numbers, thank supporters, start planning the next single.',
  EP: '8 weeks before — Lock the masters, artwork, credits and split sheet for every track.\n6 weeks before — Prepare the private preview, press notes and pre-save link.\n4 weeks before — Submit playlist pitches and announce the release date.\n2 weeks before — Share short-form content, DJ promos and your artist story.\nRelease week — Publish everywhere, email supporters and respond to listeners.\n2 weeks after — Share results, thank supporters and plan the next release.',
  album: '12 weeks before — Finalise track sequencing, masters, artwork and full credits.\n10 weeks before — Line up press, playlist and radio contacts; start your pre-save campaign.\n8 weeks before — Release a lead single to open the campaign.\n6 weeks before — Release a second single or focus track.\n4 weeks before — Announce the full release date and tracklist.\n2 weeks before — Send private previews to press, DJs and key supporters.\nRelease week — Publish everywhere, email your list, talk about the record while it is fresh.\n2 weeks after — Share results and any press, thank supporters, plan what comes next.',
}

export function ReleasePlannerPage() {
  const [artist, setArtist] = useState('')
  const [date, setDate] = useState('')
  const [format, setFormat] = useState('single')
  const [result, setResult] = useState('')
  const makePlan = (event: FormEvent) => {
    event.preventDefault()
    const release = date.trim() || 'your release date'
    setResult(`Release plan for ${artist.trim() || 'your project'} — ${format}\n\n${RELEASE_TIMELINES[format]}\n\nTarget date: ${release}`)
  }
  return <ToolShell eyebrow="Free release planner" title="Plan your music release without missing the important bits." description="Create a practical release timeline for a single, EP or album. Use it as a working checklist for your next campaign." path="/tools/release-planner"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={makePlan} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Artist or project name" value={artist} onChange={setArtist} placeholder="e.g. Northside Static" /><Field label="Release date" value={date} onChange={setDate} placeholder="e.g. 12 October 2026" /><label className="block"><span className="mb-2 block text-sm font-medium text-ink-1">Release format</span><select value={format} onChange={(event) => setFormat(event.target.value)} className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-ink-0"><option value="single">Single</option><option value="EP">EP</option><option value="album">Album</option></select></label><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Build my plan</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Your release timeline will appear here. It is free to use—sign up only when you want to save it.</div>}</div></ToolShell>
}

export function ArtistBioGeneratorPage() {
  const [name, setName] = useState(''); const [genre, setGenre] = useState(''); const [location, setLocation] = useState(''); const [influences, setInfluences] = useState(''); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => {
    event.preventDefault()
    const artistName = name.trim() || 'This artist'
    const genreText = genre.trim() || 'independent music'
    const article = /^[aeiou]/i.test(genreText) ? 'an' : 'a'
    const locationText = location.trim()
    const influenceText = influences.trim()
    const possessive = name.trim() ? `${artistName}'s` : 'Their'

    const oneLine = `${artistName} is ${article} ${genreText} artist${locationText ? ` from ${locationText}` : ''}.`
    const shortBio = `${artistName} is ${article} ${genreText} artist${locationText ? ` based in ${locationText}` : ''}${influenceText ? `, drawing on ${influenceText}` : ''}. ${possessive} releases are built around ${genreText} production, made for listeners who play tracks all the way through.`
    const pressBio = `${artistName}${locationText ? `, out of ${locationText},` : ''} makes ${genreText}${influenceText ? ` shaped by ${influenceText}` : ''}. ${possessive} approach favours songs with a clear identity over disposable filler — the kind of catalogue built one deliberate release at a time.`

    setResult(`One-line (socials, DJ submissions):\n${oneLine}\n\nShort bio (Spotify, streaming profiles):\n${shortBio}\n\nPress bio (press kit, website):\n${pressBio}\n\nThese are a starting point, not a finished bio — replace any word that doesn't sound like something you'd actually say, and add one specific detail (a release, a show, a story) that only applies to you.`)
  }
  return <ToolShell eyebrow="Free artist bio generator" title="Write an artist bio that sounds like you." description="Generate three starting points — a one-liner, a streaming-profile bio and a press bio — for your Spotify profile, press kit, website or DJ submission." path="/tools/artist-bio-generator"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Artist name" value={name} onChange={setName} placeholder="e.g. Northside Static" /><Field label="Genre or sound" value={genre} onChange={setGenre} placeholder="e.g. electronic soul" /><Field label="Based in" value={location} onChange={setLocation} placeholder="e.g. Manchester" /><Field label="Influences" value={influences} onChange={setInfluences} placeholder="e.g. late-night jazz and warehouse techno" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Generate my bio</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Start with four details and you’ll get three bio lengths to edit from.</div>}</div></ToolShell>
}

export function DjLicenceRequestPage() {
  const [dj, setDj] = useState(''); const [artist, setArtist] = useState(''); const [track, setTrack] = useState(''); const [use, setUse] = useState('live sets'); const [territory, setTerritory] = useState('UK'); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => { event.preventDefault(); setResult(`Hi ${artist || 'there'},\n\nI’m ${dj || 'a DJ'} and I’d love to use “${track || 'your track'}” for ${use} in ${territory}. I found the track through BackTheVibes and wanted to ask about the licence terms, permitted use, duration and price.\n\nI’m happy to share more context about the set or project, and I’d like to keep everything clear in a written agreement before downloading or using the full-quality file.\n\nThanks,\n${dj || 'Your name'}`) }
  return <ToolShell eyebrow="Free DJ licence request tool" title="Send a clear, professional track licence request." description="Prepare a respectful first message for an artist. Set out your intended use and leave the legal terms ready to agree in writing." path="/tools/dj-licence-request"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Your DJ name" value={dj} onChange={setDj} placeholder="e.g. Maya Flux" /><Field label="Artist name" value={artist} onChange={setArtist} placeholder="e.g. Northside Static" /><Field label="Track title" value={track} onChange={setTrack} placeholder="e.g. Afterimage" /><Field label="Intended use" value={use} onChange={setUse} placeholder="e.g. live sets, radio or a recorded mix" /><Field label="Territory" value={territory} onChange={setTerritory} placeholder="e.g. UK and Ireland" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Create request</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">A clear request helps artists understand your use case and makes the next conversation easier.</div>}</div></ToolShell>
}

function QuickTool({ eyebrow, title, description, path, labels, makeResult }: { eyebrow: string; title: string; description: string; path: string; labels: string[]; makeResult: (values: string[]) => string }) {
  const [values, setValues] = useState(labels.map(() => ''))
  const [result, setResult] = useState('')
  return <ToolShell eyebrow={eyebrow} title={title} description={description} path={path}><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={(event) => { event.preventDefault(); setResult(makeResult(values)) }} className="space-y-5 rounded-2xl border border-white/[0.08] p-6">{labels.map((label, index) => <Field key={label} label={label} value={values[index]} onChange={(value) => setValues((current) => current.map((item, i) => i === index ? value : item))} />)}<button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Generate result</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Enter a few details and your result will appear here.</div>}</div></ToolShell>
}

const DJ_ADJECTIVES = ['Neon', 'Velvet', 'Crimson', 'Electric', 'Midnight', 'Golden', 'Obsidian', 'Solar', 'Radiant', 'Wild', 'Sonic', 'Crystal', 'Shadow', 'Static', 'Amber']
const DJ_NOUNS = ['Pulse', 'Wave', 'Echo', 'Drift', 'Bloom', 'Storm', 'Current', 'Flux', 'Horizon', 'Circuit', 'Ember', 'Tide', 'Frequency', 'Mirage', 'Nova']

export function DjNameGeneratorPage() {
  const [sound, setSound] = useState(''); const [mood, setMood] = useState(''); const [location, setLocation] = useState(''); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => {
    event.preventDefault()
    const seed = hashString(`${sound}|${mood}|${location}`)
    const soundWord = titleCase(sound)
    const moodWord = titleCase(mood)
    const names = [
      `DJ ${pick(DJ_ADJECTIVES, seed)} ${pick(DJ_NOUNS, seed >> 2)}`,
      moodWord && soundWord ? `DJ ${moodWord} ${soundWord}` : `DJ ${pick(DJ_ADJECTIVES, seed + 7)} ${pick(DJ_NOUNS, seed + 3)}`,
      soundWord ? `DJ ${soundWord} ${pick(DJ_NOUNS, seed + 11)}` : `DJ ${pick(DJ_ADJECTIVES, seed + 11)} ${pick(DJ_NOUNS, seed + 17)}`,
      `DJ ${pick(DJ_ADJECTIVES, seed + 19)} ${pick(DJ_NOUNS, seed + 23)}`,
    ]
    setResult(`${[...new Set(names)].join('\n')}\n\nTip: say each one out loud, search it on Spotify/Instagram/SoundCloud before you commit, and pick a name you'd still want in five years.`)
  }
  return <ToolShell eyebrow="Free DJ name generator" title="Find a DJ name with a sound of its own." description="Get four stage-name options built from your sound, mood and location — then check availability before using one." path="/tools/dj-name-generator"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Sound or genre" value={sound} onChange={setSound} placeholder="e.g. house" /><Field label="Mood" value={mood} onChange={setMood} placeholder="e.g. dark" /><Field label="Location (optional)" value={location} onChange={setLocation} placeholder="e.g. Bristol" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Generate names</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Even with nothing filled in, you'll get four usable options.</div>}</div></ToolShell>
}

export function SongTitleGeneratorPage() {
  const [theme, setTheme] = useState(''); const [genre, setGenre] = useState(''); const [mood, setMood] = useState(''); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => {
    event.preventDefault()
    const t = titleCase(theme) || 'Fading Light'
    const g = titleCase(genre)
    const m = titleCase(mood) || 'Quiet'
    const titles = [t, `${m} ${t}`, `${t} (${m} Mix)`, g ? `${g} ${t}` : `Last ${t}`, `The ${m} Hours`, `${t}, Undone`]
    setResult(`${[...new Set(titles)].join('\n')}\n\nTip: shortlist two or three, say them out loud, and check they're not already taken on streaming platforms before you lock one in.`)
  }
  return <ToolShell eyebrow="Free song title generator" title="Turn a track idea into a title worth remembering." description="Get six title directions from your theme, genre and mood — starting points to react to, not a replacement for your own story." path="/tools/song-title-generator"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Theme or story" value={theme} onChange={setTheme} placeholder="e.g. heartbreak" /><Field label="Genre" value={genre} onChange={setGenre} placeholder="e.g. house" /><Field label="Mood" value={mood} onChange={setMood} placeholder="e.g. euphoric" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Generate titles</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Add a theme and you'll get six real title directions, not just your words shuffled around.</div>}</div></ToolShell>
}

export function RoyaltyCalculatorPage() { return <QuickTool eyebrow="Streaming royalty calculator" title="Estimate what a release could earn from streams." description="A simple planning estimate—not a payout statement. Actual royalties vary by platform, territory, rights split and distributor." path="/tools/royalty-calculator" labels={['Monthly streams', 'Estimated rate per stream (£)', 'Your ownership percentage']} makeResult={([streams, rate, share]) => { const total = (Number(streams) || 0) * (Number(rate) || 0); const owned = total * ((Number(share) || 100) / 100); return `Estimated gross: £${total.toFixed(2)}\nEstimated artist share: £${owned.toFixed(2)}\n\nThis excludes taxes, distributor fees, label splits and platform-specific adjustments.` }} /> }

/** Standard Camelot wheel mapping — enough to give a real, correct harmonic-mixing answer instead of just repeating whatever the user typed back at them. */
const CAMELOT_BY_KEY: Record<string, string> = {
  'g# minor': '1A', 'ab minor': '1A', 'b major': '1B',
  'd# minor': '2A', 'eb minor': '2A', 'f# major': '2B', 'gb major': '2B',
  'a# minor': '3A', 'bb minor': '3A', 'c# major': '3B', 'db major': '3B',
  'f minor': '4A', 'ab major': '4B', 'g# major': '4B',
  'c minor': '5A', 'd# major': '5B', 'eb major': '5B',
  'g minor': '6A', 'a# major': '6B', 'bb major': '6B',
  'd minor': '7A', 'f major': '7B',
  'a minor': '8A', 'c major': '8B',
  'e minor': '9A', 'g major': '9B',
  'b minor': '10A', 'd major': '10B',
  'f# minor': '11A', 'gb minor': '11A', 'a major': '11B',
  'c# minor': '12A', 'db minor': '12A', 'e major': '12B',
}
function normalizeKeyInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\bmaj\b/g, 'major').replace(/\bmin\b/g, 'minor')
}
function toCamelot(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (/^\d{1,2}[AB]$/.test(compact)) return compact
  return CAMELOT_BY_KEY[normalizeKeyInput(raw)] ?? null
}
function camelotNeighbours(code: string): string[] {
  const match = code.match(/^(\d{1,2})([AB])$/)
  if (!match) return []
  const number = Number(match[1])
  const letter = match[2]
  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1
  return [`${wrap(number - 1)}${letter}`, `${wrap(number + 1)}${letter}`, `${number}${letter === 'A' ? 'B' : 'A'}`]
}
export function BpmKeyFinderPage() {
  const [bpm, setBpm] = useState(''); const [key, setKey] = useState(''); const [position, setPosition] = useState(''); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => {
    event.preventDefault()
    const value = Number(bpm) || 120
    const camelot = key.trim() ? toCamelot(key) : null
    const keyLine = camelot
      ? `Key: ${key.trim()} (Camelot ${camelot}) — compatible: ${camelotNeighbours(camelot).join(', ')}`
      : key.trim()
        ? `Key: ${key.trim()} — not recognised, try a format like "C minor" or "8A" for a compatible-key match`
        : 'Key: add one to get compatible keys'
    setResult(`Track notes\nBPM: ${value}\n${keyLine}\nPosition: ${position.trim() || 'warm-up or transition'}\n\nCompatible tempos: ${value - 3}–${value + 3} BPM.${camelot ? ' The compatible keys above share the closest harmonic relationship on the Camelot wheel — one step either side, or the relative major/minor.' : ''}`)
  }
  return <ToolShell eyebrow="BPM and key finder" title="Prepare tracks for smoother mixes." description="Turn a track's BPM and musical key into real harmonic-mixing notes — actual Camelot wheel matches, not a repeat of what you typed." path="/tools/bpm-key-finder"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Track BPM" value={bpm} onChange={setBpm} placeholder="e.g. 126" /><Field label="Musical key (e.g. 8A or C minor)" value={key} onChange={setKey} placeholder="e.g. C minor" /><Field label="Where it sits in the set" value={position} onChange={setPosition} placeholder="e.g. warm-up, peak-time, closing" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Get mixing notes</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Add a BPM and key and you'll get real compatible tempos and keys, worked out properly.</div>}</div></ToolShell>
}

export function PlaylistPitchTemplatePage() { return <QuickTool eyebrow="Playlist pitch template" title="Write a focused pitch for your next release." description="Prepare the core information an editor, curator or DJ needs: what the track is, who it is for and why now." path="/tools/playlist-pitch-template" labels={['Artist and track', 'Genre and mood', 'Release date', 'One-line story']} makeResult={([track, genre, date, story]) => `Subject: ${track || 'New release'} — playlist consideration\n\nHi,\n\nI’m sharing ${track || 'a new track'}, a ${genre || 'genre-blending'} release arriving ${date || 'soon'}. ${story || 'It is built for listeners looking for something fresh and emotionally direct.'}\n\nThanks for listening,\n${track || 'The artist'}`} /> }
export function SocialCaptionGeneratorPage() { return <QuickTool eyebrow="Music social caption generator" title="Create captions that give your release a reason to be heard." description="Generate launch, behind-the-scenes and thank-you caption prompts for Instagram, TikTok or your community." path="/tools/social-caption-generator" labels={['Artist or track', 'Release moment', 'Call to action']} makeResult={([track, moment, call]) => [`${track || 'The new release'} is out. ${moment || 'Made for late nights and loud headphones.'} Listen now — ${call || 'link in bio.'}`, `A little look behind ${track || 'the track'}. ${moment || 'Every layer has a story.'} ${call || 'Tell us what you hear first.'}`, `${track || 'New music'} is yours now. Thanks for being here while it took shape. ${call || 'Press play and share it with someone who needs it.'}`].join('\n\n')} /> }
export function DjSetlistPlannerPage() { return <QuickTool eyebrow="DJ setlist planner" title="Shape the energy arc of your next DJ set." description="Map a set from warm-up to close so your track choices have room to breathe." path="/tools/dj-setlist-planner" labels={['Set length in minutes', 'Starting energy (1–10)', 'Closing energy (1–10)']} makeResult={([length, start, end]) => { const minutes = Number(length) || 60; const opening = Number(start) || 4; const closing = Number(end) || 8; return `Set arc — ${minutes} minutes\n\n0–${Math.round(minutes * .2)} min: Warm-up and establish the room (energy ${opening}/10).\n${Math.round(minutes * .2)}–${Math.round(minutes * .65)} min: Build tension, introduce your signature selections.\n${Math.round(minutes * .65)}–${Math.round(minutes * .85)} min: Peak-time run (energy ${Math.max(opening, closing - 1)}/10).\n${Math.round(minutes * .85)}–${minutes} min: Close with intention (energy ${closing}/10).\n\nLeave space for the room—this is a map, not a script.` }} /> }

const GENRE_GUIDE: Record<string, { bpm: string; description: string; related: string[] }> = {
  house: { bpm: '120–128 BPM', description: 'Four-on-the-floor dance music built on a steady kick, off-beat hi-hats and a looping bassline — rooted in 1980s Chicago club culture.', related: ['Deep house', 'Tech house', 'Afro house', 'Disco house'] },
  techno: { bpm: '125–150 BPM', description: 'Repetitive, machine-driven electronic music focused on rhythm and texture over vocals or melody — born in 1980s Detroit.', related: ['Minimal techno', 'Melodic techno', 'Hard techno', 'Acid techno'] },
  'drum and bass': { bpm: '160–180 BPM', description: 'Fast breakbeats paired with heavy sub-bass — UK-originated, split between rolling liquid sounds and harder neurofunk/jump-up styles.', related: ['Liquid DnB', 'Neurofunk', 'Jungle', 'Jump-up'] },
  dubstep: { bpm: '138–142 BPM', description: 'Half-time, bass-heavy electronic music built around space, sub-bass weight and a signature wobble or growl.', related: ['Riddim', 'Brostep', 'Future bass', 'UK bass'] },
  trance: { bpm: '128–140 BPM', description: 'Melodic, euphoric electronic music built around building breakdowns and big, emotional drops.', related: ['Progressive trance', 'Uplifting trance', 'Psytrance', 'Tech trance'] },
  'hip hop': { bpm: '80–100 BPM', description: 'Beat and rhyme-driven music built from sampled or programmed drums, bass and rhythmic vocal delivery.', related: ['Boom bap', 'Trap', 'Lo-fi hip hop', 'Drill'] },
  trap: { bpm: '130–170 BPM (often felt at half-time)', description: 'Hip-hop-rooted style built on rapid hi-hats, 808 sub-bass and sparse, heavy drums.', related: ['Hip hop', 'Drill', 'Phonk', 'Trap soul'] },
  'r&b': { bpm: '60–90 BPM', description: 'Vocal-led music blending soul, funk and pop songwriting with smooth, groove-based production.', related: ['Neo-soul', 'Alternative R&B', 'Contemporary R&B'] },
  pop: { bpm: '100–130 BPM', description: 'Hook-driven, broadly accessible music built for immediate melodic impact and repeat listening.', related: ['Synth-pop', 'Indie pop', 'Dance-pop', 'Pop-rock'] },
  'indie rock': { bpm: '110–140 BPM', description: 'Guitar-led music produced outside major-label systems, often prioritising songwriting character over polish.', related: ['Indie folk', 'Post-punk revival', 'Dream pop', 'Garage rock'] },
  folk: { bpm: '70–110 BPM', description: 'Acoustic, storytelling-focused music rooted in traditional song structures and instrumentation.', related: ['Indie folk', 'Singer-songwriter', 'Folk-pop', 'Americana'] },
  ambient: { bpm: 'often no fixed tempo', description: 'Atmospheric, texture-first music designed to create mood and space rather than drive movement.', related: ['Downtempo', 'Drone', 'Ambient techno', 'Chillout'] },
  'lo-fi': { bpm: '70–90 BPM', description: 'Warm, imperfect-sounding production — tape hiss, soft drums and jazzy chords — built for background listening and focus.', related: ['Lo-fi hip hop', 'Chillhop', 'Jazzhop'] },
  afrobeats: { bpm: '95–115 BPM', description: 'West African-rooted, groove-led pop music blending highlife, hip-hop and dancehall influences.', related: ['Amapiano', 'Afro-fusion', 'Afro-pop', 'Highlife'] },
  amapiano: { bpm: '110–115 BPM', description: 'South African house-adjacent style built on deep basslines, jazzy chords and the signature "log drum" sound.', related: ['Afrobeats', 'Deep house', 'Afro house'] },
  'uk garage': { bpm: '130–140 BPM', description: 'Syncopated, shuffled rhythms with chopped vocals — a foundational UK dance sound.', related: ['2-step', 'Speed garage', 'Bassline', 'UK funky'] },
  disco: { bpm: '110–130 BPM', description: 'Groove-driven, orchestrated dance music built on four-on-the-floor rhythm, basslines and lush arrangement.', related: ['Nu-disco', 'Funk', 'House'] },
  jazz: { bpm: 'varies widely', description: 'Improvisation-centred music built on complex harmony, swing feel and live interplay between musicians.', related: ['Nu-jazz', 'Jazz-funk', 'Lo-fi jazz'] },
  reggae: { bpm: '60–90 BPM', description: 'Jamaican-rooted music defined by its off-beat guitar/keyboard skank and heavy, melodic basslines.', related: ['Dancehall', 'Dub', 'Roots reggae'] },
  country: { bpm: '100–130 BPM', description: 'Storytelling-focused music rooted in American folk, blues and Western traditions, usually guitar and vocal-led.', related: ['Country-pop', 'Americana', 'Alt-country'] },
}
/** Real-world search terms people actually type, mapped to the canonical GENRE_GUIDE key. */
const GENRE_ALIASES: Record<string, string> = {
  dnb: 'drum and bass', 'd&b': 'drum and bass', dandb: 'drum and bass', jungle: 'drum and bass',
  rnb: 'r&b', randb: 'r&b',
  'hip-hop': 'hip hop', hiphop: 'hip hop',
  'lofi': 'lo-fi', 'lo fi': 'lo-fi',
  garage: 'uk garage', ukg: 'uk garage',
  edm: 'trance', dance: 'house', rock: 'indie rock', 'indie': 'indie rock',
  dancehall: 'reggae', dub: 'reggae',
}
export function MusicGenreGuidePage() {
  const [sound, setSound] = useState(''); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => {
    event.preventDefault()
    const key = GENRE_ALIASES[sound.trim().toLowerCase()] ?? sound.trim().toLowerCase()
    const match = GENRE_GUIDE[key] ?? Object.entries(GENRE_GUIDE).find(([name]) => key.length > 2 && (name.includes(key) || key.includes(name)))?.[1]
    setResult(
      match
        ? `${titleCase(sound)}\nTypical tempo: ${match.bpm}\n\n${match.description}\n\nRelated genres to explore: ${match.related.join(', ')}`
        : `We don't have "${sound.trim()}" in the guide yet. Try one of these: ${Object.keys(GENRE_GUIDE).map(titleCase).slice(0, 8).join(', ')}.`,
    )
  }
  return <ToolShell eyebrow="Music genre guide" title="Look up a genre's tempo, sound and neighbours." description="A real reference, not a paraphrase of what you typed — search a genre for its typical BPM range, a plain-English description and related styles to explore." path="/tools/music-genre-guide"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Genre" value={sound} onChange={setSound} placeholder="e.g. house, drum and bass, lo-fi" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Look it up</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Covers 19 common genres — house, techno, DnB, hip hop, folk and more.</div>}</div></ToolShell>
}

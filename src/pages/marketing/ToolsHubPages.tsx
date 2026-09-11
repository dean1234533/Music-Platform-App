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
  { label: 'DJ name generator', href: '/tools/dj-name-generator', category: 'dj', blurb: 'Get stage-name ideas built from your sound, mood and location.' },
  { label: 'Song title generator', href: '/tools/song-title-generator', category: 'artist', blurb: 'Turn a track idea into a shortlist of title directions.' },
  { label: 'Royalty calculator', href: '/tools/royalty-calculator', category: 'artist', blurb: 'Estimate what a release could earn from streams.' },
  { label: 'BPM and key finder', href: '/tools/bpm-key-finder', category: 'dj', blurb: 'Turn a track’s BPM and key into practical mixing notes.' },
  { label: 'Playlist pitch template', href: '/tools/playlist-pitch-template', category: 'artist', blurb: 'Write a focused pitch for an editor, curator or DJ.' },
  { label: 'Social caption generator', href: '/tools/social-caption-generator', category: 'artist', blurb: 'Generate launch, behind-the-scenes and thank-you captions.' },
  { label: 'DJ setlist planner', href: '/tools/dj-setlist-planner', category: 'dj', blurb: 'Map the energy arc of your next set from warm-up to close.' },
  { label: 'Music genre guide', href: '/tools/music-genre-guide', category: 'artist', blurb: 'Find the language to describe your sound clearly.' },
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

export function ReleasePlannerPage() {
  const [artist, setArtist] = useState('')
  const [date, setDate] = useState('')
  const [format, setFormat] = useState('single')
  const [result, setResult] = useState('')
  const makePlan = (event: FormEvent) => { event.preventDefault(); const release = date || 'your release date'; setResult(`Release plan for ${artist || 'your artist project'}\n\n8 weeks before — Lock the master, artwork, credits and split sheet.\n6 weeks before — Prepare the private preview, press notes and pre-save link.\n4 weeks before — Submit playlist pitches and announce the release date.\n2 weeks before — Share short-form content, DJ promos and your artist story.\nRelease week — Publish everywhere, email supporters and respond to listeners.\n2 weeks after — Share results, thank supporters and plan the next beat.\n\nTarget date: ${release}\nFormat: ${format}`) }
  return <ToolShell eyebrow="Free release planner" title="Plan your music release without missing the important bits." description="Create a practical release timeline for a single, EP or album. Use it as a working checklist for your next campaign." path="/tools/release-planner"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={makePlan} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Artist or project name" value={artist} onChange={setArtist} placeholder="e.g. Northside Static" /><Field label="Release date" value={date} onChange={setDate} placeholder="e.g. 12 October 2026" /><label className="block"><span className="mb-2 block text-sm font-medium text-ink-1">Release format</span><select value={format} onChange={(event) => setFormat(event.target.value)} className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-ink-0"><option value="single">Single</option><option value="EP">EP</option><option value="album">Album</option></select></label><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Build my plan</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Your release timeline will appear here. It is free to use—sign up only when you want to save it.</div>}</div></ToolShell>
}

export function ArtistBioGeneratorPage() {
  const [name, setName] = useState(''); const [genre, setGenre] = useState(''); const [location, setLocation] = useState(''); const [influences, setInfluences] = useState(''); const [result, setResult] = useState('')
  const generate = (event: FormEvent) => { event.preventDefault(); setResult(`${name || 'This artist'} is an independent ${genre || 'music'} artist from ${location || 'the independent scene'}. Drawing on ${influences || 'a wide range of influences'}, ${name || 'their project'} makes music with a clear point of view—built for listeners who want something real, distinctive and worth returning to.\n\nWith each release, ${name || 'this artist'} is building a direct connection with fans and creating a catalogue that moves on its own terms.`) }
  return <ToolShell eyebrow="Free artist bio generator" title="Write an artist bio that sounds like you." description="Generate a starting point for your Spotify profile, press kit, website or DJ submission. Edit the result until it feels unmistakably yours." path="/tools/artist-bio-generator"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={generate} className="space-y-5 rounded-2xl border border-white/[0.08] p-6"><Field label="Artist name" value={name} onChange={setName} placeholder="e.g. Northside Static" /><Field label="Genre or sound" value={genre} onChange={setGenre} placeholder="e.g. electronic soul" /><Field label="Based in" value={location} onChange={setLocation} placeholder="e.g. Manchester" /><Field label="Influences" value={influences} onChange={setInfluences} placeholder="e.g. late-night jazz and warehouse techno" /><button type="submit" className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-surface-0 hover:bg-brand-400">Generate my bio</button></form>{result ? <OutputCard value={result} onCopy={() => void navigator.clipboard?.writeText(result)} /> : <div className="flex items-center rounded-2xl border border-dashed border-white/10 p-8 text-sm leading-6 text-ink-2">Start with four details and you’ll have a polished bio draft in seconds.</div>}</div></ToolShell>
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

export function DjNameGeneratorPage() { return <QuickTool eyebrow="Free DJ name generator" title="Find a DJ name with a sound of its own." description="Generate stage-name ideas from your sound, mood and location. Shortlist the ones that feel memorable and check availability before using one." path="/tools/dj-name-generator" labels={['Sound or genre', 'Mood', 'Location']} makeResult={([sound, mood, location]) => `DJ ${[mood || 'Neon', sound || 'Pulse', location || 'FM'].join(' ')}\n${[sound || 'Midnight', mood || 'Signal', location || 'Select'].join(' ')}\n${mood || 'Low'} ${sound || 'Frequency'}\n\nTip: say each option out loud, search it on social platforms, and choose a name you can own consistently.`} /> }
export function SongTitleGeneratorPage() { return <QuickTool eyebrow="Free song title generator" title="Turn a track idea into a title worth remembering." description="Create a small set of title directions from your theme, genre and mood. Use them as prompts, not a substitute for your own story." path="/tools/song-title-generator" labels={['Theme or story', 'Genre', 'Mood']} makeResult={([theme, genre, mood]) => [`${theme || 'After'} ${mood || 'Hours'}`, `${mood || 'Electric'} ${theme || 'Memory'}`, `${genre || 'Open'} ${theme || 'Road'}`, `The ${mood || 'Quiet'} ${theme || 'Signal'}`].join('\n')} /> }
export function RoyaltyCalculatorPage() { return <QuickTool eyebrow="Streaming royalty calculator" title="Estimate what a release could earn from streams." description="A simple planning estimate—not a payout statement. Actual royalties vary by platform, territory, rights split and distributor." path="/tools/royalty-calculator" labels={['Monthly streams', 'Estimated rate per stream (£)', 'Your ownership percentage']} makeResult={([streams, rate, share]) => { const total = (Number(streams) || 0) * (Number(rate) || 0); const owned = total * ((Number(share) || 100) / 100); return `Estimated gross: £${total.toFixed(2)}\nEstimated artist share: £${owned.toFixed(2)}\n\nThis excludes taxes, distributor fees, label splits and platform-specific adjustments.` }} /> }
export function BpmKeyFinderPage() { return <QuickTool eyebrow="BPM and key finder" title="Prepare tracks for smoother mixes." description="Turn a track’s BPM and musical key into practical DJ notes: compatible neighbours, energy direction and set placement." path="/tools/bpm-key-finder" labels={['Track BPM', 'Musical key (e.g. 8A or C minor)', 'Set position']} makeResult={([bpm, key, position]) => { const value = Number(bpm) || 120; return `Track notes\nBPM: ${value}\nKey: ${key || 'Add the key'}\nPosition: ${position || 'warm-up or transition'}\n\nTry neighbouring tempos: ${value - 3}–${value + 3} BPM. For harmonic mixing, test tracks one Camelot step above or below ${key || 'your key'}.` }} /> }
export function PlaylistPitchTemplatePage() { return <QuickTool eyebrow="Playlist pitch template" title="Write a focused pitch for your next release." description="Prepare the core information an editor, curator or DJ needs: what the track is, who it is for and why now." path="/tools/playlist-pitch-template" labels={['Artist and track', 'Genre and mood', 'Release date', 'One-line story']} makeResult={([track, genre, date, story]) => `Subject: ${track || 'New release'} — playlist consideration\n\nHi,\n\nI’m sharing ${track || 'a new track'}, a ${genre || 'genre-blending'} release arriving ${date || 'soon'}. ${story || 'It is built for listeners looking for something fresh and emotionally direct.'}\n\nThanks for listening,\n${track || 'The artist'}`} /> }
export function SocialCaptionGeneratorPage() { return <QuickTool eyebrow="Music social caption generator" title="Create captions that give your release a reason to be heard." description="Generate launch, behind-the-scenes and thank-you caption prompts for Instagram, TikTok or your community." path="/tools/social-caption-generator" labels={['Artist or track', 'Release moment', 'Call to action']} makeResult={([track, moment, call]) => [`${track || 'The new release'} is out. ${moment || 'Made for late nights and loud headphones.'} Listen now — ${call || 'link in bio.'}`, `A little look behind ${track || 'the track'}. ${moment || 'Every layer has a story.'} ${call || 'Tell us what you hear first.'}`, `${track || 'New music'} is yours now. Thanks for being here while it took shape. ${call || 'Press play and share it with someone who needs it.'}`].join('\n\n')} /> }
export function DjSetlistPlannerPage() { return <QuickTool eyebrow="DJ setlist planner" title="Shape the energy arc of your next DJ set." description="Map a set from warm-up to close so your track choices have room to breathe." path="/tools/dj-setlist-planner" labels={['Set length in minutes', 'Starting energy (1–10)', 'Closing energy (1–10)']} makeResult={([length, start, end]) => { const minutes = Number(length) || 60; const opening = Number(start) || 4; const closing = Number(end) || 8; return `Set arc — ${minutes} minutes\n\n0–${Math.round(minutes * .2)} min: Warm-up and establish the room (energy ${opening}/10).\n${Math.round(minutes * .2)}–${Math.round(minutes * .65)} min: Build tension, introduce your signature selections.\n${Math.round(minutes * .65)}–${Math.round(minutes * .85)} min: Peak-time run (energy ${Math.max(opening, closing - 1)}/10).\n${Math.round(minutes * .85)}–${minutes} min: Close with intention (energy ${closing}/10).\n\nLeave space for the room—this is a map, not a script.` }} /> }
export function MusicGenreGuidePage() { return <QuickTool eyebrow="Music genre guide" title="Find the language for your sound." description="Use this quick guide to describe a release clearly for listeners, DJs, playlist curators and collaborators." path="/tools/music-genre-guide" labels={['Primary sound', 'Key instruments or textures', 'Listener mood']} makeResult={([sound, textures, mood]) => `${sound || 'Electronic'} with ${textures || 'layered rhythm and warm texture'} for listeners who want ${mood || 'movement and atmosphere'}.\n\nUseful tags: ${sound || 'independent music'}, ${mood || 'late-night'}, ${textures || 'textural production'}\n\nTip: choose one primary genre, then add two or three descriptive tags. Clear beats clever labels.`} /> }

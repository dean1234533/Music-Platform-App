/**
 * Tool hub content lives here as plain data — imported both by the client
 * tool pages (src/pages/marketing/ToolsHubPages.tsx) and, via a relative
 * import, by worker/share-og.ts for edge-rendered crawler HTML. Keep this
 * file free of DOM/React/Firebase imports so it stays valid in both
 * runtimes. Single source of truth: a tool's copy only ever needs changing
 * in one place, whether it's shown in the hub grid, on its own page, or to
 * a crawler that never runs the page's JS.
 */

export interface ToolMeta {
  /** Path segment under /tools — '' for the hub index itself. */
  slug: string
  /** Short label used on the hub's nav card. */
  label: string
  category: 'artist' | 'dj' | null
  /** Hub card description. */
  blurb: string
  eyebrow: string
  /** <h1> / page title. */
  title: string
  /** Meta description and the page's intro paragraph. */
  description: string
}

export const TOOLS: ToolMeta[] = [
  {
    slug: '',
    label: 'Tools',
    category: null,
    blurb: '',
    eyebrow: 'BackTheVibes tools',
    title: 'Useful tools for the people moving music forward.',
    description: 'Free, practical tools for independent artists and DJs. Use them without an account, then save your work in BackTheVibes when you are ready.',
  },
  {
    slug: 'release-planner',
    label: 'Release planner',
    category: 'artist',
    blurb: 'Build a week-by-week timeline for your next single, EP or album.',
    eyebrow: 'Free release planner',
    title: 'Plan your music release without missing the important bits.',
    description: 'Create a practical release timeline for a single, EP or album. Use it as a working checklist for your next campaign.',
  },
  {
    slug: 'artist-bio-generator',
    label: 'Artist bio generator',
    category: 'artist',
    blurb: 'Draft a bio for your Spotify profile, press kit or website.',
    eyebrow: 'Free artist bio generator',
    title: 'Write an artist bio that sounds like you.',
    description: 'Generate three starting points — a one-liner, a streaming-profile bio and a press bio — for your Spotify profile, press kit, website or DJ submission.',
  },
  {
    slug: 'dj-licence-request',
    label: 'DJ licence request tool',
    category: 'dj',
    blurb: 'Send a clear, professional first message to request a track licence.',
    eyebrow: 'Free DJ licence request tool',
    title: 'Send a clear, professional track licence request.',
    description: 'Prepare a respectful first message for an artist. Set out your intended use and leave the legal terms ready to agree in writing.',
  },
  {
    slug: 'dj-name-generator',
    label: 'DJ name generator',
    category: 'dj',
    blurb: 'Four real stage-name options built from your sound, mood and location.',
    eyebrow: 'Free DJ name generator',
    title: 'Find a DJ name with a sound of its own.',
    description: 'Get four stage-name options built from your sound, mood and location — then check availability before using one.',
  },
  {
    slug: 'song-title-generator',
    label: 'Song title generator',
    category: 'artist',
    blurb: 'Six title directions from your theme, genre and mood — not just your words reshuffled.',
    eyebrow: 'Free song title generator',
    title: 'Turn a track idea into a title worth remembering.',
    description: 'Get six title directions from your theme, genre and mood — starting points to react to, not a replacement for your own story.',
  },
  {
    slug: 'royalty-calculator',
    label: 'Royalty calculator',
    category: 'artist',
    blurb: 'Estimate what a release could earn from streams.',
    eyebrow: 'Streaming royalty calculator',
    title: 'Estimate what a release could earn from streams.',
    description: 'A simple planning estimate—not a payout statement. Actual royalties vary by platform, territory, rights split and distributor.',
  },
  {
    slug: 'bpm-key-finder',
    label: 'BPM and key finder',
    category: 'dj',
    blurb: 'Real Camelot-wheel key matches and compatible tempos, worked out properly.',
    eyebrow: 'BPM and key finder',
    title: 'Prepare tracks for smoother mixes.',
    description: "Turn a track's BPM and musical key into real harmonic-mixing notes — actual Camelot wheel matches, not a repeat of what you typed.",
  },
  {
    slug: 'playlist-pitch-template',
    label: 'Playlist pitch template',
    category: 'artist',
    blurb: 'Write a focused pitch for an editor, curator or DJ.',
    eyebrow: 'Playlist pitch template',
    title: 'Write a focused pitch for your next release.',
    description: 'Prepare the core information an editor, curator or DJ needs: what the track is, who it is for and why now.',
  },
  {
    slug: 'social-caption-generator',
    label: 'Social caption generator',
    category: 'artist',
    blurb: 'Generate launch, behind-the-scenes and thank-you captions.',
    eyebrow: 'Music social caption generator',
    title: 'Write launch, behind-the-scenes and thank-you captions in one go.',
    description: 'Fill in three details about your release and get three ready-to-post captions back — for Instagram, TikTok or wherever you post.',
  },
  {
    slug: 'dj-setlist-planner',
    label: 'DJ setlist planner',
    category: 'dj',
    blurb: 'Map the energy arc of your next set from warm-up to close.',
    eyebrow: 'DJ setlist planner',
    title: 'Shape the energy arc of your next DJ set.',
    description: 'Map a set from warm-up to close so your track choices have room to breathe.',
  },
  {
    slug: 'music-genre-guide',
    label: 'Music genre guide',
    category: 'artist',
    blurb: "Look up a genre’s real tempo range, description and related styles.",
    eyebrow: 'Music genre guide',
    title: "Look up a genre's tempo, sound and neighbours.",
    description: 'A real reference, not a paraphrase of what you typed — search a genre for its typical BPM range, a plain-English description and related styles to explore.',
  },
]

export function getToolBySlug(slug: string): ToolMeta | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}

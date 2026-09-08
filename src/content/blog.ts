/**
 * Blog content lives here as plain data rather than a CMS/database — it's
 * imported both by the client blog pages (src/pages/blog/*) and, via a
 * relative import, by worker/share-og.ts for edge-rendered crawler HTML.
 * Keep this file free of DOM/React/Firebase imports so it stays valid in
 * both runtimes.
 */

export interface BlogPost {
  slug: string
  title: string
  /** Meta description / card summary — keep under ~160 characters. */
  description: string
  date: string // ISO 8601, e.g. '2026-08-01'
  author: string
  tags: string[]
  /** Paragraphs of body copy. Plain strings — rendered as <p> on the client and in edge HTML. Use '## ' prefix for a subheading. */
  body: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-djs-license-tracks-legally',
    title: 'How DJs Can License Tracks Legally (Without the Guesswork)',
    description:
      'A practical guide to clearing tracks for DJ sets, mixtapes and streams — what a proper licence actually covers, and how to get one directly from the artist.',
    date: '2026-08-01',
    author: 'BackTheVibes Team',
    tags: ['DJs', 'Licensing'],
    body: [
      'Most DJs learn music licensing the hard way: a mix gets pulled from a platform, a paid gig falls through over rights questions, or a "free for DJ use" download turns out not to be free at all. The fix isn\'t complicated — it just requires a direct, documented agreement with the artist before you use the track.',
      '## What a DJ licence actually needs to cover',
      'A real licence for DJ use should specify four things in writing: the permitted use (live sets, recorded mixtapes, streaming, or all three), the territory and duration, whether recording and redistribution is allowed, and the price — free, fixed, or negotiated. Anything less than that is a verbal understanding, not a licence, and verbal understandings don\'t hold up when a platform or promoter asks for proof.',
      '## Why "DJ-friendly" download sites aren\'t enough',
      'A track sitting in a "DJ pool" or promo download site usually comes with blanket terms set by the aggregator, not the artist — and those terms rarely cover commercial gigs, recorded sets, or streaming platforms with their own content-ID systems. If a gig or upload matters, the safer route is a licence agreed directly with the rights holder, covering exactly what you intend to do with the track.',
      '## How this works on BackTheVibes',
      'Every track on BackTheVibes that\'s open to DJ use carries the artist\'s own terms — permitted use, territory, duration, and price, set by the artist themselves, not a third-party pool. You request access, the artist can approve, counter, or set a price, and once you both agree, the platform generates a dated agreement that both sides e-sign. That signed agreement is your proof of licence — for a promoter, a platform, or your own records — and the full-quality file only unlocks after it\'s in place.',
      'Joining as a DJ is free — you only pay for the licences you actually agree to, on the terms the artist sets.',
    ],
  },
  {
    slug: 'how-independent-artists-get-paid',
    title: 'Direct Fan Support vs. Streaming Royalties: What Artists Actually Earn',
    description:
      'A clear breakdown of how independent artist income compares between per-stream royalties and direct fan subscriptions — and why the split matters more than the platform.',
    date: '2026-08-08',
    author: 'BackTheVibes Team',
    tags: ['Artists', 'Revenue'],
    body: [
      'Streaming royalties are notoriously opaque and small — fractions of a cent per stream, pooled and divided by algorithms most artists never see the inside of. For an independent artist without a label recoupment structure eating into that already-thin margin, per-stream income rarely adds up to anything close to a living.',
      '## The direct-support model is a different shape entirely',
      'A monthly fan subscription isn\'t trying to approximate a stream\'s fractional value — it\'s a fan actively deciding how much of their membership goes to an artist they already care about. On BackTheVibes, fans hold one platform membership and direct it themselves: artists receive 80% of the net revenue a fan chooses to send them, after payment processing and tax. There\'s no algorithmic pool being split thousands of ways.',
      '## Licensing income works the same direct way',
      'The other side of artist income here is DJ licensing — a DJ requests to use a track, the artist sets or negotiates the price, and once it\'s paid, the artist keeps 85% of net revenue. No aggregator sits between the artist and the DJ setting terms neither of them agreed to.',
      '## What it costs to publish',
      'Publishing on BackTheVibes is a flat £29.99 a year for an artist profile — not a percentage of what you earn, and not a recurring cut of every stream. Fan support and DJ licensing income both flow with the 80%/85% splits above, calculated after tax and payment-processing fees, with the exact amount recorded for every completed payment.',
      'The underlying idea is simple: an artist should be able to see exactly where their income came from, and keep most of it.',
    ],
  },
  {
    slug: 'building-an-ethical-dj-crate',
    title: "A Beginner's Guide to Building an Ethical DJ Crate",
    description:
      'How to build a DJ crate you can actually use in public — sourcing tracks with clear rights, organizing by licence status, and supporting the artists behind the music.',
    date: '2026-08-15',
    author: 'BackTheVibes Team',
    tags: ['DJs', 'Guides'],
    body: [
      'A "crate" — the DJ term for a curated set of tracks ready to play — is only as reliable as the rights behind each track in it. A crate full of tracks with no clear licensing status is a crate you can\'t confidently play at a paid gig, upload as a recorded set, or stream without risking a takedown.',
      '## Start by knowing what each track allows',
      'Before a track goes in your working crate, know three things: can you play it live, can you record and redistribute the set, and does the licence cover the platform you\'ll actually use (a paid gig is different from a public livestream). Tracks without a clear answer to all three belong in a "not cleared yet" folder, not your set list.',
      '## Organize by licence status, not just genre or BPM',
      'Most DJ software organizes crates by genre, key, or BPM — useful for building a set, but it says nothing about what you\'re legally allowed to do with the track once you\'ve played it. Keeping a separate tag or folder for licence status (cleared for streaming, live-only, pending) means you never have to stop and check mid-set.',
      '## Where BackTheVibes fits in',
      'On BackTheVibes, every track open to DJ use shows its terms up front — permitted use, territory, duration — before you ever request it. Once an artist approves your request and you both e-sign the resulting agreement, the track unlocks in full quality with that licence attached to your account, so your crate stays cleared by construction rather than by memory.',
      'Building a crate this way takes a little longer than downloading a promo pack, but it means you can actually use what you\'ve built — anywhere, without asking permission twice.',
    ],
  },
  {
    slug: 'why-independent-music-discovery-feels-broken',
    title: 'Why Independent Music Discovery Feels Broken (And What Actually Fixes It)',
    description:
      "Algorithmic playlists optimize for engagement, not connection. Here's why direct following and genre-based discovery still beats a recommendation engine for finding independent music.",
    date: '2026-08-22',
    author: 'BackTheVibes Team',
    tags: ['Listeners', 'Discovery'],
    body: [
      'Most streaming discovery is built to maximize listening time on the platform, not to connect a listener with an artist they\'ll actually follow. That\'s why algorithmic recommendations tend to converge on whatever is already popular — the opposite of what independent-music discovery needs.',
      '## Following beats recommending, for independent music',
      'A follow is a deliberate choice a listener makes about an artist, not a probability score. On BackTheVibes, discovery starts from genre and direct search — including searching DJs by name or genre, not just artists and tracks — and a listener\'s library builds around who they\'ve actually chosen to follow, not what a black-box model decided to surface.',
      '## What a listener actually gets for free',
      'Listening, following artists, building playlists, and full discovery are free — no paywall on the basic experience. The only optional upgrade is a monthly Supporter membership, and that\'s about directing money to artists a listener already follows, not unlocking features that should have been free in the first place.',
      'Discovery built around genuine choice — follow, search, and support — produces a smaller, more accurate library than an engagement-optimized feed ever will.',
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

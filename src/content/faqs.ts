/**
 * Shared FAQ content for the /for-djs and /for-artists landing pages —
 * plain data so it can be imported both by the React pages and, via a
 * relative import, by worker/share-og.ts for edge-rendered crawler HTML.
 */

export const DJ_FAQS: [string, string][] = [
  ['Is joining as a DJ free?', 'Yes. Creating a DJ profile, browsing tracks, and requesting licences costs nothing. You only pay for the licences you actually agree to, on terms the artist sets.'],
  ['How does licensing actually work?', 'You request access to a track, the artist approves, counters, or sets a price, and once you both agree, a dated agreement is generated for both sides to e-sign. The full-quality file unlocks once the agreement is in place — no informal DMs, no ambiguity about what you\'re allowed to do with it.'],
  ['What does a licence cover?', 'Every licence specifies permitted use (live sets, recorded mixtapes, streaming, or a combination), territory, duration, and price — set directly by the artist, not a third-party pool with blanket terms.'],
  ['Can I get proof of licence for a promoter or platform?', 'Yes — the signed agreement itself is your proof. It\'s dated, e-signed by both parties, and tied to your account.'],
  ['What if an artist doesn\'t respond?', 'Requests that go unanswered eventually expire so your crate doesn\'t fill up with stale pending requests — you can always follow up directly through the built-in messaging.'],
]

export const ARTIST_FAQS: [string, string][] = [
  ['What does it cost to publish?', 'A flat £29.99 a year for an artist profile — not a percentage of what you earn, and not a recurring cut of every stream.'],
  ['How much do I keep from fan support?', 'Artists receive 80% of net revenue from fan memberships directed to them, after payment processing and tax.'],
  ['How much do I keep from DJ licensing?', 'Artists keep 85% of net revenue from a DJ licence, once it\'s paid. You set the terms — permitted use, territory, duration and price — for every track you open to DJ use.'],
  ['Do I have to allow DJ licensing?', 'No — it\'s entirely optional per track. Leave it off and the track stays streaming-only.'],
  ['How do I get paid out?', 'Earnings clear after 7 days and you can request a payout whenever your available balance reaches £25, straight to your connected account.'],
]

=== BackTheVibes Artist ===
Contributors: deantb
Tags: music, artist, embed, youtube, block
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed your BackTheVibes artist profile, music links, and Follow/Support buttons on your own WordPress site.

== Description ==

BackTheVibes is an artist discovery, fan support, and artist/DJ/business
collaboration platform. This plugin is a lightweight integration layer for
your own WordPress site — it does not replace the main BackTheVibes
application, and it does not host, download, cache, or proxy any music.

`[backthevibes_artist]` is the main widget — one combined card with your
profile (image, bio, Follow/Support buttons) and a row of your public
tracks together, not two separate things to place on the page. Each track
plays a 30-second clip through the official YouTube embedded player,
loaded only after a visitor deliberately presses play, then swaps itself
for a link to hear the full track on BackTheVibes — a teaser, not a full
player. Follow and Support buttons link to your real BackTheVibes
profile and, once there, actually complete the Follow/Support
action — this plugin never collects credentials or payment details itself.

= What it adds =

* `[backthevibes_artist]` — the combined card: profile + Follow/Support + a row of 30-second track clips (tracks/buttons/bio can each be turned off)
* `[backthevibes_music]` — just the track-clips row on its own
* `[backthevibes_support]` — just a standalone Support button
* Matching Gutenberg blocks for all three, under "BackTheVibes" in the block inserter

= What it never does =

* Never hosts, downloads, extracts, or proxies audio/video
* Never stores Firebase or Stripe credentials
* Never collects payment details on your site
* Only ever calls BackTheVibes' own public, read-only artist API

== External services ==

This plugin connects to the BackTheVibes public artist API to display an artist's profile, bio, images, and public track list on your WordPress site.

It sends only the artist slug you configure (in Settings → BackTheVibes, or a shortcode/block attribute) as part of the request URL — no visitor data, no personal information, and no BackTheVibes account credentials are ever sent. A request is made whenever a page containing a BackTheVibes shortcode or block is loaded.

This service is provided by BackTheVibes: [Terms & Conditions](https://backthevibes.com/terms), [Privacy Policy](https://backthevibes.com/privacy).

Track playback (when a visitor presses play on a clip) loads YouTube's own official embedded player, subject to YouTube's Terms of Service and Google's Privacy Policy. Nothing is requested from YouTube until a visitor deliberately presses play.

== Installation ==

1. Upload the `backthevibes` folder to `/wp-content/plugins/`, or install the zip via Plugins → Add New → Upload Plugin.
2. Activate the plugin.
3. Go to Settings → BackTheVibes and enter your artist slug (from your profile URL, e.g. `backthevibes.com/artist/your-slug`).
4. Add a shortcode to any post/page, or add a "BackTheVibes" block in the block editor.

== Frequently Asked Questions ==

= Does this host my music on my WordPress site? =

No. Every track is a link to your own official YouTube upload, played through YouTube's own embedded player.

= Does this store any of my BackTheVibes account details? =

No. The plugin only reads your public profile data through BackTheVibes' public API. Signing in, following, and supporting all happen on backthevibes.com.

== Changelog ==

= 1.0.1 =
* The "Powered by BackTheVibes" credit link is now off by default and only
  shown once a site admin opts in from Settings → BackTheVibes.
* Documented the plugin's use of the BackTheVibes public API as an external
  service.

= 1.0.0 =
* Initial release. `[backthevibes_artist]` combines the profile card and a
  30-second-clip track row into one widget by default (`tracks="no"` to
  turn the row off, `track_limit="N"` to change how many show).

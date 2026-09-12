=== BackTheVibes Artist ===
Contributors: backthevibes
Tags: music, artist, embed, youtube, block
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed your BackTheVibes artist profile, music links, and Follow/Support buttons on your own WordPress site.

== Description ==

BackTheVibes is an artist discovery, fan support, and artist/DJ/business
collaboration platform. This plugin is a lightweight integration layer for
your own WordPress site — it does not replace the main BackTheVibes
application, and it does not host, download, cache, or proxy any music.

Every track link plays through the official YouTube embedded player,
loaded only after a visitor deliberately presses play. Follow and Support
buttons link to your real BackTheVibes profile, where the actual
account/payment action happens — this plugin never collects credentials or
payment details itself.

= What it adds =

* An artist profile card (image, name, bio, social links, Follow/Support buttons)
* A standalone Support button
* A grid of your public tracks, playable via the official YouTube embed
* Matching Gutenberg blocks and shortcodes: `[backthevibes_artist]`, `[backthevibes_support]`, `[backthevibes_music]`

= What it never does =

* Never hosts, downloads, extracts, or proxies audio/video
* Never stores Firebase or Stripe credentials
* Never collects payment details on your site
* Only ever calls BackTheVibes' own public, read-only artist API

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

= 1.0.0 =
* Initial release.

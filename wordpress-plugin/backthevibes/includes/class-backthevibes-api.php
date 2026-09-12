<?php
/**
 * All network access lives here, in one place: a single read-only GET to
 * BackTheVibes' own public artist API, cached via WordPress transients so a
 * busy page doesn't hammer the endpoint. No credentials of any kind are
 * ever sent or stored — the endpoint is unauthenticated and only ever
 * returns the same public data a signed-out visitor already sees on the
 * artist's BackTheVibes profile page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BackTheVibes_API {

	const CACHE_TTL = 5 * MINUTE_IN_SECONDS;

	/**
	 * Fetches (and caches) the public profile + track list for one artist
	 * slug. Returns null on any failure — callers must fail gracefully
	 * rather than surface a raw error to site visitors.
	 *
	 * @param string $slug Artist slug as configured in plugin settings or a shortcode attribute.
	 * @return array<string,mixed>|null
	 */
	public static function get_artist( string $slug ) {
		$slug = sanitize_title( $slug );
		if ( '' === $slug ) {
			return null;
		}

		$cache_key = 'backthevibes_artist_' . $slug;
		$cached    = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		$url = BACKTHEVIBES_API_BASE . '/artist/' . rawurlencode( $slug );

		$response = wp_remote_get(
			$url,
			array(
				'timeout'    => 8,
				'user-agent' => 'BackTheVibesWordPressPlugin/' . BACKTHEVIBES_VERSION . '; ' . home_url( '/' ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return null;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $code ) {
			// Cache the miss briefly too, so a deleted/renamed artist doesn't
			// retry on every page load for anonymous visitors.
			set_transient( $cache_key, null, MINUTE_IN_SECONDS );
			return null;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) || empty( $body['name'] ) ) {
			return null;
		}

		$artist = self::sanitize_artist( $body );
		set_transient( $cache_key, $artist, self::CACHE_TTL );

		return $artist;
	}

	/**
	 * Defensive sanitisation of every field pulled from the remote response
	 * before it's ever stored or rendered — the API is BackTheVibes' own,
	 * but this plugin never trusts a remote payload as pre-escaped HTML.
	 *
	 * @param array<string,mixed> $data
	 * @return array<string,mixed>
	 */
	private static function sanitize_artist( array $data ): array {
		$tracks = array();
		if ( ! empty( $data['tracks'] ) && is_array( $data['tracks'] ) ) {
			foreach ( array_slice( $data['tracks'], 0, 12 ) as $track ) {
				if ( ! is_array( $track ) || empty( $track['youtubeUrl'] ) ) {
					continue;
				}
				$youtube_url = esc_url_raw( $track['youtubeUrl'] );
				if ( ! self::is_youtube_url( $youtube_url ) ) {
					continue; // Never trust/render an arbitrary embed URL, even from our own API.
				}
				$tracks[] = array(
					'title'      => sanitize_text_field( $track['title'] ?? '' ),
					'artworkUrl' => ! empty( $track['artworkURL'] ) ? esc_url_raw( $track['artworkURL'] ) : '',
					'youtubeUrl' => $youtube_url,
					'url'        => ! empty( $track['url'] ) ? esc_url_raw( $track['url'] ) : '',
				);
			}
		}

		return array(
			'slug'           => sanitize_title( $data['slug'] ?? '' ),
			'name'           => sanitize_text_field( $data['name'] ?? '' ),
			'bio'            => sanitize_textarea_field( $data['bio'] ?? '' ),
			'imageUrl'       => ! empty( $data['imageUrl'] ) ? esc_url_raw( $data['imageUrl'] ) : '',
			'coverUrl'       => ! empty( $data['coverUrl'] ) ? esc_url_raw( $data['coverUrl'] ) : '',
			'location'       => sanitize_text_field( $data['location'] ?? '' ),
			'followerCount'  => absint( $data['followerCount'] ?? 0 ),
			'profileUrl'     => ! empty( $data['profileUrl'] ) ? esc_url_raw( $data['profileUrl'] ) : '',
			'followUrl'      => ! empty( $data['followUrl'] ) ? esc_url_raw( $data['followUrl'] ) : '',
			'supportUrl'     => ! empty( $data['supportUrl'] ) ? esc_url_raw( $data['supportUrl'] ) : '',
			'tracks'         => $tracks,
		);
	}

	/**
	 * Extra-cautious allowlist check so a YouTube video ID/URL is the only
	 * thing this plugin will ever embed — never an arbitrary iframe source.
	 */
	public static function is_youtube_url( string $url ): bool {
		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! $host ) {
			return false;
		}
		$host = strtolower( $host );
		return in_array( $host, array( 'www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com' ), true );
	}

	/**
	 * Extracts the canonical 11-character YouTube video ID from a validated
	 * YouTube URL, for building our own privacy-enhanced embed src rather
	 * than trusting whatever query string the API happened to send.
	 */
	public static function extract_video_id( string $youtube_url ) {
		if ( preg_match( '/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/', $youtube_url, $matches ) ) {
			return $matches[1];
		}
		return null;
	}
}

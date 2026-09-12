<?php
/**
 * All HTML output lives here, in one place, so every shortcode/block shares
 * exactly one escaping-and-markup path. Every dynamic value is escaped at
 * the point of output (esc_html/esc_attr/esc_url) — never trusted as
 * pre-safe HTML, even though it already passed through
 * BackTheVibes_API::sanitize_artist().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BackTheVibes_Render {

	/**
	 * A short, honest fallback shown instead of a card when the artist
	 * can't be loaded — never a blank space, never a fatal error on the
	 * host site.
	 */
	public static function unavailable_notice(): string {
		return '<p class="backthevibes-embed backthevibes-unavailable">' .
			esc_html__( 'This BackTheVibes artist could not be loaded right now.', 'backthevibes' ) .
			'</p>';
	}

	/**
	 * [backthevibes_artist] — profile image, name, bio, social links, and
	 * Follow/Support buttons that link out to the artist's real
	 * BackTheVibes profile (all account/payment actions happen there,
	 * signed in — this plugin never collects credentials or payment
	 * details itself).
	 */
	public static function artist_card( array $artist, array $args = array() ): string {
		wp_enqueue_style( 'backthevibes-embed' );

		$show_bio  = ! empty( $args['show_bio'] );
		$show_cta  = ! isset( $args['show_buttons'] ) || $args['show_buttons'];

		ob_start();
		?>
		<div class="backthevibes-embed backthevibes-artist-card">
			<?php if ( $artist['coverUrl'] ) : ?>
				<div class="backthevibes-cover" style="background-image:url('<?php echo esc_url( $artist['coverUrl'] ); ?>')"></div>
			<?php endif; ?>
			<div class="backthevibes-artist-header">
				<?php if ( $artist['imageUrl'] ) : ?>
					<img class="backthevibes-avatar" src="<?php echo esc_url( $artist['imageUrl'] ); ?>" alt="<?php echo esc_attr( $artist['name'] ); ?>" loading="lazy" width="72" height="72" />
				<?php endif; ?>
				<div class="backthevibes-artist-meta">
					<a class="backthevibes-artist-name" href="<?php echo esc_url( $artist['profileUrl'] ); ?>" target="_blank" rel="noopener noreferrer">
						<?php echo esc_html( $artist['name'] ); ?>
					</a>
					<?php if ( $artist['location'] ) : ?>
						<span class="backthevibes-location"><?php echo esc_html( $artist['location'] ); ?></span>
					<?php endif; ?>
				</div>
			</div>
			<?php if ( $show_bio && $artist['bio'] ) : ?>
				<p class="backthevibes-bio"><?php echo esc_html( $artist['bio'] ); ?></p>
			<?php endif; ?>
			<?php if ( $show_cta ) : ?>
				<div class="backthevibes-actions">
					<a class="backthevibes-btn backthevibes-btn-follow" href="<?php echo esc_url( $artist['followUrl'] ); ?>" target="_blank" rel="noopener noreferrer">
						<?php esc_html_e( 'Follow', 'backthevibes' ); ?>
					</a>
					<a class="backthevibes-btn backthevibes-btn-support" href="<?php echo esc_url( $artist['supportUrl'] ); ?>" target="_blank" rel="noopener noreferrer">
						<?php esc_html_e( 'Support', 'backthevibes' ); ?>
					</a>
				</div>
			<?php endif; ?>
			<?php echo self::powered_by( $artist['profileUrl'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside. ?>
		</div>
		<?php
		return trim( (string) ob_get_clean() );
	}

	/**
	 * [backthevibes_support] — a single, prominent Support button. Always
	 * links out to the artist's BackTheVibes profile page (with the support
	 * flow opened there) — this plugin never embeds a payment form and
	 * never touches card/bank details itself.
	 */
	public static function support_button( array $artist, array $args = array() ): string {
		wp_enqueue_style( 'backthevibes-embed' );
		$label = ! empty( $args['label'] ) ? sanitize_text_field( $args['label'] ) : sprintf(
			/* translators: %s: artist name */
			__( 'Support %s', 'backthevibes' ),
			$artist['name']
		);
		return sprintf(
			'<div class="backthevibes-embed backthevibes-support-embed"><a class="backthevibes-btn backthevibes-btn-support backthevibes-btn-large" href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>%3$s</div>',
			esc_url( $artist['supportUrl'] ),
			esc_html( $label ),
			self::powered_by( $artist['profileUrl'] ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.
		);
	}

	/**
	 * [backthevibes_music] — a grid of the artist's public tracks, each
	 * playable through the real, official YouTube embed (click-to-load, so
	 * nothing is requested from YouTube until a visitor presses play).
	 * Never a download link, never an audio file served by this plugin.
	 */
	public static function music_grid( array $artist, array $args = array() ): string {
		wp_enqueue_style( 'backthevibes-embed' );
		wp_enqueue_script(
			'backthevibes-embed',
			BACKTHEVIBES_PLUGIN_URL . 'assets/backthevibes.js',
			array(),
			BACKTHEVIBES_VERSION,
			true
		);

		$limit  = ! empty( $args['limit'] ) ? max( 1, min( 12, (int) $args['limit'] ) ) : 6;
		$tracks = array_slice( $artist['tracks'], 0, $limit );

		if ( empty( $tracks ) ) {
			return '<p class="backthevibes-embed backthevibes-empty">' . esc_html__( 'No public tracks yet.', 'backthevibes' ) . '</p>';
		}

		ob_start();
		?>
		<div class="backthevibes-embed backthevibes-music-grid">
			<?php foreach ( $tracks as $track ) :
				$video_id = BackTheVibes_API::extract_video_id( $track['youtubeUrl'] );
				if ( ! $video_id ) {
					continue;
				}
				?>
				<div class="backthevibes-track">
					<button
						type="button"
						class="backthevibes-video-trigger"
						data-video-id="<?php echo esc_attr( $video_id ); ?>"
						aria-label="<?php echo esc_attr( sprintf( /* translators: %s: track title */ __( 'Play %s on YouTube', 'backthevibes' ), $track['title'] ) ); ?>"
					>
						<img src="<?php echo esc_url( $track['artworkUrl'] ? $track['artworkUrl'] : 'https://i.ytimg.com/vi/' . rawurlencode( $video_id ) . '/hqdefault.jpg' ); ?>" alt="" loading="lazy" />
						<span class="backthevibes-play-icon" aria-hidden="true"></span>
					</button>
					<a class="backthevibes-track-title" href="<?php echo esc_url( $track['url'] ? $track['url'] : $artist['profileUrl'] ); ?>" target="_blank" rel="noopener noreferrer">
						<?php echo esc_html( $track['title'] ); ?>
					</a>
				</div>
			<?php endforeach; ?>
		</div>
		<?php echo self::powered_by( $artist['profileUrl'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside. ?>
		<?php
		return trim( (string) ob_get_clean() );
	}

	private static function powered_by( string $profile_url ): string {
		return sprintf(
			'<p class="backthevibes-powered-by">%1$s <a href="%2$s" target="_blank" rel="noopener noreferrer">BackTheVibes</a></p>',
			esc_html__( 'Powered by', 'backthevibes' ),
			esc_url( $profile_url ? $profile_url : 'https://backthevibes.com' )
		);
	}
}

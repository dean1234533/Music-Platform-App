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
	 * [backthevibes_artist] — profile image, name, bio, social links,
	 * Follow/Support buttons, and (by default) a row of short track clips —
	 * one combined card instead of needing a separate [backthevibes_music]
	 * alongside it (user feedback: "wouldnt it make more sense to have a
	 * profile card one that shows clops of your tracks instead of the full
	 * track" — the "instead of the full track" half is handled by
	 * tracks_markup()'s own clip cutoff, see backthevibes.js).
	 *
	 * Collapsed by default (user feedback: "have a button that you click
	 * that shows the profile card of the artist then you can listhen to the
	 * short track from there and support + follow") — a compact avatar/name
	 * button that expands in place to the full card on click, no page
	 * navigation, no network request (the whole card already rendered, only
	 * hidden via CSS — see the .backthevibes-collapsed rule and the toggle
	 * handler in backthevibes.js).
	 *
	 * Follow/Support always link out to the artist's real BackTheVibes
	 * profile — all account/payment actions happen there, this plugin
	 * never collects credentials or payment details itself.
	 */
	public static function artist_card( array $artist, array $args = array() ): string {
		wp_enqueue_style( 'backthevibes-embed' );
		wp_enqueue_script(
			'backthevibes-embed',
			BACKTHEVIBES_PLUGIN_URL . 'assets/backthevibes.js',
			array(),
			BACKTHEVIBES_VERSION,
			true
		);

		$show_bio     = ! empty( $args['show_bio'] );
		$show_cta     = ! isset( $args['show_buttons'] ) || $args['show_buttons'];
		$show_tracks  = ! isset( $args['show_tracks'] ) || $args['show_tracks'];
		$track_limit  = ! empty( $args['track_limit'] ) ? (int) $args['track_limit'] : 6;
		$collapsible  = ! isset( $args['collapsible'] ) || $args['collapsible'];
		$card_classes = 'backthevibes-embed backthevibes-artist-card' . ( $collapsible ? ' backthevibes-collapsed' : '' );

		ob_start();
		?>
		<div class="<?php echo esc_attr( $card_classes ); ?>">
			<?php if ( $artist['coverUrl'] ) : ?>
				<div class="backthevibes-cover" style="background-image:url('<?php echo esc_url( $artist['coverUrl'] ); ?>')"></div>
			<?php endif; ?>
			<?php if ( $collapsible ) : ?>
				<button type="button" class="backthevibes-card-toggle" aria-expanded="false">
					<span class="backthevibes-artist-header">
						<?php if ( $artist['imageUrl'] ) : ?>
							<img class="backthevibes-avatar" src="<?php echo esc_url( $artist['imageUrl'] ); ?>" alt="" loading="lazy" width="72" height="72" />
						<?php endif; ?>
						<span class="backthevibes-artist-meta">
							<span class="backthevibes-artist-name"><?php echo esc_html( $artist['name'] ); ?></span>
							<?php if ( $artist['location'] ) : ?>
								<span class="backthevibes-location"><?php echo esc_html( $artist['location'] ); ?></span>
							<?php endif; ?>
						</span>
					</span>
					<span class="backthevibes-toggle-icon" aria-hidden="true"></span>
				</button>
			<?php else : ?>
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
			<?php endif; ?>
			<div class="backthevibes-card-body">
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
				<?php if ( $show_tracks ) : ?>
					<?php echo self::tracks_markup( $artist, $track_limit ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside. ?>
				<?php endif; ?>
				<?php echo self::powered_by( $artist['profileUrl'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside. ?>
			</div>
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
	 * [backthevibes_music] — a grid of the artist's public tracks, standalone
	 * (with its own "Powered by" footer). See tracks_markup() for the
	 * actual grid — this is just that plus the footer, matching the other
	 * two standalone shortcodes' shape.
	 */
	public static function music_grid( array $artist, array $args = array() ): string {
		$limit  = ! empty( $args['limit'] ) ? (int) $args['limit'] : 6;
		$markup = self::tracks_markup( $artist, $limit );
		if ( '' === $markup ) {
			return '<p class="backthevibes-embed backthevibes-empty">' . esc_html__( 'No public tracks yet.', 'backthevibes' ) . '</p>';
		}
		return '<div class="backthevibes-embed">' . $markup . self::powered_by( $artist['profileUrl'] ) . '</div>';
	}

	/**
	 * The actual track grid, shared by [backthevibes_music] on its own and
	 * by artist_card()'s combined card. Each track plays a CLIP_SECONDS clip
	 * through the real, official YouTube embed (click-to-load — nothing is
	 * requested from YouTube until a visitor presses play), then swaps in a
	 * link to hear the full track on BackTheVibes — this plugin is a
	 * teaser, not a place to hear a whole discography end to end, matching
	 * user feedback that a full track playing inline made the widget
	 * confusing. Never a download link, never an audio file served here.
	 */
	private static function tracks_markup( array $artist, int $limit ): string {
		$limit  = max( 1, min( 12, $limit ) );
		$tracks = array_slice( $artist['tracks'], 0, $limit );
		if ( empty( $tracks ) ) {
			return '';
		}

		wp_enqueue_style( 'backthevibes-embed' );
		wp_enqueue_script(
			'backthevibes-embed',
			BACKTHEVIBES_PLUGIN_URL . 'assets/backthevibes.js',
			array(),
			BACKTHEVIBES_VERSION,
			true
		);

		ob_start();
		?>
		<div class="backthevibes-music-grid">
			<?php foreach ( $tracks as $track ) :
				$video_id = BackTheVibes_API::extract_video_id( $track['youtubeUrl'] );
				if ( ! $video_id ) {
					continue;
				}
				$track_url = $track['url'] ? $track['url'] : $artist['profileUrl'];
				?>
				<div class="backthevibes-track">
					<button
						type="button"
						class="backthevibes-video-trigger"
						data-video-id="<?php echo esc_attr( $video_id ); ?>"
						data-track-url="<?php echo esc_url( $track_url ); ?>"
						aria-label="<?php echo esc_attr( sprintf( /* translators: %s: track title */ __( 'Play a clip of %s', 'backthevibes' ), $track['title'] ) ); ?>"
					>
						<img src="<?php echo esc_url( $track['artworkUrl'] ? $track['artworkUrl'] : 'https://i.ytimg.com/vi/' . rawurlencode( $video_id ) . '/hqdefault.jpg' ); ?>" alt="" loading="lazy" />
						<span class="backthevibes-play-icon" aria-hidden="true"></span>
						<span class="backthevibes-clip-badge"><?php esc_html_e( '0:30 clip', 'backthevibes' ); ?></span>
					</button>
					<a class="backthevibes-track-title" href="<?php echo esc_url( $track_url ); ?>" target="_blank" rel="noopener noreferrer">
						<?php echo esc_html( $track['title'] ); ?>
					</a>
				</div>
			<?php endforeach; ?>
		</div>
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

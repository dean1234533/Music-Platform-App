<?php
/**
 * Settings -> BackTheVibes: stores only a default artist slug (a public
 * identifier, not a secret) so shortcodes/blocks can be used without
 * repeating it every time. Gated by the 'manage_options' capability and a
 * nonce, exactly like Core's own Settings API examples.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BackTheVibes_Settings {

	const OPTION_KEY        = 'backthevibes_default_slug';
	const CREDIT_OPTION_KEY = 'backthevibes_show_credit';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_setting' ) );
	}

	public function add_settings_page(): void {
		add_options_page(
			__( 'BackTheVibes', 'backthevibes-artist' ),
			__( 'BackTheVibes', 'backthevibes-artist' ),
			'manage_options',
			'backthevibes',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_setting(): void {
		register_setting(
			'backthevibes_settings',
			self::OPTION_KEY,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_title',
				'default'           => '',
			)
		);
		// Off by default — a "Powered by BackTheVibes" credit link is only ever shown on the
		// front end after the site admin deliberately opts in here (WordPress.org Plugin
		// Directory guideline 10: no unattributed/non-opt-in credit links on user-facing output).
		register_setting(
			'backthevibes_settings',
			self::CREDIT_OPTION_KEY,
			array(
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'default'           => false,
			)
		);
	}

	public static function get_default_slug(): string {
		return (string) get_option( self::OPTION_KEY, '' );
	}

	public static function show_credit(): bool {
		return (bool) get_option( self::CREDIT_OPTION_KEY, false );
	}

	public function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'BackTheVibes', 'backthevibes-artist' ); ?></h1>
			<p>
				<?php esc_html_e( 'Set the artist slug this site embeds by default. Find your slug in the URL of your BackTheVibes profile — e.g. backthevibes.com/artist/your-slug.', 'backthevibes-artist' ); ?>
			</p>
			<form action="options.php" method="post">
				<?php settings_fields( 'backthevibes_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="backthevibes_default_slug"><?php esc_html_e( 'Default artist slug', 'backthevibes-artist' ); ?></label></th>
						<td>
							<input
								type="text"
								id="backthevibes_default_slug"
								name="<?php echo esc_attr( self::OPTION_KEY ); ?>"
								value="<?php echo esc_attr( self::get_default_slug() ); ?>"
								class="regular-text"
								placeholder="your-artist-slug"
							/>
							<p class="description">
								<?php esc_html_e( 'Used when a shortcode or block does not specify its own artist slug.', 'backthevibes-artist' ); ?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Show "Powered by BackTheVibes" credit', 'backthevibes-artist' ); ?></th>
						<td>
							<label for="backthevibes_show_credit">
								<input
									type="checkbox"
									id="backthevibes_show_credit"
									name="<?php echo esc_attr( self::CREDIT_OPTION_KEY ); ?>"
									value="1"
									<?php checked( self::show_credit() ); ?>
								/>
								<?php esc_html_e( 'Show a small "Powered by BackTheVibes" credit link under each embed.', 'backthevibes-artist' ); ?>
							</label>
							<p class="description">
								<?php esc_html_e( 'Off by default. Turning this on is entirely optional and only affects your own site.', 'backthevibes-artist' ); ?>
							</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
			<hr />
			<h2><?php esc_html_e( 'Usage', 'backthevibes-artist' ); ?></h2>
			<p><code>[backthevibes_artist]</code> &mdash; <?php esc_html_e( 'the main widget: your profile card plus a row of 30-second track clips, together. Add tracks="no" to hide the track row, or track_limit="N" to change how many show.', 'backthevibes-artist' ); ?></p>
			<p><code>[backthevibes_music]</code> &mdash; <?php esc_html_e( 'just the track-clips row on its own, without the profile card.', 'backthevibes-artist' ); ?></p>
			<p><code>[backthevibes_support]</code> &mdash; <?php esc_html_e( 'just a standalone Support button.', 'backthevibes-artist' ); ?></p>
			<p><?php esc_html_e( 'Each shortcode also accepts an artist="your-slug" attribute to override the default above. Matching blocks are available in the block editor under "BackTheVibes".', 'backthevibes-artist' ); ?></p>
		</div>
		<?php
	}
}

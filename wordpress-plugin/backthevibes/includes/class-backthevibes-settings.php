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

	const OPTION_KEY = 'backthevibes_default_slug';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_setting' ) );
	}

	public function add_settings_page(): void {
		add_options_page(
			__( 'BackTheVibes', 'backthevibes' ),
			__( 'BackTheVibes', 'backthevibes' ),
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
	}

	public static function get_default_slug(): string {
		return (string) get_option( self::OPTION_KEY, '' );
	}

	public function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'BackTheVibes', 'backthevibes' ); ?></h1>
			<p>
				<?php esc_html_e( 'Set the artist slug this site embeds by default. Find your slug in the URL of your BackTheVibes profile — e.g. backthevibes.com/artist/your-slug.', 'backthevibes' ); ?>
			</p>
			<form action="options.php" method="post">
				<?php settings_fields( 'backthevibes_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="backthevibes_default_slug"><?php esc_html_e( 'Default artist slug', 'backthevibes' ); ?></label></th>
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
								<?php esc_html_e( 'Used when a shortcode or block does not specify its own artist slug.', 'backthevibes' ); ?>
							</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
			<hr />
			<h2><?php esc_html_e( 'Usage', 'backthevibes' ); ?></h2>
			<p><code>[backthevibes_artist]</code> &mdash; <?php esc_html_e( 'artist profile card with Follow/Support buttons.', 'backthevibes' ); ?></p>
			<p><code>[backthevibes_support]</code> &mdash; <?php esc_html_e( 'a single Support button.', 'backthevibes' ); ?></p>
			<p><code>[backthevibes_music]</code> &mdash; <?php esc_html_e( 'a grid of public tracks, playable via the official YouTube player.', 'backthevibes' ); ?></p>
			<p><?php esc_html_e( 'Each shortcode also accepts an artist="your-slug" attribute to override the default above. Matching blocks are available in the block editor under "BackTheVibes".', 'backthevibes' ); ?></p>
		</div>
		<?php
	}
}

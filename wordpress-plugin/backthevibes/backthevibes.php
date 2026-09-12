<?php
/**
 * Plugin Name: BackTheVibes Artist
 * Plugin URI: https://backthevibes.com
 * Description: Embed your BackTheVibes artist profile, music links, and Follow/Support buttons on your own WordPress site. Displays only public profile data — never hosts, downloads, or proxies audio.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: BackTheVibes
 * Author URI: https://backthevibes.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: backthevibes
 *
 * This plugin is a lightweight integration layer only. It never hosts,
 * downloads, caches, or proxies music — every track link opens the artist's
 * official YouTube video directly. It never stores Firebase or Stripe
 * credentials; the only network calls it makes are read-only GET requests to
 * BackTheVibes' own public artist API.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'BACKTHEVIBES_VERSION', '1.0.0' );
define( 'BACKTHEVIBES_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BACKTHEVIBES_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * The only host this plugin will ever fetch data from. Not filterable by
 * site options — a user cannot be tricked into pointing this at an
 * attacker-controlled endpoint via a settings field.
 */
define( 'BACKTHEVIBES_API_BASE', 'https://backthevibes.com/api/public' );

require_once BACKTHEVIBES_PLUGIN_DIR . 'includes/class-backthevibes-api.php';
require_once BACKTHEVIBES_PLUGIN_DIR . 'includes/class-backthevibes-render.php';
require_once BACKTHEVIBES_PLUGIN_DIR . 'includes/class-backthevibes-settings.php';
require_once BACKTHEVIBES_PLUGIN_DIR . 'includes/class-backthevibes-shortcodes.php';
require_once BACKTHEVIBES_PLUGIN_DIR . 'includes/class-backthevibes-block.php';

/**
 * Boots every piece. Each class only registers its own WordPress hooks in
 * its constructor — nothing runs at include time.
 */
final class BackTheVibes_Plugin {

	private static ?BackTheVibes_Plugin $instance = null;

	public static function instance(): BackTheVibes_Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'plugins_loaded', array( $this, 'load_textdomain' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );

		new BackTheVibes_Settings();
		new BackTheVibes_Shortcodes();
		new BackTheVibes_Block();
	}

	public function load_textdomain(): void {
		load_plugin_textdomain( 'backthevibes', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}

	/**
	 * Registered but not printed globally — enqueued only by the shortcode/
	 * block render callbacks that actually output a card, so a page with no
	 * BackTheVibes embed never loads this CSS at all.
	 */
	public function register_assets(): void {
		wp_register_style(
			'backthevibes-embed',
			BACKTHEVIBES_PLUGIN_URL . 'assets/backthevibes.css',
			array(),
			BACKTHEVIBES_VERSION
		);
	}
}

BackTheVibes_Plugin::instance();

/**
 * Uninstall cleanup lives in uninstall.php (WordPress' own convention) so it
 * only runs on actual uninstall, never on deactivate — deactivating and
 * reactivating the plugin must never lose the saved artist slug.
 */

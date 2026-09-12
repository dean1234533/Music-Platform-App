<?php
/**
 * Registers the three Gutenberg blocks, each a thin wrapper around the same
 * BackTheVibes_API + BackTheVibes_Render code the shortcodes use — server-
 * rendered (dynamic) blocks, so there is exactly one HTML/escaping path
 * whether an editor uses a shortcode or a block.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BackTheVibes_Block {

	public function __construct() {
		add_action( 'init', array( $this, 'register_blocks' ) );
	}

	public function register_blocks(): void {
		if ( ! function_exists( 'register_block_type' ) ) {
			return; // WordPress too old for block support — shortcodes still work.
		}

		wp_register_script(
			'backthevibes-blocks-editor',
			BACKTHEVIBES_PLUGIN_URL . 'assets/blocks-editor.js',
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n', 'wp-server-side-render' ),
			BACKTHEVIBES_VERSION,
			true
		);

		register_block_type( BACKTHEVIBES_PLUGIN_DIR . 'blocks/artist-card' );
		register_block_type( BACKTHEVIBES_PLUGIN_DIR . 'blocks/support-button' );
		register_block_type( BACKTHEVIBES_PLUGIN_DIR . 'blocks/music-grid' );
	}
}

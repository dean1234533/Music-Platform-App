<?php
/**
 * [backthevibes_artist], [backthevibes_support], [backthevibes_music].
 * Every shortcode resolves an artist slug (its own attribute, else the
 * site-wide default from Settings -> BackTheVibes), fetches that artist
 * through BackTheVibes_API (cached, read-only), and renders through
 * BackTheVibes_Render — never touching the network or building HTML itself.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BackTheVibes_Shortcodes {

	public function __construct() {
		add_shortcode( 'backthevibes_artist', array( $this, 'render_artist' ) );
		add_shortcode( 'backthevibes_support', array( $this, 'render_support' ) );
		add_shortcode( 'backthevibes_music', array( $this, 'render_music' ) );
	}

	private function resolve_slug( array $atts ): string {
		if ( ! empty( $atts['artist'] ) ) {
			return sanitize_title( $atts['artist'] );
		}
		return BackTheVibes_Settings::get_default_slug();
	}

	private function load_artist( array $atts ) {
		$slug = $this->resolve_slug( $atts );
		if ( '' === $slug ) {
			return null;
		}
		return BackTheVibes_API::get_artist( $slug );
	}

	public function render_artist( $atts ): string {
		$atts   = shortcode_atts(
			array(
				'artist'       => '',
				'show_bio'     => 'yes',
				'show_buttons' => 'yes',
			),
			$atts,
			'backthevibes_artist'
		);
		$artist = $this->load_artist( $atts );
		if ( ! $artist ) {
			return BackTheVibes_Render::unavailable_notice();
		}
		return BackTheVibes_Render::artist_card(
			$artist,
			array(
				'show_bio'     => 'yes' === $atts['show_bio'],
				'show_buttons' => 'yes' === $atts['show_buttons'],
			)
		);
	}

	public function render_support( $atts ): string {
		$atts   = shortcode_atts(
			array(
				'artist' => '',
				'label'  => '',
			),
			$atts,
			'backthevibes_support'
		);
		$artist = $this->load_artist( $atts );
		if ( ! $artist ) {
			return BackTheVibes_Render::unavailable_notice();
		}
		return BackTheVibes_Render::support_button( $artist, array( 'label' => $atts['label'] ) );
	}

	public function render_music( $atts ): string {
		$atts   = shortcode_atts(
			array(
				'artist' => '',
				'limit'  => 6,
			),
			$atts,
			'backthevibes_music'
		);
		$artist = $this->load_artist( $atts );
		if ( ! $artist ) {
			return BackTheVibes_Render::unavailable_notice();
		}
		return BackTheVibes_Render::music_grid( $artist, array( 'limit' => (int) $atts['limit'] ) );
	}
}

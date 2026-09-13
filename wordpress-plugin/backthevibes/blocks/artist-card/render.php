<?php
/**
 * Server-side render callback for backthevibes/artist-card. $attributes
 * and $block are provided by WordPress; nothing here trusts $attributes as
 * pre-sanitised — resolve_slug/get_artist below do their own validation.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$backthevibes_slug = ! empty( $attributes['artist'] ) ? sanitize_title( $attributes['artist'] ) : BackTheVibes_Settings::get_default_slug();
if ( '' === $backthevibes_slug ) {
	echo BackTheVibes_Render::unavailable_notice(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.
	return;
}

$backthevibes_artist = BackTheVibes_API::get_artist( $backthevibes_slug );
if ( ! $backthevibes_artist ) {
	echo BackTheVibes_Render::unavailable_notice(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.
	return;
}

$backthevibes_card_args = array(
	'show_bio'     => ! empty( $attributes['showBio'] ),
	'show_buttons' => ! empty( $attributes['showButtons'] ),
	'show_tracks'  => ! isset( $attributes['showTracks'] ) || $attributes['showTracks'],
	'track_limit'  => ! empty( $attributes['trackLimit'] ) ? absint( $attributes['trackLimit'] ) : 6,
);
echo BackTheVibes_Render::artist_card( $backthevibes_artist, $backthevibes_card_args ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.

<?php
/**
 * Server-side render callback for backthevibes/artist-card. $attributes
 * and $block are provided by WordPress; nothing here trusts $attributes as
 * pre-sanitised — resolve_slug/get_artist below do their own validation.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$slug = ! empty( $attributes['artist'] ) ? sanitize_title( $attributes['artist'] ) : BackTheVibes_Settings::get_default_slug();
if ( '' === $slug ) {
	echo BackTheVibes_Render::unavailable_notice(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.
	return;
}

$artist = BackTheVibes_API::get_artist( $slug );
if ( ! $artist ) {
	echo BackTheVibes_Render::unavailable_notice(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.
	return;
}

echo BackTheVibes_Render::artist_card( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.
	$artist,
	array(
		'show_bio'     => ! empty( $attributes['showBio'] ),
		'show_buttons' => ! empty( $attributes['showButtons'] ),
	)
);

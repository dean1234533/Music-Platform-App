<?php
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

echo BackTheVibes_Render::music_grid( $artist, array( 'limit' => absint( $attributes['limit'] ?? 6 ) ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.

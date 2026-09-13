<?php
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

echo BackTheVibes_Render::music_grid( $backthevibes_artist, array( 'limit' => absint( $attributes['limit'] ?? 6 ) ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside.

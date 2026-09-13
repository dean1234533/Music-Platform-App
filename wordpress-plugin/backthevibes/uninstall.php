<?php
/**
 * Runs only on actual plugin deletion (never on deactivate), per WordPress'
 * own uninstall.php convention. The plugin stores exactly one option (a
 * public artist slug, not a secret) and no other persistent data —
 * transient caches expire on their own and are also cleared here for
 * completeness.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'backthevibes_default_slug' );

global $wpdb;
// Best-effort cleanup of this plugin's own transients; safe to skip if it
// ever fails; the transients also self-expire regardless. A direct query is
// unavoidable here — there is no core WP API to delete transients by a name
// prefix (only by exact key), and caching is meaningless for a query that
// runs exactly once while the site is being torn down.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
		$wpdb->esc_like( '_transient_backthevibes_artist_' ) . '%',
		$wpdb->esc_like( '_transient_timeout_backthevibes_artist_' ) . '%'
	)
);

/**
 * Click-to-load YouTube embeds for the music grid. Nothing is requested
 * from YouTube until a visitor deliberately clicks a track's thumbnail —
 * the same click-to-load, no-autoplay pattern the main BackTheVibes site
 * uses. This never downloads, extracts, or proxies audio/video; it only
 * ever swaps a thumbnail button for the official youtube-nocookie.com
 * iframe embed.
 */
( function () {
	'use strict';

	function playTrack( button ) {
		var videoId = button.getAttribute( 'data-video-id' );
		if ( ! videoId || ! /^[A-Za-z0-9_-]{11}$/.test( videoId ) ) {
			return;
		}
		var iframe = document.createElement( 'iframe' );
		iframe.setAttribute(
			'src',
			'https://www.youtube-nocookie.com/embed/' + encodeURIComponent( videoId ) + '?rel=0&modestbranding=1&autoplay=1'
		);
		iframe.setAttribute( 'title', button.getAttribute( 'aria-label' ) || 'YouTube video' );
		iframe.setAttribute( 'allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' );
		iframe.setAttribute( 'allowfullscreen', '' );
		iframe.className = 'backthevibes-video-frame';
		if ( button.parentNode ) {
			button.parentNode.replaceChild( iframe, button );
		}
	}

	document.addEventListener( 'click', function ( event ) {
		var button = event.target.closest ? event.target.closest( '.backthevibes-video-trigger' ) : null;
		if ( button ) {
			playTrack( button );
		}
	} );
} )();

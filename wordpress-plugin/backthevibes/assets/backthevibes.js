/**
 * Click-to-load YouTube embeds for the music grid. Nothing is requested
 * from YouTube until a visitor deliberately clicks a track's thumbnail —
 * the same click-to-load, no-autoplay pattern the main BackTheVibes site
 * uses. This never downloads, extracts, or proxies audio/video; it only
 * ever swaps a thumbnail button for the official youtube-nocookie.com
 * iframe embed.
 *
 * The embed plays a short CLIP_SECONDS clip, then swaps itself for a link
 * to hear the full track on BackTheVibes — this widget is a teaser (user
 * feedback: a full track playing inline made the combined artist+music
 * card confusing; a short clip that points back to the real site doesn't).
 */
( function () {
	'use strict';

	var CLIP_SECONDS = 20;

	function playTrack( button ) {
		var videoId = button.getAttribute( 'data-video-id' );
		if ( ! videoId || ! /^[A-Za-z0-9_-]{11}$/.test( videoId ) ) {
			return;
		}
		var trackUrl = button.getAttribute( 'data-track-url' ) || '';
		var iframe = document.createElement( 'iframe' );
		iframe.setAttribute(
			'src',
			'https://www.youtube-nocookie.com/embed/' + encodeURIComponent( videoId ) + '?rel=0&modestbranding=1&autoplay=1'
		);
		iframe.setAttribute( 'title', button.getAttribute( 'aria-label' ) || 'YouTube video' );
		iframe.setAttribute( 'allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' );
		iframe.setAttribute( 'allowfullscreen', '' );
		iframe.className = 'backthevibes-video-frame';
		var container = button.parentNode;
		if ( ! container ) {
			return;
		}
		container.replaceChild( iframe, button );

		window.setTimeout( function () {
			// Still there (not clicked away to a new track) — end the clip.
			if ( iframe.parentNode !== container ) {
				return;
			}
			var ended = document.createElement( 'div' );
			ended.className = 'backthevibes-clip-ended';
			var label = document.createElement( 'span' );
			label.className = 'backthevibes-clip-ended-label';
			label.textContent = 'Clip ended';
			ended.appendChild( label );
			if ( trackUrl ) {
				var link = document.createElement( 'a' );
				link.className = 'backthevibes-clip-ended-link';
				link.href = trackUrl;
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.textContent = 'Hear the full track on BackTheVibes →';
				ended.appendChild( link );
			}
			container.replaceChild( ended, iframe );
		}, CLIP_SECONDS * 1000 );
	}

	document.addEventListener( 'click', function ( event ) {
		var button = event.target.closest ? event.target.closest( '.backthevibes-video-trigger' ) : null;
		if ( button ) {
			playTrack( button );
		}
	} );
} )();

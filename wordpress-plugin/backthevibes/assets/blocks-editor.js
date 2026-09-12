/**
 * Editor UI for all three BackTheVibes blocks. Plain JS (createElement, no
 * JSX) so the plugin ships with no build step — it only depends on the
 * wp-* script handles WordPress core already provides. Each block previews
 * itself in the editor via ServerSideRender, calling the exact same PHP
 * render path a visitor sees on the front end.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var registerBlockType = wp.blocks.registerBlockType;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var TextControl = wp.components.TextControl;
	var ToggleControl = wp.components.ToggleControl;
	var RangeControl = wp.components.RangeControl;
	// The component's export shape has changed across WordPress versions —
	// support both rather than pinning to one.
	var ServerSideRender = wp.serverSideRender && wp.serverSideRender.default ? wp.serverSideRender.default : wp.serverSideRender;
	var __ = wp.i18n.__;

	function artistField( attributes, setAttributes ) {
		return el( TextControl, {
			label: __( 'Artist slug (blank = site default)', 'backthevibes' ),
			value: attributes.artist,
			placeholder: __( 'your-artist-slug', 'backthevibes' ),
			onChange: function ( value ) {
				setAttributes( { artist: value } );
			},
		} );
	}

	registerBlockType( 'backthevibes/artist-card', {
		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;
			return el(
				wp.element.Fragment,
				{},
				el(
					InspectorControls,
					{},
					el(
						PanelBody,
						{ title: __( 'BackTheVibes settings', 'backthevibes' ) },
						artistField( attributes, setAttributes ),
						el( ToggleControl, {
							label: __( 'Show bio', 'backthevibes' ),
							checked: attributes.showBio,
							onChange: function ( value ) {
								setAttributes( { showBio: value } );
							},
						} ),
						el( ToggleControl, {
							label: __( 'Show Follow/Support buttons', 'backthevibes' ),
							checked: attributes.showButtons,
							onChange: function ( value ) {
								setAttributes( { showButtons: value } );
							},
						} )
					)
				),
				el( ServerSideRender, { block: 'backthevibes/artist-card', attributes: attributes } )
			);
		},
		save: function () {
			return null;
		},
	} );

	registerBlockType( 'backthevibes/support-button', {
		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;
			return el(
				wp.element.Fragment,
				{},
				el(
					InspectorControls,
					{},
					el(
						PanelBody,
						{ title: __( 'BackTheVibes settings', 'backthevibes' ) },
						artistField( attributes, setAttributes ),
						el( TextControl, {
							label: __( 'Button label (blank = "Support {name}")', 'backthevibes' ),
							value: attributes.label,
							onChange: function ( value ) {
								setAttributes( { label: value } );
							},
						} )
					)
				),
				el( ServerSideRender, { block: 'backthevibes/support-button', attributes: attributes } )
			);
		},
		save: function () {
			return null;
		},
	} );

	registerBlockType( 'backthevibes/music-grid', {
		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;
			return el(
				wp.element.Fragment,
				{},
				el(
					InspectorControls,
					{},
					el(
						PanelBody,
						{ title: __( 'BackTheVibes settings', 'backthevibes' ) },
						artistField( attributes, setAttributes ),
						el( RangeControl, {
							label: __( 'Number of tracks', 'backthevibes' ),
							value: attributes.limit,
							min: 1,
							max: 12,
							onChange: function ( value ) {
								setAttributes( { limit: value } );
							},
						} )
					)
				),
				el( ServerSideRender, { block: 'backthevibes/music-grid', attributes: attributes } )
			);
		},
		save: function () {
			return null;
		},
	} );
} )( window.wp );

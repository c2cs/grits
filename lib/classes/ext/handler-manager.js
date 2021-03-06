/**
 * This class is a "renderer extension" that assists in the
 * management of handlers.  See {@link Dasix.grits.AbsRenderExtension} to
 * learn more about renderer extensions.
 *
 * @class Dasix.grits.ext.HandlerManager
 * @extends Dasix.grits.AbsRenderExtension
 * @author Luke Chavers <luke@chavers.io>
 * @since 0.5.6
 * @version 1.0
 * @copyright 2016 Dasix, Inc. All rights reserved.
 */

// Dependencies
var qx 		= require( "qooxdoo" 	);
var marked 	= require( "marked" 	);
var _ 		= require( "lodash" 	);
var Promise = require( "bluebird" 	);
var vError 	= require( "verror" 	);

// Other classes
require("../abs-render-extension");

qx.Class.define(

	"Dasix.grits.ext.HandlerManager", {

		extend : Dasix.grits.AbsRenderExtension,

		members : /** @lends Dasix.grits.ext.HandlerManager **/ {

			/**
			 * This method is automatically called on all children
			 * of {@link Dasix.grits.AbsRenderExtension}, if it exists.
			 *
			 * @instance
			 * @access public
			 */
			init: function() {

				// Locals
				var me = this;

				// Set the log topic for this extension
				me.setLogTopic("handler.manager");

				// Create handler store
				me.$$handlers = {};

			},

			/**
			 * Provides the collection settings for handlers, which will
			 * be used by the ResourcePathManager.
			 *
			 * @instance
			 * @access public
			 * @returns {object} A collection settings object
			 */
			getCollectionSettings: function() {

				return {
					short          : "handler",
					name           : "DustJS Handler Function Path",
					defaultSubdir  : "handlers",
					scanExtensions : ["js"],
					methodName     : "Handler"
				};

			},

			/**
			 * Loads all handlers. This is the main entry point for the
			 * handler manager's part in render operations.
			 *
			 * @instance
			 * @access public
			 * @returns {Promise}
			 */
			loadAll : function() {

				// Locals
				var me 		= this;
				var grits 	= me.getGrits();
				var col 	= grits.getPathCollection("handler");

				// Initial log message
				me.logOpStart("Loading all Dust.js Handlers");

				// Setup scan options
				var scanOpts = {
					noMatchHandler: function() {
						me.log("info", "found.none", "No Dust.js handlers were found or loaded!");
					}
				};

				// Emit Pre-operation Event
				me.emit( "beforeLoadHandlers" );

				// Iterate over each resource
				return col.eachResource( me._loadOne.bind(me), scanOpts ).then(
					function( resourceFiles ) {

						// Add watch config
						me._addCollectionWatcher( col, me._handleWatchUpdate.bind(me) );

						// Emit Post-operation Event
						me.emit( "afterLoadHandlers", { dust: grits.dust } );

					}
				);

			},

			/**
			 * Loads a single handler.  This is the main work
			 * horse for this renderer extension.
			 *
			 * @instance
			 * @access private
			 * @param {Dasix.grits.File} file The source file
			 * @returns {void}
			 */
			_loadOne: function( file ) {

				// Locals
				var me 			= this;
				var grits 		= me.getGrits();
				var handlerName = file.getBaseName();
				var filePath	= file.getAbsoluteFilePath();

				// Log the info we have so far
				me.log("debug", "load", "Handler function loaded: {" + handlerName + "}");
				me.logKeyVal( "Source", filePath );

				// Add the handler to the internal store
				var handler = me.requireLatest( filePath );

				// Create a wrapper
				me.$$handlers[ handlerName ] = function( chunk, context, bodies, params ) {

					// Add a reference to the active render file
					grits.dustManager.addTemplateDependencyRef( "handler", handlerName );

					// Pass through to the underlying function
					return handler( chunk, context, bodies, params, me );

				};

				// Fire an event
				me.emit( "onHandlerLoaded", { fnHandler: me.$$handlers[ handlerName ], fnOriginal: handler, file: file, handlerName: handlerName, handlerManager: me } );

			},

			/**
			 * When watching is enabled, this method will be called
			 * whenever a watch event is triggered.
			 *
			 * @instance
			 * @access private
			 * @param eventName
			 * @param file
			 * @param extra
			 * @private
			 */
			_handleWatchUpdate: function( eventName, file, extra ) {

				var me 				= this;
				var grits 			= me.getGrits();
				var handlerName 	= file.getBaseName();

				if( eventName === "add" || eventName === "change" ) {

					// Reload handler
					me._loadOne( file );

					// Trigger render update op for content files that implement the handler
					grits.dustManager.triggerRefUpdate( "handler", handlerName );

				}

			},

			/**
			 * Applies all loaded handlers to a context object, usually
			 * in preparation for a template compilation op.
			 *
			 * @instance
			 * @access public
			 * @param {object} context
			 * @returns {object} The updated context; this is probably not
			 * very useful since the context object will be updated byRef, but..
			 * just in case.
			 */
			applyHandlersToContext: function( context ) {

				// Locals
				var me = this;
				var handlers = me.$$handlers;

				// Apply handlers (a.k.a context helpers)
				_.each( handlers, function( handlerFn, handlerName ) {
					context[ handlerName ] = handlerFn;
				});

				return context;

			}


		}
	}
);

/**
 * (c) 2017 cepharum GmbH, Berlin, http://cepharum.de
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 cepharum GmbH
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * @author: cepharum
 */

"use strict";

const { Duplex } = require( "stream" );

const Context = require( "./context" );
const Parser = require( "./parser" );


module.exports = class ParsingStream extends Duplex {
	/**
	 * @param {object} options
	 */
	constructor( options = {} ) {
		if ( options.objectMode ) {
			throw new TypeError( "object-mode streams not supported" );
		}

		super( options );

		let parser = null;

		this._offset = 0;

		Object.defineProperties( this, {
			_buffers: { value: [] },
			context: { value: options.context || new Context() },
			parser: {
				get: () => parser,
				set: newParser => {
					if ( newParser && !( newParser instanceof Parser ) ) {
						throw new TypeError( "invalid parser" );
					}

					parser = newParser;
				}
			}
		} );

		if ( options.initialParser ) {
			this.parser = options.initialParser;
		}
	}

	/**
	 * Provides further data to be read from current stream.
	 *
	 * @private
	 */
	_read() {
		let length = this._buffers.length,
			read;

		// push as many available buffers as possible
		for ( read = 0; read < length; ) {
			if ( this.push( this._buffers[read++] ) === false ) {
				break;
			}
		}

		if ( read > 0 ) {
			// having pushed at least one chunk the reader will come back and so
			// we are not in charge of sending chunk as soon as it becomes available
			this._awaiting = false;

			// drop all chunks pushed this time
			this._buffers.splice( 0, read );
		} else {
			// haven't pushed anything (due to haven't received anything before)
			// -> remember to be in charge of pushing sth. to prevent stalling
			//    reader side
			this._awaiting = true;
		}
	}

	/**
	 * Receives another chunk of data.
	 *
	 * @param {Buffer|string} chunk
	 * @param {?string} encoding
	 * @param {function(error:Error=)} doneFn
	 * @private
	 */
	_write( chunk, encoding, doneFn ) {
		if ( encoding ) {
			// got string, but work with buffers, only
			chunk = Buffer.from( chunk, encoding );
		}

		// process this chunk by trying to parse as much as possible before
		// passing it to reading side of current stream
		process( this );


		/**
		 * Tries to parse (another) (part of) received chunk data.
		 *
		 * @param {ParsingStream} stream
		 */
		function process( stream ) {
			let promise;

			// ask any current parser to parse as much data as possible
			const parser = this.parser;
			if ( parser ) {
				promise = parser.parse( this.context, chunk, this._offset );
			} else {
				promise = Promise.resolve( { parsed: [chunk] } );
			}

			// handle response from parser
			promise.then( ( { parsed, unparsed, parser } ) => {
				/*
				 * #1: push any parsed data to reading side of stream
				 */
				if ( parsed.length > 0 && this._awaiting && !this._buffers.length ) {
					// stream is expected to push some readable data
					// -> push first provided chunk immediately so stream is
					//    resumed on reader side
					this.push( parsed.shift() );
					this._awaiting = false;
				}

				// collect (any additionally) provided chunks locally
				for ( let i = 0, length = parsed.length; i < length; i++ ) {
					this._buffers.push( parsed[i] );
				}


				/*
				 * #2: optionally switch parser
				 */
				if ( parser ) {
					stream.parser = parser;
				}


				/*
				 * #3: restart processing any data left unparsed by now
				 */
				if ( unparsed && unparsed.length ) {
					process.nextTick( process, stream );
				} else {
					this._offset += chunk.length;

					doneFn();
				}
			} )
				.catch( doneFn );
		}
	}
};

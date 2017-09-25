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

const { Transform } = require( "stream" );

const Context = require( "./context" );
const Parser = require( "./parser" );


/**
 * @type {ParsingStream}
 * @name ParsingStream
 * @property {Context} context
 * @property {?Parser} parser
 */
module.exports = class ParsingStream extends Transform {
	/**
	 * @param {object} options
	 */
	constructor( options = {} ) {
		if ( options.objectMode ) {
			throw new TypeError( "object-mode streams not supported" );
		}

		options.decodeStrings = false;

		super( options );

		let parser = null;

		this._offset = 0;

		Object.defineProperties( this, {
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
	 * @param {function(error:Error=)} doneFn
	 * @protected
	 */
	_flush( doneFn ) {
		if ( this.parser && this.parser.wasMatchingPartially ) {
			this.push( this.parser.data );
		}

		doneFn();
	}

	/**
	 * Receives another chunk of data for parsing and optionally transforming.
	 *
	 * @param {Buffer|string} chunk
	 * @param {?string} encoding
	 * @param {function(error:Error=)} doneFn
	 * @private
	 */
	_transform( chunk, encoding, doneFn ) {
		if ( typeof chunk === "string" ) {
			// got string, but work with buffers, only
			chunk = Buffer.from( chunk, encoding );
		}

		// process this chunk by trying to parse as much as possible before
		// passing it to reading side of current stream
		processor( this, chunk );


		/**
		 * Tries to parse (another) (part of) received chunk data.
		 *
		 * @param {ParsingStream} stream
		 * @param {Buffer} buffer
		 */
		function processor( stream, buffer ) {
			let promise;

			// ask any current parser to parse as much data as possible
			const parser = stream.parser;
			if ( parser ) {
				promise = parser.parse( stream.context, buffer, stream._offset );
			} else {
				promise = Promise.resolve( { parsed: [buffer] } );
			}

			// handle response from parser
			promise.then( ( { parsed, unparsed, parser } ) => {
				/*
				 * #1: push any parsed data to reading side of stream
				 */
				for ( let i = 0, length = parsed.length; i < length; i++ ) {
					stream.push( parsed[i] );
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
				stream._offset += buffer.length;

				if ( unparsed && unparsed.length ) {
					stream._offset -= unparsed.length;

					process.nextTick( processor, stream, unparsed );
				} else {
					doneFn();
				}
			} )
				.catch( doneFn );
		}
	}
};

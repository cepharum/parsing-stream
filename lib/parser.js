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


/**
 * @typedef {object} ParserResult
 * @param {Buffer[]} parsed list of buffers parsed before
 * @param {?Buffer} unparsed buffer containing data left unparsed
 * @param {?Parser} parser selects new parser to use for any unparsed data
 */

/**
 * Implements generic parser interface suitable for successively parsing a
 * sequence of buffers.
 *
 * @type {Parser}
 * @name Parser
 * @property {Buffer[]} buffers raw set of collected buffers previously kept for
 *                      probably matching current parser's expectations
 * @property {Buffer} data buffer with data previously kept for probably
 *                    matching current parser's expectations
 * @property {function(context:Context, parser:Parser, matchOffset:int):(?Array<Buffer>|Promise<?Array<Buffer>>)} onMatch callback invoked if current parser has got matching input
 */
module.exports = class Parser {
	/**
	 */
	constructor() {
		let handler = null;

		this._matchingBuffers = [];

		Object.defineProperties( this, {
			onMatch: {
				get: () => handler,
				set: fn => {
					if ( !fn || typeof fn === "function" ) {
						handler = fn;
					} else {
						throw new TypeError( "invalid match handler" );
					}
				}
			}
		} );
	}

	/**
	 * Fetches raw data matching current parser's expectations.
	 *
	 * @returns {?Buffer}
	 */
	get data() {
		const length = this._matchingBuffers.length;
		if ( length > 1 ) {
			this._matchingBuffers.splice( 0, length, Buffer.concat( this._matchingBuffers ) );
		}

		return ( length > 0 ) ? this._matchingBuffers[0] : null;
	}

	/**
	 * Indicates if parser was matching partially previously.
	 *
	 * @returns {boolean}
	 */
	get wasMatchingPartially() {
		return ( this._matchingBuffers.length > 0 );
	}

	/**
	 * Invokes attached handler when parser has matched some input.
	 *
	 * @param {Context} context reference on context for sharing results of parsing
	 * @param {int} matchOffset byte offset of match in context of larger file or stream
	 * @returns {Promise<?Array<Buffer>>} promises optional set of buffers replacing matching ones
	 */
	_handleMatch( context, matchOffset ) {
		let result = null;

		if ( this.onMatch ) {
			result = this.onMatch( context, this, matchOffset );
		}

		return result instanceof Promise ? result : Promise.resolve( result );
	}

	/**
	 * Parses another buffer considered representing slice of file or stream at
	 * provided offset for sharing extracted information in provided context.
	 *
	 * @abstract
	 */
	parse( /* context, buffer, atOffset */ ) {
		throw new Error( "invalid use of basic parser" );
	}

	/**
	 * Handles detection of full match in slice of provided buffer starting at
	 * (probably negative) byte index `firstIndex` and ending at `lastIndex`
	 * _inclusively_.
	 *
	 * @param {Context} context reference on context for sharing results of parsing
	 * @param {Buffer} buffer buffer containing (trailing parts of) match
	 * @param {int} atOffset offset of currently processed buffer in context of a larger file or stream
	 * @param {int} firstIndex first byte index of found match, might be negative if match has started as partial match before
	 * @param {int} lastIndex last _inclusive_ byte index of found match
	 * @param {?Parser} transitionTo transition to be included with resulting parser result descriptor
	 * @returns {Promise.<ParserResult>}
	 * @protected
	 */
	_fullMatch( context, buffer, atOffset, firstIndex, lastIndex, transitionTo = null ) {
		let parsed = [];

		if ( firstIndex > -1 ) {
			if ( this._matchingBuffers.length > 0 ) {
				parsed.push = this._matchingBuffers;
				this._matchingBuffers = [];
			}

			if ( firstIndex > 0 ) {
				parsed.push( buffer.slice( 0, firstIndex ) );
			}
		}

		this._matchingBuffers.push( buffer.slice( Math.max( 0, firstIndex ), lastIndex + 1 ) );

		return this._handleMatch( context, atOffset + firstIndex )
			.then( replacingBuffers => {
				const buffers = replacingBuffers || this._matchingBuffers;

				for ( let i = 0, length = buffers.length; i < length; i++ ) {
					parsed.push( buffers[i] );
				}

				this._matchingBuffers = [];

				return {
					parsed,
					unparsed: buffer.slice( lastIndex + 1 ),
					transitionTo,
				};
			} );
	}

	/**
	 * Handles partial match at end of provided buffer.
	 *
	 * @param {Buffer} buffer
	 * @param {int} firstMatchIndex inclusive offset of first matching byte in buffer
	 * @returns {Promise.<ParserResult>}
	 * @protected
	 */
	_partialMatch( buffer, firstMatchIndex ) {
		let parsed = [];

		if ( firstMatchIndex > -1 ) {
			parsed = this._matchingBuffers;
			this._matchingBuffers = [];

			if ( firstMatchIndex > 0 ) {
				parsed.push( buffer.slice( 0, firstMatchIndex ) );
			}
		}

		if ( firstMatchIndex < buffer.length ) {
			this._matchingBuffers.push( buffer.slice( Math.max( 0, firstMatchIndex ) ) );
		}

		return Promise.resolve( {
			parsed
		} );
	}
};

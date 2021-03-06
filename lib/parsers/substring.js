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

const Parser = require( "../parser" );


/**
 *
 */
module.exports = class SubstringParser extends Parser {
	/**
	 * @param {Buffer} sub
	 */
	constructor( sub ) {
		super();

		this._index = 0;
		this._sub = sub;
	}

	/**
	 * Parses provided buffer for containing data matching expectations.
	 *
	 * @param {Context} context reference on context for sharing results of parsing
	 * @param {Buffer} buffer slice of data to be parsed
	 * @param {int} atOffset provides offset of provided buffer in context of a larger file or stream
	 * @returns {Promise<ParserResult>}
	 */
	parse( context, buffer, atOffset ) {
		let matchIndex = this._index;

		for ( let read = 0, length = buffer.length; read < length; read++ ) {
			if ( buffer[read] === this._sub[matchIndex] ) {
				matchIndex++;

				if ( matchIndex >= this._sub.length ) {
					this._index = 0;

					const firstIndex = read - matchIndex + 1;

					return this._fullMatch( context, buffer, atOffset, firstIndex, read );
				}
			} else {
				matchIndex = 0;
			}
		}

		this._index = matchIndex;

		return this._partialMatch( buffer, buffer.length - matchIndex );
	}
};

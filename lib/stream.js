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


module.exports = class PJLStream extends Duplex {
	/**
	 * @param {object} options
	 */
	constructor( options ) {
		super( options );

		Object.defineProperties( this, {
			_buffers: { value: [] },
			jobs: []
		} );
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
			chunk = Buffer.from( chunk, encoding );
		}

		this._parse( chunk )
			.then( chunks => {
				if ( chunks.length > 0 && this._awaiting && !this._buffers.length ) {
					// stream is expected to push some readable data
					// -> push first provided chunk immediately so stream is
					//    resumed on reader side
					this.push( chunks.shift() );
					this._awaiting = false;
				}

				// collect (any additionally) provided chunks locally
				for ( let i = 0, length = chunks.length; i < length; i++ ) {
					this._buffers.push( chunks[i] );
				}

				doneFn();
			} )
			.catch( doneFn );
	}
};

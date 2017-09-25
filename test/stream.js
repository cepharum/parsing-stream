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

const { Readable, Writable, Duplex, Transform } = require( "stream" );

const Should = require( "should" );

const { Stream, Parser, Context, BufferStream } = require( "../" );


suite( "ParsingStream", function() {
	test( "is a readable stream", function() {
		const stream = new Stream();

		stream.should.be.instanceOf( Readable );
	} );

	test( "is a writable stream", function() {
		const stream = new Stream();

		stream.should.be.instanceOf( Writable );
	} );

	test( "hence is a duplex stream", function() {
		const stream = new Stream();

		stream.should.be.instanceOf( Duplex );
	} );

	test( "is a transform stream, actually", function() {
		const stream = new Stream();

		stream.should.be.instanceOf( Transform );
	} );

	test( "rejects to process in object-mode", function() {
		( () => new Stream( { objectMode: true } ) ).should.throw();
		( () => new Stream( { objectMode: false } ) ).should.not.throw();
	} );

	test( "does not have any attached parser initially", function() {
		const stream = new Stream();

		Should.not.exist( stream.parser );
	} );

	test( "initially exposes parser provided on construction", function() {
		const parser = new Parser();
		const stream = new Stream( {
			initialParser: parser
		} );

		stream.parser.should.equal( parser );
	} );

	test( "always exposes some context to use on parsing", function() {
		const stream = new Stream();

		stream.context.should.be.instanceOf( Context );
	} );

	test( "exposes same context provided on construction explicitly", function() {
		const context = new Context();
		const stream = new Stream( { context } );

		stream.context.should.equal( context );
	} );
} );

suite( "Piping data through ParsingStream", function() {
	test( "passes all data piped through w/o attaching parser/filter", function() {
		const message = "Hello World!\x01Some data";

		const source = new BufferStream.Reader( Buffer.from( message, "ascii" ), 2 );
		const target = new BufferStream.Writer();
		const stream = new Stream();

		stream.pipe( target );
		source.pipe( stream );

		return target.asPromise
			.then( data => {
				data.should.be.instanceOf( Buffer );
				data.toString( "ascii" ).should.be.equal( message );
			} );
	} );

	test( "detects contained data as it passes using attached parser", function() {
		const message = "I were there where is no atmosphere";

		const parser = new SubstringParser( Buffer.from( "ere ", "ascii" ) );
		const source = new BufferStream.Reader( Buffer.from( message, "ascii" ), 2 );
		const target = new BufferStream.Writer();
		const stream = new Stream( {
			initialParser: parser,
		} );

		parser.onMatch = function( context, parser, atOffset ) {
			if ( !Array.isArray( context.matches ) ) {
				context.matches = [];
			}

			context.matches.push( { match: parser.data, offset: atOffset } );
		};

		stream.pipe( target );
		source.pipe( stream );

		return target.asPromise
			.then( data => {
				data.should.be.instanceOf( Buffer );
				data.toString( "ascii" ).should.be.equal( message );

				stream.context.should.have.a.property( "matches" ).which.is.an.Array().and.has.a.length( 3 );

				stream.context.matches[0].should.be.an.Object().and.have.properties( "match", "offset" ).and.has.a.size( 2 );
				stream.context.matches[1].should.be.an.Object().and.have.properties( "match", "offset" ).and.has.a.size( 2 );
				stream.context.matches[2].should.be.an.Object().and.have.properties( "match", "offset" ).and.has.a.size( 2 );

				stream.context.matches[0].match.should.be.an.instanceOf( Buffer ).and.has.a.length( 4 );
				stream.context.matches[0].match.toString( "ascii" ).should.is.equal( "ere " );
				stream.context.matches[1].match.should.be.an.instanceOf( Buffer ).and.has.a.length( 4 );
				stream.context.matches[1].match.toString( "ascii" ).should.be.equal( "ere " );
				stream.context.matches[2].match.should.be.an.instanceOf( Buffer ).and.has.a.length( 4 );
				stream.context.matches[2].match.toString( "ascii" ).should.be.equal( "ere " );

				stream.context.matches[0].offset.should.be.equal( 3 );
				stream.context.matches[1].offset.should.be.equal( 9 );
				stream.context.matches[2].offset.should.be.equal( 15 );
			} );
	} );
} );

/**
 *
 */
class SubstringParser extends Parser {
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
}

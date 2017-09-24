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

const { Readable, Writable, Duplex } = require( "stream" );

const Should = require( "should" );

const { Stream, Parser, Context } = require( "../" );


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

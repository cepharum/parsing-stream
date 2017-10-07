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

const OS = require( "os" );
const Path = require( "path" );
const File = require( "fs" );
const Crypt = require( "crypto" );

const Should = require( "should" );

const { Stream, Parser, Context, BufferStream, SubstringParser } = require( "../" );


suite( "Processing huge data", function() {
	let tempFolder = null;
	let srcFile = null;
	let destFile = null;

	const testString = Buffer.from( "some test-string to be searched", "utf8" );
	let expectedCount = 0;


	before( "creating some huge temporary file", function( done ) {
		this.timeout( 10000 );

		File.mkdtemp( Path.join( OS.tmpdir(), "parsing-stream-" ), ( error, folder ) => {
			if ( error ) {
				done( error );
			} else {
				tempFolder = folder;

				srcFile = Path.join( folder, "huge.data" );
				destFile = Path.join( tempFolder, "output.data" );


				// create 150MiB file consisting of some random data
				let fs = File.createWriteStream( srcFile );

				_write( fs, 19200, done );
			}
		} );


		/**
		 * @param {Writable} fs
		 * @param {int} count
		 * @param {function(error:Error=)} done
		 * @private
		 */
		function _write( fs, count, done ) {
			if ( !count ) {
				fs.end( done );
			} else {
				Crypt.randomBytes( 8192, ( error, buffer ) => {
					if ( error ) {
						fs.end( () => done( error ) );
					} else {
						if ( count % 1000 === 1 ) {
							expectedCount++;
							buffer = Buffer.concat( [ testString, buffer ] );
						}

						fs.write( buffer, () => _write( fs, count - 1, done ) );
					}
				} );
			}
		}
	} );

	after( "removing streamed output", function( done ) {
		if ( destFile ) {
			File.unlink( destFile, error => {
				if ( error && error.code !== "ENOENT" ) {
					done( error );
				} else {
					done();
				}
			} );
		} else {
			done();
		}
	} );

	after( "removing some huge temporary file", function( done ) {
		if ( tempFolder ) {
			File.unlink( srcFile, error => {
				if ( error && error.code !== "ENOENT" ) {
					done( error );
				} else {
					File.rmdir( tempFolder, done );
				}
			} );
		} else {
			done();
		}
	} );


	test( "can be read w/o error", function( done ) {
		this.timeout( 10000 );

		const input = File.createReadStream( srcFile );
		const output = File.createWriteStream( destFile );

		const stream = new Stream();

		input.on( "error", done );
		output.on( "error", done );

		output.on( "finish", () => {
			File.stat( srcFile, ( error, srcStat ) => {
				if ( error ) {
					return done( error );
				}

				File.stat( destFile, ( error, dstStat ) => {
					if ( error ) {
						done( error );
					}

					srcStat.size.should.be.above( 150000000 ).and.equal( dstStat.size );

					done();
				} );
			} );
		} );

		stream.pipe( output );
		input.pipe( stream );
	} );

	test( "can be parsed for containing some substring", function( done ) {
		this.timeout( 10000 );

		const input = File.createReadStream( srcFile );
		const output = File.createWriteStream( destFile );

		const parser = new SubstringParser( testString );
		parser.onMatch = function( context, buffers, atOffset ) {
			if ( !Array.isArray( context.matches ) ) {
				context.matches = [];
			}

			context.matches.push( { match: this.data, offset: atOffset } );
		};

		const stream = new Stream( { initialParser: parser } );

		input.on( "error", done );
		output.on( "error", done );

		output.on( "finish", () => {
			stream.context.should.have.property( "matches" ).which.is.an.Array().and.has.length( expectedCount );

			File.stat( srcFile, ( error, srcStat ) => {
				if ( error ) {
					return done( error );
				}

				File.stat( destFile, ( error, dstStat ) => {
					if ( error ) {
						done( error );
					}

					srcStat.size.should.be.above( 150000000 ).and.equal( dstStat.size );

					done();
				} );
			} );
		} );

		stream.pipe( output );
		input.pipe( stream );
	} );
} );

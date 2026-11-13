/**
 * Animated QR codes (offline games, Trevor 2026-10-26): text too long for one code the phone
 * camera reads well is cut into frames shown one after another, and the reading phone
 * collects them in any order until it has every one. Each frame says which text it belongs
 * to, so frames of another code seen in passing are not mixed in.
 *
 * Frames are fountain codes (`GB2`, below).
 */
import { fromBase64Url, toBase64Url } from './base64url.ts';
import { blockCount, encodePiece, FountainDecoder } from './fountain.ts';

/** More blocks than this take too long to read; the bytes are refused instead. */
export const MAX_QR_FRAMES = 60;

function fnv1a(length: number, at: (i: number) => number): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < length; i++) {
		hash ^= at(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash;
}

const bytesId = (bytes: Uint8Array) => fnv1a(bytes.length, (i) => bytes[i]);

/**
 * Bytes per fountain-code piece: with its header and in base64, a frame of about 850
 * characters, the size Divan's tests read fastest off a screen
 * (https://divan.dev/posts/animatedqr/: 850-byte frames, low error correction).
 */
const QR_PIECE_BYTES = 600;
/** Pieces shown per block before the loop starts again: enough spares for missed frames. */
const PIECES_PER_BLOCK = 3;

const isPrime = (n: number) => {
	for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
	return n > 1;
};

/**
 * Frames in a loop: a prime number of them. A camera that keeps catching every second or
 * third frame would otherwise see the same frames each loop, and never the rest (measured:
 * every third frame of a 3K loop seldom decodes).
 */
function loopLength(k: number): number {
	let count = k * PIECES_PER_BLOCK;
	while (!isPrime(count)) count++;
	return count;
}

/**
 * Frames of a fountain code for `bytes` (GB2, Trevor 2026-10-27): `GB2:<id>:<length>:<piece>:<data>`,
 * pieces 1..K first, then spares, a prime number in all; null when it needs more than `MAX_QR_FRAMES` blocks.
 */
export function fountainFrames(bytes: Uint8Array, size = QR_PIECE_BYTES): string[] | null {
	const k = blockCount(bytes.length, size);
	if (k > MAX_QR_FRAMES) return null;
	const id = bytesId(bytes);
	const count = k === 1 ? 1 : loopLength(k);
	return Array.from(
		{ length: count },
		(_, i) =>
			`GB2:${id.toString(36)}:${bytes.length}:${i + 1}:${toBase64Url(encodePiece(bytes, size, i + 1, id))}`
	);
}

const PIECE = /^GB2:([0-9a-z]{1,7}):(\d{1,6}):(\d{1,6}):([\w-]+)$/;

/**
 * A frame's text from a code the camera read: a frame is a link to this app's Join game with
 * the frame last in its hash (`/join#q=...`, or `#r=<room>&q=...`), so a phone's camera app
 * opens the app. Undefined for any other code.
 */
function unwrapQrFrame(text: string): string | undefined {
	const at = /[#&]q=/.exec(text);
	return at ? text.slice(at.index + 3) : undefined;
}

/** What reading one more code did. */
export type QrFrameRead =
	| {
			kind: 'frame';
			read: number;
			total: number;
			/** Which pieces of the whole are in, for the reading phone's progress. */
			have: boolean[];
	  }
	| { kind: 'bytes'; bytes: Uint8Array };

/** Collects the frames of one code as the camera reads them, in any order. */
export class QrFrameCollector {
	#fountain: { key: string; decoder: FountainDecoder } | undefined;

	/** Adds a code the camera read; null when it is not a frame. */
	add(read: string): QrFrameRead | null {
		const text = unwrapQrFrame(read);
		return text === undefined ? null : this.#addPiece(text);
	}

	#addPiece(text: string): QrFrameRead | null {
		const match = PIECE.exec(text);
		if (!match) return null;
		const id = parseInt(match[1], 36);
		const length = Number(match[2]);
		const seq = Number(match[3]);
		let data: Uint8Array;
		try {
			data = fromBase64Url(match[4]);
		} catch {
			return null;
		}
		if (length < 1 || seq < 1 || data.length === 0) return null;
		if (blockCount(length, data.length) > MAX_QR_FRAMES) return null;
		const key = `${match[1]}:${length}:${data.length}`;
		// Another code's piece: start again on that one.
		if (this.#fountain?.key !== key) {
			this.#fountain = { key, decoder: new FountainDecoder(length, data.length, id) };
		}
		const { decoder } = this.#fountain;
		decoder.add(seq, data);
		const bytes = decoder.bytes();
		if (!bytes) return { kind: 'frame', read: decoder.known, total: decoder.k, have: decoder.have };
		this.#fountain = undefined;
		// A damaged piece that still parsed: start again rather than load broken bytes.
		if (bytesId(bytes) !== id) return { kind: 'frame', read: 0, total: decoder.k, have: [] };
		return { kind: 'bytes', bytes };
	}
}

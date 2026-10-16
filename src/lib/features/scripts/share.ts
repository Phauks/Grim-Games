/**
 * Share links for scripts, all in the URL hash so nothing lands in a query string or a
 * Worker log (CLAUDE.md). Shortest first (08-script-loading.md §5.5):
 * - `#e=tb`: an official edition;
 * - `#bs=1234/1.0.0`: a BotC Scripts script (version optional), loaded through our Worker;
 * - `#c=poisoned-drunk-imp-bell`: a word code for a script stored on our Worker;
 * - `#s=1.<data>`: the script's TPI JSON itself, deflated and base64url-encoded. Works
 *   offline and with no server, so it is the fallback when a code can't be made.
 */
import type { BotcScriptsRef } from './botcscripts-api.ts';
import { normaliseShareCode } from './share-codes-api.ts';

const PREFIX = '1.';
/** Decoded scripts larger than this are refused; a 201-character script is far smaller. */
const MAX_BYTES = 1_000_000;

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
	const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
	const reader = output.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		if (total > MAX_BYTES) {
			await reader.cancel();
			throw new Error('The shared script is too large.');
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/** The hash payload (without `#s=`) for a script's JSON. */
export async function encodeSharedScript(json: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(json));
	return PREFIX + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

/** Reads a payload made by `encodeSharedScript`. Throws on anything else. */
export async function decodeSharedScript(payload: string): Promise<unknown> {
	if (!payload.startsWith(PREFIX)) throw new Error('This share link is from a newer version.');
	let bytes: Uint8Array;
	try {
		bytes = fromBase64Url(payload.slice(PREFIX.length));
	} catch (error) {
		throw new Error('This share link is damaged.', { cause: error });
	}
	let text: string;
	try {
		text = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
	} catch (error) {
		if (error instanceof Error && error.message.includes('too large')) throw error;
		throw new Error('This share link is damaged.', { cause: error });
	}
	return JSON.parse(text);
}

/** What a share link points at. */
export type SharedRef =
	| { kind: 'edition'; edition: string }
	| { kind: 'botcscripts'; ref: Extract<BotcScriptsRef, { kind: 'script' }> }
	| { kind: 'code'; code: string }
	| { kind: 'inline'; payload: string };

const EDITION = /^[a-z]{1,16}$/;
const BOTC = /^(\d{1,9})(?:\/([\w.-]{1,32}))?$/;

/** The shared script a location hash points at, if any. Malformed values are ignored. */
export function sharedRefFromHash(hash: string): SharedRef | undefined {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	const edition = params.get('e');
	if (edition !== null && EDITION.test(edition)) return { kind: 'edition', edition };
	const botc = BOTC.exec(params.get('bs') ?? '');
	if (botc) {
		const scriptId = Number(botc[1]);
		return {
			kind: 'botcscripts',
			ref: botc[2] ? { kind: 'script', scriptId, version: botc[2] } : { kind: 'script', scriptId }
		};
	}
	const code = normaliseShareCode(params.get('c') ?? '');
	if (code) return { kind: 'code', code };
	const payload = params.get('s');
	return payload ? { kind: 'inline', payload } : undefined;
}

/** The hash (with `#`) for a shared script. */
export function sharedRefHash(ref: SharedRef): string {
	switch (ref.kind) {
		case 'edition':
			return `#e=${ref.edition}`;
		case 'botcscripts':
			return `#bs=${ref.ref.scriptId}${ref.ref.version ? `/${ref.ref.version}` : ''}`;
		case 'code':
			return `#c=${ref.code}`;
		case 'inline':
			return `#s=${ref.payload}`;
	}
}

/**
 * Where share links open: the player view (`/play`) by default, since players share
 * scripts with each other; `/scripts` loads it as a Storyteller's script instead.
 */
export type SharePath = '/play' | '/scripts';

/** A full share link that carries the whole script (`#s=`). */
export async function shareLink(
	origin: string,
	json: unknown,
	path: SharePath = '/play'
): Promise<string> {
	return `${origin}${path}${sharedRefHash({ kind: 'inline', payload: await encodeSharedScript(json) })}`;
}

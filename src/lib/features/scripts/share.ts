/**
 * Share links for scripts, all in the URL hash so nothing lands in a query string or a
 * Worker log (CLAUDE.md). Shortest first (08-script-loading.md §5.5):
 * - `#e=tb`: an official edition;
 * - `#bs=1234/1.0.0`: a BotC Scripts script (version optional), loaded through our Worker;
 * - `#c=482913`: a six-digit code for a script stored on our Worker (older links may
 *   carry a four-word code, which still opens);
 * - `#s=1.<data>`: the script's TPI JSON itself, deflated and base64url-encoded. Works
 *   offline and with no server, so it is the fallback when a code can't be made.
 *
 * `&o=1` after `#e=` or `#s=` marks an offline code (Trevor, 2026-10-26): the phone got the
 * script with no internet, so it knows the rest of the game is not coming to it.
 */
import { fromBase64Url, toBase64Url } from '#lib/core/codes/base64url.ts';
import { fountainFrames } from '#lib/core/codes/qr-frames.ts';
import type { BotcScriptsRef } from './botcscripts-api.ts';
import { normaliseShareCode } from './share-codes-api.ts';

const PREFIX = '1.';
/** Decoded scripts larger than this are refused; a 201-character script is far smaller. */
const MAX_BYTES = 1_000_000;

/**
 * Why a share link can't be read. The message stays English (this module also runs in
 * Node for tests); the app shows its own words for `reason`.
 */
export class SharedLinkError extends Error {
	constructor(
		readonly reason: 'tooLarge' | 'newer' | 'damaged',
		options?: ErrorOptions
	) {
		super(
			{
				tooLarge: 'The shared script is too large.',
				newer: 'This share link is from a newer version.',
				damaged: 'This share link is damaged.'
			}[reason],
			options
		);
		this.name = 'SharedLinkError';
	}
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
			throw new SharedLinkError('tooLarge');
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

/** A script's JSON, deflated: what `#s=` carries, in base64. */
async function deflateScript(json: unknown): Promise<Uint8Array> {
	const bytes = new TextEncoder().encode(JSON.stringify(json));
	return pipe(bytes, new CompressionStream('deflate-raw'));
}

/** The hash payload (without `#s=`) for a script's JSON. */
export async function encodeSharedScript(json: unknown): Promise<string> {
	return PREFIX + toBase64Url(await deflateScript(json));
}

/** Reads a payload made by `encodeSharedScript`. Throws on anything else. */
export async function decodeSharedScript(payload: string): Promise<unknown> {
	if (!payload.startsWith(PREFIX)) throw new SharedLinkError('newer');
	let bytes: Uint8Array;
	try {
		bytes = fromBase64Url(payload.slice(PREFIX.length));
	} catch (error) {
		throw new SharedLinkError('damaged', { cause: error });
	}
	let text: string;
	try {
		text = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
	} catch (error) {
		if (error instanceof SharedLinkError) throw error;
		throw new SharedLinkError('damaged', { cause: error });
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

/**
 * The live room an offline code names (`r=`, Trevor 2026-10-27: "connecting to a game if they
 * gain a connection"), from a hash or a scanned link; undefined when it names none.
 */
export function offlineRoomFrom(text: string): string | undefined {
	return /[#&]r=(\d{6})(?=&|$)/.exec(text)?.[1];
}

/** Whether a location hash is an offline code's (`&o=1`). */
export function isOfflineHash(hash: string): boolean {
	return new URLSearchParams(hash.replace(/^#/, '')).get('o') === '1';
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

/** An offline code's link up to this many bytes is one QR code; a longer one animates. */
export const OFFLINE_SINGLE_MAX = 1000;

/**
 * A script for phones with no internet (Trevor, 2026-10-26): its link on /play with the
 * whole script in it (`#e=` or `#s=`, never a code the server holds) and `&o=1`. When the link
 * is too long for one code, `frames` cycle on screen and the app's scanner collects them;
 * `tooLarge` when even that would take too long.
 */
export interface OfflineCode {
	url: string;
	frames?: string[];
	tooLarge?: true;
}

/**
 * The script as it goes into an offline code: characters' flavour text left out, since no one
 * needs it to play and it is a sixth of a homebrew script (Trevor, 2026-10-27: "make this
 * faster"; Fall of Rome's flavour is 3.7 KB of 22 KB).
 */
function offlineScriptJson(json: unknown): unknown {
	if (!Array.isArray(json)) return json;
	return json.map((entry) => {
		if (typeof entry !== 'object' || entry === null || !('flavor' in entry)) return entry;
		const rest: Record<string, unknown> = { ...entry };
		delete rest.flavor;
		return rest;
	});
}

/** The /play hash (with `#`) for an offline code's deflated script. */
export function offlineHash(bytes: Uint8Array): string {
	return `${sharedRefHash({ kind: 'inline', payload: PREFIX + toBase64Url(bytes) })}&o=1`;
}

export async function offlineCode(
	origin: string,
	from: { edition?: string; json: unknown }
): Promise<OfflineCode> {
	if (from.edition) return { url: `${origin}/play#e=${from.edition}&o=1` };
	const bytes = await deflateScript(offlineScriptJson(from.json));
	const url = `${origin}/play${offlineHash(bytes)}`;
	if (new TextEncoder().encode(url).length <= OFFLINE_SINGLE_MAX) return { url };
	// Each frame is a link to Join game, so a phone's own camera app opens this app, which reads
	// the rest (Trevor, 2026-10-27: "tell people to open the grimbinder app").
	const frames = fountainFrames(bytes)?.map((frame) => `${origin}/join#q=${frame}`);
	return frames ? { url, frames } : { url, tooLarge: true };
}

/**
 * An offline code that also names the Storyteller's live room, when there is one: the phone
 * keeps the code and offers to join once it has internet. The room code goes in the hash,
 * before the frame (`/join#r=482913&q=GB2:...`), so the frame itself is unchanged.
 */
export function withOfflineRoom(code: OfflineCode, room: string | undefined): OfflineCode {
	if (!room) return code;
	return {
		...code,
		url: `${code.url}&r=${room}`,
		frames: code.frames?.map((frame) => frame.replace('#q=', `#r=${room}&q=`))
	};
}

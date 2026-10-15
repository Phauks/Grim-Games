/**
 * Share links for scripts: the script's TPI JSON, deflated and base64url-encoded, in the
 * URL hash (`#s=1.<data>`). The hash never reaches the server, so no script lands in a
 * Worker log or a query string (CLAUDE.md). Design: 08-script-loading.md §5.5.
 */

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

/** The `s` value of a location hash such as `#s=1.abc`, if there is one. */
export function sharedPayloadFromHash(hash: string): string | undefined {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	return params.get('s') ?? undefined;
}

/** A full share link to the scripts page on this site. */
export async function shareLink(origin: string, json: unknown): Promise<string> {
	return `${origin}/scripts#s=${await encodeSharedScript(json)}`;
}

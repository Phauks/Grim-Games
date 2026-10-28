/** Hex digests with WebCrypto, which the app, the service worker and the Worker all have. */

/** Bytes as lower-case hex, two digits each. */
export function toHex(bytes: ArrayBuffer | Uint8Array): string {
	return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of text (as UTF-8) or bytes, as hex. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
	// Typed arrays over a SharedArrayBuffer are not BufferSource; none reach here.
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data as BufferSource);
	return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

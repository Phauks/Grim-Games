/**
 * FNV-1a, 32 bits: a short, fast fingerprint for telling texts or byte runs apart (an animated
 * QR code's frames, a custom character the Storyteller checked). Not for security.
 */
export function fnv1a(length: number, at: (i: number) => number): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < length; i++) {
		hash ^= at(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash;
}

/** A text's FNV-1a fingerprint over its UTF-16 code units, as eight hex digits. */
export function textHash(text: string): string {
	return fnv1a(text.length, (i) => text.charCodeAt(i))
		.toString(16)
		.padStart(8, '0');
}

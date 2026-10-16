/** Random tokens, codes and hashes for sign-in, from Web Crypto. */
import { CODE_LENGTH } from '../../src/lib/features/account/account-protocol.ts';

function base64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** An unguessable token: 32 random bytes (256 bits), base64url. */
export function randomToken(bytes = 32): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** A uniformly random code of `CODE_LENGTH` digits (rejection sampling, no modulo bias). */
export function randomCode(): string {
	const limit = 10 ** CODE_LENGTH;
	const ceiling = Math.floor(0x1_0000_0000 / limit) * limit;
	const word = new Uint32Array(1);
	do crypto.getRandomValues(word);
	while (word[0] >= ceiling);
	return String(word[0] % limit).padStart(CODE_LENGTH, '0');
}

/** SHA-256 as hex. Secrets are stored only as hashes, so a storage leak can't sign anyone in. */
export async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two equal-length hex hashes without stopping at the first difference. */
export function sameHash(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

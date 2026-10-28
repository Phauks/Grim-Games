/**
 * Web Push from the Worker (Back to town on locked phones, plan U12), with WebCrypto alone so
 * the Worker needs no library: the message is encrypted for one phone (RFC 8291, `aes128gcm`
 * from RFC 8188) and the request is signed with the app's own keys (VAPID, RFC 8292). The push
 * service only sees that something was sent, never what.
 */

/** A phone's push address as `PushSubscription.toJSON()` gives it. */
export interface PushAddress {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

/** The app's signing keys (VAPID), made once by the Worker and kept (worker/push-keys.ts). */
export interface PushKeys {
	publicKey: JsonWebKey;
	privateKey: JsonWebKey;
}

/** A phone's public key is an uncompressed P-256 point; its secret is 16 bytes (RFC 8291 §3). */
const PUBLIC_KEY_BYTES = 65;
const AUTH_BYTES = 16;
/** One record holds the whole message (RFC 8188 §2): the default record size is plenty. */
const RECORD_SIZE = 4096;

export function toBase64Url(bytes: Uint8Array): string {
	let text = '';
	for (const byte of bytes) text += String.fromCharCode(byte);
	return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Undefined when `text` isn't base64url. */
export function fromBase64Url(text: string): Uint8Array | undefined {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return undefined;
	const padded = text.replaceAll('-', '+').replaceAll('_', '/');
	try {
		return Uint8Array.from(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)), (c) =>
			c.charCodeAt(0)
		);
	} catch {
		return undefined;
	}
}

/**
 * Push services the Worker sends to: Chrome and Edge on Android (Firebase), Firefox, Apple
 * and Windows. A player's phone gives the address, so nothing else is fetched.
 */
const PUSH_HOSTS = [
	/^fcm\.googleapis\.com$/,
	/^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
	/^([a-z0-9-]+\.)*push\.apple\.com$/,
	/^([a-z0-9-]+\.)*notify\.windows\.com$/
];

/** A push address a phone sent, checked; undefined when it isn't one. */
export function parsePushAddress(value: unknown): PushAddress | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const { endpoint, keys } = value as Partial<PushAddress>;
	if (typeof endpoint !== 'string' || endpoint.length > 1024) return undefined;
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return undefined;
	}
	if (url.protocol !== 'https:' || url.port || !PUSH_HOSTS.some((h) => h.test(url.hostname)))
		return undefined;
	if (typeof keys?.p256dh !== 'string' || typeof keys.auth !== 'string') return undefined;
	if (fromBase64Url(keys.p256dh)?.length !== PUBLIC_KEY_BYTES) return undefined;
	if (fromBase64Url(keys.auth)?.length !== AUTH_BYTES) return undefined;
	return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

const text = (s: string) => new TextEncoder().encode(s);

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	const k = await crypto.subtle.importKey(
		'raw',
		key as BufferSource,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource));
}

/** The content key and nonce both ends work out (RFC 8291 §3.4, RFC 8188 §2.2). */
export async function contentKeys(
	ecdhSecret: Uint8Array,
	auth: Uint8Array,
	phonePublic: Uint8Array,
	serverPublic: Uint8Array,
	salt: Uint8Array
): Promise<{ key: Uint8Array; nonce: Uint8Array }> {
	const keyInfo = concat(text('WebPush: info\0'), phonePublic, serverPublic, new Uint8Array([1]));
	const ikm = await hmac(await hmac(auth, ecdhSecret), keyInfo);
	const prk = await hmac(salt, ikm);
	const key = (await hmac(prk, text('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
	const nonce = (await hmac(prk, text('Content-Encoding: nonce\0\x01'))).slice(0, 12);
	return { key, nonce };
}

/** The encrypted body for `to`: a header with the salt and our one-off public key, then one record. */
export async function encryptPush(to: PushAddress, message: string): Promise<Uint8Array> {
	const phonePublic = fromBase64Url(to.keys.p256dh)!;
	const auth = fromBase64Url(to.keys.auth)!;
	const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
	const mine = (await crypto.subtle.generateKey(ecdh, true, ['deriveBits'])) as CryptoKeyPair;
	const theirs = await crypto.subtle.importKey('raw', phonePublic as BufferSource, ecdh, false, []);
	// The Worker's types spell the key `$public`; every runtime, the Worker's too, takes `public`.
	const derive = { name: 'ECDH', public: theirs } as Parameters<SubtleCrypto['deriveBits']>[0];
	const secret = new Uint8Array(await crypto.subtle.deriveBits(derive, mine.privateKey, 256));
	const serverPublic = new Uint8Array(await rawKey(mine.publicKey));
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const { key, nonce } = await contentKeys(secret, auth, phonePublic, serverPublic, salt);
	const aes = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
		'encrypt'
	]);
	// 2 marks the last (here the only) record, with no padding after it.
	const plain = concat(text(message), new Uint8Array([2]));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, plain)
	);
	const size = new Uint8Array(4);
	new DataView(size.buffer).setUint32(0, RECORD_SIZE);
	return concat(salt, size, new Uint8Array([serverPublic.length]), serverPublic, sealed);
}

/** A public key's raw bytes (the Worker's types give `exportKey` one return type for every format). */
async function rawKey(key: CryptoKey): Promise<ArrayBuffer> {
	return (await crypto.subtle.exportKey('raw', key)) as ArrayBuffer;
}

/** A new pair of signing keys (VAPID), for the Worker to keep. */
export async function makePushKeys(): Promise<PushKeys> {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	])) as CryptoKeyPair;
	return {
		publicKey: (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey,
		privateKey: (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
	};
}

/** The public signing key as phones subscribe with it (`applicationServerKey`), base64url. */
export async function publicPushKey(keys: PushKeys): Promise<string> {
	const key = await crypto.subtle.importKey(
		'jwk',
		keys.publicKey,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['verify']
	);
	return toBase64Url(new Uint8Array(await rawKey(key)));
}

/** Push services ask for a contact; Apple refuses a push without one (RFC 8292 §2.1). */
export const PUSH_CONTACT = 'https://grimbinder.com';

/** The `Authorization` header for a push to `endpoint`: a signed token, good for 12 hours. */
export async function vapidAuthorization(
	endpoint: string,
	keys: PushKeys,
	now: number
): Promise<string> {
	const json = (value: object) => toBase64Url(text(JSON.stringify(value)));
	const claims = {
		aud: new URL(endpoint).origin,
		exp: Math.floor(now / 1000) + 12 * 60 * 60,
		sub: PUSH_CONTACT
	};
	const unsigned = `${json({ typ: 'JWT', alg: 'ES256' })}.${json(claims)}`;
	const signer = await crypto.subtle.importKey(
		'jwk',
		keys.privateKey,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);
	// WebCrypto signs as r||s, which is what ES256 wants (RFC 7518 §3.4).
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		signer,
		text(unsigned)
	);
	const token = `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
	return `vapid t=${token}, k=${await publicPushKey(keys)}`;
}

/**
 * The request that pushes `message` to one phone. `ttl`: how long the push service may hold it
 * for a phone that is off or out of signal, in seconds.
 */
export async function pushRequest(
	to: PushAddress,
	message: string,
	keys: PushKeys,
	now: number,
	ttl: number
): Promise<{ url: string; init: RequestInit }> {
	return {
		url: to.endpoint,
		init: {
			method: 'POST',
			headers: {
				Authorization: await vapidAuthorization(to.endpoint, keys, now),
				'Content-Encoding': 'aes128gcm',
				'Content-Type': 'application/octet-stream',
				TTL: String(ttl),
				Urgency: 'high'
			},
			body: (await encryptPush(to, message)) as BufferSource
		}
	};
}

/** The push service says this address is gone (RFC 8030 §7.3): forget it. */
export function pushAddressGone(status: number): boolean {
	return status === 404 || status === 410;
}

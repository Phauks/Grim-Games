import { describe, expect, it } from 'vitest';
import {
	contentKeys,
	encryptPush,
	fromBase64Url,
	makePushKeys,
	parsePushAddress,
	publicPushKey,
	pushAddressGone,
	pushRequest,
	toBase64Url,
	vapidAuthorization,
	type PushAddress
} from './web-push.ts';

const ecdh = { name: 'ECDH', namedCurve: 'P-256' };

/** A phone's push keys, as its browser makes them. */
async function phone(endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
	const pair = (await crypto.subtle.generateKey(ecdh, true, ['deriveBits'])) as CryptoKeyPair;
	const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	const auth = crypto.getRandomValues(new Uint8Array(16));
	const address: PushAddress = {
		endpoint,
		keys: { p256dh: toBase64Url(publicKey), auth: toBase64Url(auth) }
	};
	return { pair, publicKey, auth, address };
}

/** Decrypts as the phone's browser does (RFC 8291 §3.4, RFC 8188 §2). */
async function decrypt(body: Uint8Array, me: Awaited<ReturnType<typeof phone>>) {
	const salt = body.slice(0, 16);
	const idLength = body[20];
	const serverPublic = body.slice(21, 21 + idLength);
	const theirs = await crypto.subtle.importKey('raw', serverPublic, ecdh, false, []);
	const secret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, me.pair.privateKey, 256)
	);
	const { key, nonce } = await contentKeys(secret, me.auth, me.publicKey, serverPublic, salt);
	const aes = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
		'decrypt'
	]);
	const plain = new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: nonce as BufferSource },
			aes,
			body.slice(21 + idLength)
		)
	);
	expect(plain.at(-1)).toBe(2);
	return {
		text: new TextDecoder().decode(plain.slice(0, -1)),
		recordSize: new DataView(body.buffer, body.byteOffset).getUint32(16),
		idLength
	};
}

describe('web push', () => {
	it('derives the content key and nonce of RFC 8291 Appendix A', async () => {
		const b = (s: string) => fromBase64Url(s.replaceAll(' ', ''))!;
		const { key, nonce } = await contentKeys(
			b('kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs'),
			b('BTBZMqHH6r4Tts7J_aSIgg'),
			b('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
			b('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
			b('DGv6ra1nlYgDCS1FRnbzlw')
		);
		expect(toBase64Url(key)).toBe('oIhVW04MRdy2XN9CiKLxTg');
		expect(toBase64Url(nonce)).toBe('4h_95klXJ5E_qnoN');
	});

	it('encrypts a message only the phone can read', async () => {
		const me = await phone();
		const body = await encryptPush(me.address, '{"type":"call-town"}');
		const read = await decrypt(body, me);
		expect(read).toEqual({ text: '{"type":"call-town"}', recordSize: 4096, idLength: 65 });
		// Another phone's keys can't open it.
		await expect(decrypt(body, await phone())).rejects.toThrow();
	});

	it('signs a token the push service can check with the public key', async () => {
		const keys = await makePushKeys();
		const now = Date.UTC(2026, 9, 28, 12);
		const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, now);
		const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
		expect(k).toBe(await publicPushKey(keys));
		expect(fromBase64Url(k)).toHaveLength(65);
		const [head, body, signature] = token.split('.');
		const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
		expect(claims).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: now / 1000 + 12 * 3600,
			sub: 'https://grimbinder.com'
		});
		const verifier = await crypto.subtle.importKey(
			'raw',
			fromBase64Url(k)! as BufferSource,
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify']
		);
		const ok = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			verifier,
			fromBase64Url(signature)! as BufferSource,
			new TextEncoder().encode(`${head}.${body}`)
		);
		expect(ok).toBe(true);
	});

	it('builds the push request', async () => {
		const me = await phone();
		const { url, init } = await pushRequest(me.address, 'hi', await makePushKeys(), 0, 600);
		expect(url).toBe(me.address.endpoint);
		expect(init.method).toBe('POST');
		expect(init.headers).toMatchObject({
			'Content-Encoding': 'aes128gcm',
			TTL: '600',
			Urgency: 'high'
		});
		expect((await decrypt(init.body as Uint8Array, me)).text).toBe('hi');
	});

	it('takes only push services’ addresses with whole keys', async () => {
		const { address } = await phone();
		expect(parsePushAddress(address)).toEqual(address);
		expect(parsePushAddress({ ...address, extra: 1 })).toEqual(address);
		for (const endpoint of [
			'https://web.push.apple.com/abc',
			'https://updates.push.services.mozilla.com/wpush/v2/abc',
			'https://wns2-par02p.notify.windows.com/w/?token=abc'
		])
			expect(parsePushAddress({ ...address, endpoint })).toBeDefined();
		for (const endpoint of [
			'http://fcm.googleapis.com/fcm/send/abc',
			'https://fcm.googleapis.com:8443/abc',
			'https://example.com/push',
			'https://fcm.googleapis.com.example.com/abc',
			'not a url'
		])
			expect(parsePushAddress({ ...address, endpoint })).toBeUndefined();
		expect(parsePushAddress({ ...address, keys: { ...address.keys, auth: 'AAAA' } })).toBe(
			undefined
		);
		expect(parsePushAddress({ ...address, keys: { ...address.keys, p256dh: '!' } })).toBe(
			undefined
		);
		expect(parsePushAddress(null)).toBeUndefined();
	});

	it('forgets an address the push service says is gone', () => {
		expect(pushAddressGone(410)).toBe(true);
		expect(pushAddressGone(404)).toBe(true);
		expect(pushAddressGone(201)).toBe(false);
		expect(pushAddressGone(429)).toBe(false);
	});

	it('round-trips base64url', () => {
		const bytes = Uint8Array.from({ length: 70 }, (_, i) => (i * 37) % 256);
		expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
		expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
	});
});

import { describe, expect, it } from 'vitest';
import {
	decodeSharedScript,
	encodeSharedScript,
	shareLink,
	sharedPayloadFromHash
} from './share.ts';

const script = [
	{ id: '_meta', name: 'Ünïcode & “quotes”', author: 'Trevor' },
	'washerwoman',
	'chef',
	{ id: 'stormwarden', name: 'Storm Warden', team: 'townsfolk', ability: 'Each night…' },
	'imp'
];

describe('share links', () => {
	it('round-trips a script, including non-Latin text', async () => {
		const payload = await encodeSharedScript(script);
		expect(payload).toMatch(/^1\.[\w-]+$/);
		expect(await decodeSharedScript(payload)).toEqual(script);
	});

	it('puts the script in the hash, never the query string', async () => {
		const link = await shareLink('https://grim.example', script);
		const url = new URL(link);
		// Players share scripts with each other, so links open the player view.
		expect(url.pathname).toBe('/play');
		expect(new URL(await shareLink('https://grim.example', script, '/scripts')).pathname).toBe(
			'/scripts'
		);
		expect(url.search).toBe('');
		expect(sharedPayloadFromHash(url.hash)).toBe(await encodeSharedScript(script));
	});

	it('refuses damaged or unknown payloads', async () => {
		await expect(decodeSharedScript('1.!!!!')).rejects.toThrow(/damaged/);
		await expect(decodeSharedScript('1.AAAA')).rejects.toThrow(/damaged/);
		await expect(decodeSharedScript('2.AAAA')).rejects.toThrow(/newer version/);
	});

	it('reads only the s value of a hash', () => {
		expect(sharedPayloadFromHash('#s=1.abc')).toBe('1.abc');
		expect(sharedPayloadFromHash('#other=1')).toBeUndefined();
		expect(sharedPayloadFromHash('')).toBeUndefined();
	});
});

import { describe, expect, it } from 'vitest';
import {
	decodeSharedScript,
	encodeSharedScript,
	shareLink,
	sharedRefFromHash,
	sharedRefHash,
	type SharedRef
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
		expect(sharedRefFromHash(url.hash)).toEqual({
			kind: 'inline',
			payload: await encodeSharedScript(script)
		});
	});

	it('refuses damaged or unknown payloads', async () => {
		await expect(decodeSharedScript('1.!!!!')).rejects.toThrow(/damaged/);
		await expect(decodeSharedScript('1.AAAA')).rejects.toThrow(/damaged/);
		await expect(decodeSharedScript('2.AAAA')).rejects.toThrow(/newer version/);
	});

	it('reads short links: an edition, a BotC Scripts script or a word code', () => {
		const refs: SharedRef[] = [
			{ kind: 'edition', edition: 'tb' },
			{ kind: 'botcscripts', ref: { kind: 'script', scriptId: 1234 } },
			{ kind: 'botcscripts', ref: { kind: 'script', scriptId: 1234, version: '1.0.0' } },
			{ kind: 'code', code: 'poisoned-drunk-imp-bell' },
			{ kind: 'inline', payload: '1.abc' }
		];
		for (const ref of refs) expect(sharedRefFromHash(sharedRefHash(ref))).toEqual(ref);
		expect(sharedRefHash(refs[3])).toBe('#c=poisoned-drunk-imp-bell');
	});

	it('ignores hashes that are not share links, or are malformed', () => {
		for (const hash of ['', '#other=1', '#e=TB!', '#bs=12x', '#c=poisoned-drunk', '#c=a-b-c-d']) {
			expect(sharedRefFromHash(hash)).toBeUndefined();
		}
	});
});

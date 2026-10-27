import { describe, expect, it } from 'vitest';
import {
	decodeSharedScript,
	encodeSharedScript,
	isOfflineHash,
	offlineCode,
	offlineHash,
	offlineRoomFrom,
	withOfflineRoom,
	OFFLINE_SINGLE_MAX,
	shareLink,
	sharedRefFromHash,
	sharedRefHash,
	type SharedRef
} from './share.ts';
import { QrFrameCollector } from '#lib/core/codes/qr-frames.ts';

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

	it('reads short links: an edition, a BotC Scripts script or a share code', () => {
		const refs: SharedRef[] = [
			{ kind: 'edition', edition: 'tb' },
			{ kind: 'botcscripts', ref: { kind: 'script', scriptId: 1234 } },
			{ kind: 'botcscripts', ref: { kind: 'script', scriptId: 1234, version: '1.0.0' } },
			{ kind: 'code', code: '482913' },
			{ kind: 'code', code: 'poisoned-drunk-imp-bell' },
			{ kind: 'inline', payload: '1.abc' }
		];
		for (const ref of refs) expect(sharedRefFromHash(sharedRefHash(ref))).toEqual(ref);
		expect(sharedRefHash(refs[3])).toBe('#c=482913');
	});

	it('ignores hashes that are not share links, or are malformed', () => {
		for (const hash of [
			'',
			'#other=1',
			'#e=TB!',
			'#bs=12x',
			'#c=poisoned-drunk',
			'#c=a-b-c-d',
			'#c=48291',
			'#c=4829130'
		]) {
			expect(sharedRefFromHash(hash)).toBeUndefined();
		}
	});
});

describe('offline codes', () => {
	const origin = 'https://grim.example';

	it('names an edition without the script, marked offline', async () => {
		const code = await offlineCode(origin, { edition: 'tb', json: ['tb'] });
		expect(code).toEqual({ url: `${origin}/play#e=tb&o=1` });
		const hash = new URL(code.url).hash;
		expect(isOfflineHash(hash)).toBe(true);
		expect(sharedRefFromHash(hash)).toEqual({ kind: 'edition', edition: 'tb' });
	});

	it('carries a short script whole in one code, and reads back', async () => {
		const code = await offlineCode(origin, { json: script });
		expect(code.frames).toBeUndefined();
		expect(new TextEncoder().encode(code.url).length).toBeLessThanOrEqual(OFFLINE_SINGLE_MAX);
		const ref = sharedRefFromHash(new URL(code.url).hash);
		expect(ref?.kind).toBe('inline');
		expect(await decodeSharedScript((ref as { payload: string }).payload)).toEqual(script);
	});

	it('animates a long script, and the frames rebuild its link', async () => {
		// Homebrew: characters with their own long text don't compress to one code. The text comes
		// from a fixed seed, so every run makes the same frames (random text changed the frame
		// count, and with it which frames the pattern below misses).
		let seed = 1;
		const word = () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			return seed.toString(36);
		};
		const long = [
			{ id: '_meta', name: 'Long' },
			...Array.from({ length: 40 }, (_, i) => ({
				id: `own${i}`,
				name: `Own ${i}`,
				team: 'townsfolk',
				ability: `${i} ${Array.from({ length: 12 }, word).join(' ')}`
			}))
		];
		const code = await offlineCode(origin, { json: long });
		expect(code.frames!.length).toBeGreaterThan(1);
		// An odd loop, so missing every second frame over two loops still shows each one once.
		expect(code.frames!.length % 2).toBe(1);
		// Each frame opens Join game, so a phone's own camera app opens the app (2026-10-27).
		expect(code.frames!.every((f) => f.startsWith(`${origin}/join#q=GB2:`))).toBe(true);
		// Every second frame missed, from the middle of the loop: the spares fill the gaps.
		const collector = new QrFrameCollector();
		const loop = [...code.frames!.slice(3), ...code.frames!.slice(0, 3)];
		const reads = [...loop, ...loop].filter((_, i) => i % 2 === 0).map((f) => collector.add(f));
		const done = reads.find((r) => r?.kind === 'bytes');
		expect(done?.kind).toBe('bytes');
		const hash = offlineHash((done as { bytes: Uint8Array }).bytes);
		expect(`${origin}/play${hash}`).toBe(code.url);
		expect(isOfflineHash(hash)).toBe(true);
	});

	it('leaves flavour text out of an offline code, and nothing else', async () => {
		const json = [
			{ id: '_meta', name: 'Flavoured' },
			{ id: 'own', name: 'Own', team: 'townsfolk', ability: 'Learn.', flavor: 'Once upon a time.' },
			'chef'
		];
		const code = await offlineCode(origin, { json });
		const ref = sharedRefFromHash(new URL(code.url).hash) as { payload: string };
		expect(await decodeSharedScript(ref.payload)).toEqual([
			json[0],
			{ id: 'own', name: 'Own', team: 'townsfolk', ability: 'Learn.' },
			'chef'
		]);
	});

	it('names the live room, before the frame, so phones can join once online', async () => {
		// Trevor, 2026-10-27: "connecting to a game if they gain a connection".
		const long = [
			{ id: '_meta', name: 'Long' },
			...Array.from({ length: 40 }, (_, i) => ({
				id: `own${i}`,
				name: `Own ${i}`,
				team: 'townsfolk',
				ability: `${i} ${crypto.randomUUID()} ${crypto.randomUUID()}`
			}))
		];
		const code = withOfflineRoom(await offlineCode(origin, { json: long }), '482913');
		expect(offlineRoomFrom(new URL(code.url).hash)).toBe('482913');
		expect(isOfflineHash(new URL(code.url).hash)).toBe(true);
		expect(code.frames!.every((f) => offlineRoomFrom(f) === '482913')).toBe(true);
		// The frames still read as before.
		const collector = new QrFrameCollector();
		const done = [...code.frames!, ...code.frames!]
			.map((f) => collector.add(f))
			.find((r) => r?.kind === 'bytes');
		expect(done?.kind).toBe('bytes');
		// No room: the code is unchanged.
		const plain = await offlineCode(origin, { json: script });
		expect(withOfflineRoom(plain, undefined)).toEqual(plain);
		expect(offlineRoomFrom(new URL(plain.url).hash)).toBeUndefined();
		expect(offlineRoomFrom('#r=12345&o=1')).toBeUndefined();
	});

	it('is not offline without the mark', () => {
		expect(isOfflineHash('#s=1.abc')).toBe(false);
		expect(isOfflineHash('#e=tb&o=1')).toBe(true);
	});
});

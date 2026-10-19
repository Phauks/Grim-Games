/**
 * Game modes: every shipped mode is valid and cites its source, and the character pool
 * follows each mode's rules. Sources per mode are in library/*.ts.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { withRules } from './combine.ts';
import { GAME_MODES, STANDARD, gameModeById } from './registry.ts';
import { INFINITE_POSSIBILITIES } from './rules/index.ts';
import {
	bannedIn,
	choosableCharacters,
	demonBluffs,
	inPlayFor,
	modeCharacters,
	modeScript,
	runsPart
} from './pool.ts';
import { parseGameMode } from './validate.ts';
import { MODE_PARTS } from './types.ts';

const data = committedGameData();
const known = new Set(data.characters.map((c) => c.id));
const tb = data.characters.filter((c) => c.edition === 'tb');
const mode = (id: string) => {
	const m = gameModeById(id);
	if (!m) throw new Error(id);
	return m;
};

describe('shipped modes', () => {
	it.each(GAME_MODES.map((m) => [m.id, m] as const))('%s is valid', (_id, m) => {
		expect(parseGameMode(JSON.parse(JSON.stringify(m)), known)).toEqual({ ok: true, mode: m });
	});

	it('have unique ids and every one links an https source', () => {
		expect(new Set(GAME_MODES.map((m) => m.id)).size).toBe(GAME_MODES.length);
		for (const m of GAME_MODES) expect(m.sources[0].url).toMatch(/^https:\/\//);
	});

	it('Standard changes nothing, so the app runs every part', () => {
		const standard = mode('standard');
		for (const part of MODE_PARTS) expect(runsPart(standard, part)).toBe(true);
	});
});

describe('parseGameMode', () => {
	it('lists every problem with its path', () => {
		const result = parseGameMode(
			{
				format: 1,
				id: 'Bad Id',
				name: '',
				sources: [{ title: 'x', url: 'http://x' }],
				parts: {
					assignment: { kind: 'draft', offers: [0] },
					restricted: { banned: ['nobody'] },
					teleport: {}
				}
			},
			known
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues).toEqual([
			'id: must be lower-case letters, digits and dashes',
			'name: must be a name',
			'sources[0].url: must be an https link',
			'parts.assignment.offers: must be a list of whole numbers of at least 1',
			'parts.restricted.banned[0]: unknown character nobody',
			'parts.teleport: unknown part'
		]);
	});
});

describe('Whale Buffet (https://whalebuffet.com/)', () => {
	const whale = mode('whale-buffet');
	const characters = modeCharacters(whale, tb, data.characters);

	it('plays with every character, without Atheist, Engineer and Pit-Hag', () => {
		const ids = new Set(characters.map((c) => c.id));
		expect(ids.has('imp')).toBe(true);
		expect(ids.has('vortox')).toBe(true);
		for (const id of ['atheist', 'engineer', 'pithag']) expect(ids.has(id)).toBe(false);
		expect(characters.every((c) => c.type !== 'fabled' && c.type !== 'loric')).toBe(true);
	});

	it('keeps Drunk, Lunatic and Marionette in the game but not choosable', () => {
		const choosable = new Set(choosableCharacters(whale, characters).map((c) => c.id));
		for (const id of ['drunk', 'lunatic', 'marionette']) {
			expect(characters.some((c) => c.id === id)).toBe(true);
			expect(choosable.has(id)).toBe(false);
		}
	});

	it('names its script after the mode', () => {
		const script = modeScript(
			whale,
			{ meta: { name: 'Trouble Brewing' }, entries: [] },
			tb,
			data.characters
		);
		expect(script.meta?.name).toBe('Whale Buffet');
		expect(script.entries.length).toBe(characters.length);
	});
});

describe('Sushi Buffet (https://grimbits.com/draft-buffet/)', () => {
	it('drafts from every official character, less restricted ones (Trevor, 2026-10-18)', () => {
		const sushi = mode('sushi-buffet');
		const ids = new Set(
			modeCharacters(sushi, tb, data.characters, { banned: ['vortox'], allowed: [] }).map(
				(c) => c.id
			)
		);
		expect(ids.has('imp')).toBe(true);
		expect(ids.has('nodashii')).toBe(true);
		expect(ids.has('vortox')).toBe(false);
	});
});

describe('Storyteller restrictions', () => {
	it('add bans and lift the mode’s own', () => {
		const whale = mode('whale-buffet');
		const banned = bannedIn(whale, { banned: ['imp'], allowed: ['pithag'] });
		expect([...banned].sort()).toEqual(['atheist', 'engineer', 'imp']);
		const ids = modeCharacters(whale, tb, data.characters, {
			banned: ['imp'],
			allowed: ['pithag']
		}).map((c) => c.id);
		expect(ids).toContain('pithag');
		expect(ids).not.toContain('imp');
	});

	it('apply to an ordinary script in a standard game', () => {
		const ids = modeCharacters(mode('standard'), tb, data.characters, {
			banned: ['baron'],
			allowed: []
		}).map((c) => c.id);
		expect(ids).not.toContain('baron');
		expect(ids).toHaveLength(tb.length - 1);
	});
});

describe('A Script of Infinite Possibilities (https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/)', () => {
	// Trevor, 2026-10-18: "Any script", so the script plays as it is (the extras stay hidden).
	it('plays any script as it is', () => {
		const ids = modeCharacters(
			withRules(STANDARD, [INFINITE_POSSIBILITIES]),
			tb,
			data.characters
		).map((c) => c.id);
		expect(ids).not.toContain('banshee');
		expect(ids).toHaveLength(tb.length);
	});
});

describe('Two Towns and a Boomdandy (https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/)', () => {
	it('plays each town with its own script as it is', () => {
		const two = mode('two-towns-and-a-boomdandy');
		expect(modeCharacters(two, tb, data.characters).map((c) => c.id)).toEqual(tb.map((c) => c.id));
	});
});

describe('Two games at once (Trevor, 2026-10-17)', () => {
	it('plays every player in both towns, never the Demon in both, and the app runs the towns', () => {
		const two = mode('two-games-at-once');
		expect(two.parts.towns).toMatchObject({
			count: 2,
			samePlayers: true,
			notInEveryTown: ['demon']
		});
		expect(runsPart(two, 'towns')).toBe(true);
		expect(runsPart(mode('two-towns-and-a-boomdandy'), 'daySteps')).toBe(false);
	});
});

describe('about', () => {
	it('describes every built-in mode but Standard', () => {
		for (const m of GAME_MODES.filter((m) => m.id !== 'standard'))
			expect(m.about, m.id).toBeTruthy();
	});
});

describe('Demon bluffs (Trevor, 2026-10-18)', () => {
	it('are off in Sushi Buffet and Whale Buffet only', () => {
		const off = GAME_MODES.filter((m) => !demonBluffs(m)).map((m) => m.id);
		expect(off.sort()).toEqual(['sushi-buffet', 'whale-buffet']);
	});
});

describe('authors (Trevor, 2026-10-18: only when properly attributed)', () => {
	it('link every author to an https page that names them', () => {
		for (const m of GAME_MODES)
			for (const a of m.authors ?? []) expect(a.url, m.id).toMatch(/^https:\/\//);
	});

	it('rejects an author without a link', () => {
		const ok = parseGameMode({ ...mode('sushi-buffet') }, known);
		expect(ok.ok).toBe(true);
		const bad = parseGameMode({ ...mode('sushi-buffet'), authors: ['Someone'] }, known);
		expect(bad.ok).toBe(false);
	});
});

describe('Two Towns and a Boomdandy: always in play', () => {
	it('puts the Boomdandy in the Zombuul town and the Mayor in the other', () => {
		// "Boomdandy and Mayor are guaranteed to be in play"; they "start in different towns".
		// https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/
		const two = mode('two-towns-and-a-boomdandy');
		expect(inPlayFor(two, 0)).toEqual(['boomdandy']);
		expect(inPlayFor(two, 1)).toEqual(['mayor']);
		expect(runsPart(two, 'forced')).toBe(true);
		expect(inPlayFor(mode('standard'))).toEqual([]);
	});
});

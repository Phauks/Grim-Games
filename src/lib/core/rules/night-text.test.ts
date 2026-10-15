/**
 * Night text markup from TPI's roles.json, drawn as tokens, and our own fuller text.
 * Characters cited:
 * - https://wiki.bloodontheclocktower.com/Witch (Cursed)
 * - https://wiki.bloodontheclocktower.com/Innkeeper (Safe, Safe, Drunk)
 * - https://wiki.bloodontheclocktower.com/Pukka (Poisoned, then the previous target dies)
 * - https://wiki.bloodontheclocktower.com/Courtier (Drunk 3, No Ability)
 * - https://wiki.bloodontheclocktower.com/Professor (Alive, No Ability)
 * - https://wiki.bloodontheclocktower.com/Investigator (Minion, Wrong)
 * - https://wiki.bloodontheclocktower.com/Exorcist (info token)
 * - https://wiki.bloodontheclocktower.com/Grandmother (Grandchild, Dead)
 * - https://wiki.bloodontheclocktower.com/Fortune_Teller (Red Herring, placed in prep)
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/types.ts';
import { committedCharacter, committedGameData } from '#lib/core/testing/committed-data.ts';
import { characterNames } from './character-names.ts';
import {
	NIGHT_TEXT_OVERRIDES,
	REMINDER_PLACEHOLDERS,
	nightTextFor,
	nightTextPlain,
	nightTextSegments,
	placeholdersFor,
	type PlaceholderKey
} from './night-text.ts';

const data = committedGameData();
const names = characterNames(data.characters);
const name = (id: string) => data.byId.get(id)?.name ?? id;

/** TPI's text for a night, with its mapping and names, as plain text. */
const plain = (id: string, night: 'first' | 'other' = 'other') => {
	const c = committedCharacter(id);
	const text = night === 'first' ? c.firstNightReminder! : c.otherNightReminder!;
	const placeholders = placeholdersFor(id, night);
	return nightTextPlain(
		nightTextSegments(text, c, { names, ...(placeholders ? { placeholders } : {}) }),
		name
	);
};

/** Our full text for a night, as plain text. */
const ours = (id: string, night: 'first' | 'other') => {
	const c = committedCharacter(id);
	const resolved = nightTextFor(c, night, { full: true })!;
	expect(resolved.showingOurs).toBe(true);
	return nightTextPlain(nightTextSegments(resolved.text, c, { names }), name);
};

const placeholderCount = (text: string | undefined) => text?.match(/:reminder:/g)?.length ?? 0;

describe('nightTextSegments', () => {
	it('draws a mapped placeholder as the token it means, placed', () => {
		expect(plain('witch')).toBe('The {Witch} chooses a player. [+Cursed]');
	});

	it('maps each placeholder in turn when there are several', () => {
		expect(plain('innkeeper')).toBe('The {Innkeeper} chooses 2 players. [+Safe] [+Safe] [+Drunk]');
		expect(plain('courtier')).toBe('The {Courtier} might choose a character. [+Drunk 3] [+No Ability]');
		expect(plain('professor')).toBe(
			'The {Professor} might choose a dead player. [+Alive] [+No Ability]'
		);
	});

	it('maps the Pukka’s second placeholder to the death and the Poisoned token coming off', () => {
		expect(plain('pukka')).toBe(
			'The {Pukka} chooses a player. [+Poisoned] The previously poisoned player dies then becomes healthy. [+Dead] [-Poisoned]'
		);
	});

	it('joins alternatives with “or”', () => {
		expect(plain('barista', 'first')).toContain('[+Sober & Healthy] or [+Acts Twice]');
	});

	it('draws *WORD* as the character’s own token, an info token, the death marker or a character', () => {
		expect(plain('investigator', 'first')).toContain(
			'Point to both the [Minion] and [Wrong] players.'
		);
		expect(plain('exorcist')).toContain('Show the «This character selected you» & {Exorcist} tokens.');
		const king = nightTextSegments('Show the *THIS PLAYER IS* & *King* tokens. *DEAD*', {
			reminders: [],
			remindersGlobal: []
		}, { names });
		expect(nightTextPlain(king, name)).toBe('Show the «This player is» & {King} tokens. [Dead]');
	});

	it('leaves an unmapped placeholder generic, listing the options', () => {
		const segments = nightTextSegments('Do it. :reminder:', {
			reminders: ['Grandchild', 'Dead'],
			remindersGlobal: []
		});
		expect(segments).toEqual([
			{ kind: 'text', text: 'Do it. ' },
			{ kind: 'reminder', options: ['Grandchild', 'Dead'] }
		]);
	});

	it('does not guess, even when the character has a single token', () => {
		const witch = committedCharacter('witch');
		expect(nightTextPlain(nightTextSegments(witch.otherNightReminder!, witch))).toBe(
			'The Witch chooses a player. [reminder: Cursed]'
		);
	});

	it('marks tokens placed during prep', () => {
		const ft = committedCharacter('fortuneteller');
		const segments = nightTextSegments(ft.firstNightReminder!, ft, { prepTokens: ['Red Herring'] });
		expect(segments).toContainEqual({
			kind: 'reminder',
			label: 'Red Herring',
			options: ['Red Herring'],
			prep: true
		});
	});

	it('leaves no raw markup in any official night text', () => {
		for (const c of data.characters) {
			for (const night of ['first', 'other'] as const) {
				const text = night === 'first' ? c.firstNightReminder : c.otherNightReminder;
				if (!text) continue;
				const placeholders = placeholdersFor(c.id, night);
				const out = nightTextPlain(
					nightTextSegments(text, c, { names, ...(placeholders ? { placeholders } : {}) })
				);
				expect(out, c.id).not.toMatch(/:reminder:|\*|reminder:/);
			}
		}
	});
});

describe('REMINDER_PLACEHOLDERS', () => {
	it('maps every :reminder: in TPI’s night text, with the same count per text', () => {
		const expected = new Map<string, number>();
		for (const c of data.characters) {
			for (const night of ['first', 'other'] as const) {
				const n = placeholderCount(
					night === 'first' ? c.firstNightReminder : c.otherNightReminder
				);
				if (n > 0) expected.set(`${c.id}:${night}`, n);
			}
		}
		const mapped = new Map(
			Object.entries(REMINDER_PLACEHOLDERS).map(([key, list]) => [key, list.length])
		);
		expect(mapped).toEqual(expected);
		expect([...expected.values()].reduce((a, b) => a + b, 0)).toBe(118);
	});

	it('only names the character’s own reminder tokens', () => {
		for (const [key, list] of Object.entries(REMINDER_PLACEHOLDERS)) {
			const c = committedCharacter(key.split(':')[0]);
			const own = new Set([...c.reminders, ...c.remindersGlobal]);
			for (const p of list) {
				expect(p.tokens.length, key).toBeGreaterThan(0);
				for (const t of p.tokens) expect(own.has(t.label), `${key}: ${t.label}`).toBe(true);
			}
		}
	});
});

describe('NIGHT_TEXT_OVERRIDES', () => {
	const entries = Object.entries(NIGHT_TEXT_OVERRIDES) as [
		PlaceholderKey,
		{ text: string; reason: string }
	][];

	it('replaces text TPI has, never adds a night, and gives a reason', () => {
		for (const [key, o] of entries) {
			const [id, night] = key.split(':') as [string, 'first' | 'other'];
			const c: Character = committedCharacter(id);
			const source = night === 'first' ? c.firstNightReminder : c.otherNightReminder;
			expect(source, key).toBeDefined();
			expect(o.text, key).not.toBe(source);
			expect(o.reason.length, key).toBeGreaterThan(10);
		}
	});

	it('names every token instead of using :reminder:, and only known tokens', () => {
		const info = new Set([
			'you are',
			'this player is',
			'this character selected you',
			'these characters are not in play',
			'this is the demon',
			'these are your minions'
		]);
		for (const [key, o] of entries) {
			const c = committedCharacter(key.split(':')[0]);
			expect(o.text, key).not.toContain(':reminder:');
			const own = new Set([...c.reminders, ...c.remindersGlobal].map((t) => t.toLowerCase()));
			for (const [, word] of o.text.matchAll(/\*([^*]+)\*/g)) {
				const w = word.toLowerCase();
				expect(own.has(w) || info.has(w) || w === 'dead', `${key}: *${word}*`).toBe(true);
			}
		}
	});

	it('covers the steps from Trevor’s review', () => {
		expect(ours('grandmother', 'first')).toBe(
			'Point to the [Grandchild] player & show their character token.'
		);
		expect(ours('grandmother', 'other')).toContain('the {Grandmother} dies too: mark her [Dead].');
		expect(ours('lycanthrope', 'other')).toContain('mark them [Dead]');
		expect(ours('preacher', 'first')).toContain('& {Preacher} token.');
		expect(ours('villageidiot', 'first')).toBe(
			// “Village Idiots” is a plural, not the name as a whole word.
			'If there are multiple Village Idiots, mark one as [Drunk]. Wake the Village Idiots one at a time to choose a player. Give a thumb signal.'
		);
	});

	it('shows TPI’s text when full instructions are off, or when the Storyteller edited it', () => {
		const gm = committedCharacter('grandmother');
		const off = nightTextFor(gm, 'other', { full: false })!;
		expect(off.text).toBe(gm.otherNightReminder);
		expect(off.showingOurs).toBe(false);
		expect(off.ours?.reason).toBeTruthy();
		expect(off.placeholders).toHaveLength(1);
		const edited = nightTextFor(gm, 'other', { full: true, text: 'My own words.' })!;
		expect(edited).toEqual({ text: 'My own words.', source: gm.otherNightReminder, showingOurs: false });
		const homebrew = nightTextFor({ ...gm, edition: undefined }, 'other', { full: true })!;
		expect(homebrew.showingOurs).toBe(false);
	});
});

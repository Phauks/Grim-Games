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
import type { ReminderPlaceholder } from '#lib/core/data/reminder-placeholder-rules.ts';
import { committedCharacter, committedGameData } from '#lib/core/testing/committed-data.ts';
import { characterNames } from './character-names.ts';
import {
	FULL_NIGHT_INSTRUCTIONS,
	SHOW_DIFFERS_FROM_SOURCE,
	nightTextFor,
	nightTextPlain,
	nightTextSegments,
	placeholderProblems,
	placeholdersFor,
	type PlaceholderKey
} from './night-text.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';

const data = committedGameData();
const names = characterNames(data.characters);
const name = (id: string) => data.byId.get(id)?.name ?? id;
/** Our night text for official characters, keyed `<characterId>:<first|other>`, by kind. */
const nightTexts = (kind: 'reviewed' | 'full') =>
	Object.fromEntries(
		[...OFFICIAL_RULES].flatMap(([id, rules]) =>
			(['first', 'other'] as const).flatMap((night) => {
				const o = rules.nightText?.[night]?.[kind];
				return o ? [[`${id}:${night}`, o]] : [];
			})
		)
	);
const REVIEWED_NIGHT_TEXT = nightTexts('reviewed');
const FULL_NIGHT_TEXT = nightTexts('full');

/** Each official `:reminder:` mapping, keyed `<characterId>:<first|other>`. */
const REMINDER_PLACEHOLDERS: Record<string, readonly unknown[]> = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id, rules]) =>
		(['first', 'other'] as const).flatMap((night) => {
			const list = rules.reminderPlaceholders?.[night];
			return list ? [[`${id}:${night}`, list]] : [];
		})
	)
);

/** TPI's text for a night, with its mapping and names, as plain text. */
const plain = (id: string, night: 'first' | 'other' = 'other') => {
	const c = committedCharacter(id);
	const text = night === 'first' ? c.firstNightReminder! : c.otherNightReminder!;
	const placeholders = placeholdersFor(c, night);
	return nightTextPlain(
		nightTextSegments(text, c, { names, ...(placeholders ? { placeholders } : {}) }),
		name
	);
};

/** The text shown for a night (with the parked full text when `full`), as plain text. */
const shown = (id: string, night: 'first' | 'other', full = false) => {
	const c = committedCharacter(id);
	const resolved = nightTextFor(c, night, { full })!;
	expect(resolved.ours, `${id}:${night}`).toBeDefined();
	return nightTextPlain(
		nightTextSegments(resolved.text, c, {
			names,
			...(resolved.placeholders ? { placeholders: resolved.placeholders } : {})
		}),
		name
	);
};

const placeholderCount = (text: string | undefined) => text?.match(/:reminder:/g)?.length ?? 0;

describe('nightTextSegments', () => {
	it('draws a mapped placeholder as the token it means, placed', () => {
		expect(plain('witch')).toBe('The {Witch} chooses a player. [+Cursed]');
	});

	it('maps each placeholder in turn when there are several', () => {
		expect(plain('innkeeper')).toBe('The {Innkeeper} chooses 2 players. [+Safe] [+Safe] [+Drunk]');
		expect(plain('courtier')).toBe(
			'The {Courtier} might choose a character. [+Drunk 3] [+No Ability]'
		);
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
		expect(plain('exorcist')).toContain(
			'Show the «This character selected you» & {Exorcist} tokens.'
		);
		const king = nightTextSegments(
			'Show the *THIS PLAYER IS* & *King* tokens. *DEAD*',
			{
				reminders: [],
				remindersGlobal: []
			},
			{ names }
		);
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
				const placeholders = placeholdersFor(c, night);
				const out = nightTextPlain(
					nightTextSegments(text, c, { names, ...(placeholders ? { placeholders } : {}) })
				);
				expect(out, c.id).not.toMatch(/:reminder:|\*|reminder:/);
			}
		}
	});
});

describe('reminderPlaceholders', () => {
	it('maps every :reminder: in TPI’s night text, with the same count per text', () => {
		const expected = new Map<string, number>();
		for (const c of data.characters) {
			for (const night of ['first', 'other'] as const) {
				const n = placeholderCount(night === 'first' ? c.firstNightReminder : c.otherNightReminder);
				if (n > 0) expected.set(`${c.id}:${night}`, n);
			}
		}
		const mapped = new Map(
			Object.entries(REMINDER_PLACEHOLDERS).map(([key, list]) => [key, list.length])
		);
		expect(mapped).toEqual(expected);
		expect([...expected.values()].reduce((a, b) => a + b, 0)).toBe(118);
	});

	it('passes the coverage check (`npm run check:rules-coverage`)', () => {
		expect(placeholderProblems(data.characters)).toEqual([]);
		const extra = {
			...committedCharacter('witch'),
			otherNightReminder: 'Do it. :reminder: :reminder:'
		};
		expect(placeholderProblems([extra])).toContainEqual(
			"witch:other: 2 :reminder: in TPI's text, 1 in its rules file"
		);
	});

	it('only names the character’s own reminder tokens', () => {
		for (const [key, list] of Object.entries(REMINDER_PLACEHOLDERS)) {
			const c = committedCharacter(key.split(':')[0]);
			const own = new Set([...c.reminders, ...c.remindersGlobal]);
			for (const p of list as ReminderPlaceholder[]) {
				expect(p.tokens.length, key).toBeGreaterThan(0);
				for (const t of p.tokens) expect(own.has(t.label), `${key}: ${t.label}`).toBe(true);
			}
		}
	});
});

const info = new Set([
	'you are',
	'this player is',
	'this character selected you',
	'these characters are not in play',
	'this is the demon',
	'these are your minions'
]);

const overrideEntries = (table: typeof REVIEWED_NIGHT_TEXT) =>
	Object.entries(table) as [PlaceholderKey, { text: string; reason: string }][];

/** Every `*WORD*` is the character's own token, an info token, the death marker or a name. */
function checkMarkup(key: string, text: string) {
	const c = committedCharacter(key.split(':')[0]);
	const own = new Set([...c.reminders, ...c.remindersGlobal].map((t) => t.toLowerCase()));
	for (const [, word] of text.matchAll(/\*([^*]+)\*/g)) {
		const w = word.toLowerCase();
		const known = own.has(w) || info.has(w) || w === 'dead' || names.byName(w) !== undefined;
		expect(known, `${key}: *${word}*`).toBe(true);
	}
}

describe('night text of ours', () => {
	it('replaces text TPI has, never adds a night, and gives a reason', () => {
		for (const [key, o] of [
			...overrideEntries(REVIEWED_NIGHT_TEXT),
			...overrideEntries(FULL_NIGHT_TEXT)
		]) {
			const [id, night] = key.split(':') as [string, 'first' | 'other'];
			const c: Character = committedCharacter(id);
			const source = night === 'first' ? c.firstNightReminder : c.otherNightReminder;
			expect(source, key).toBeDefined();
			expect(o.text, key).not.toBe(source);
			expect(o.reason.length, key).toBeGreaterThan(10);
			checkMarkup(key, o.text);
		}
	});

	it('keeps a reviewed edit’s :reminder:s mappable, and the parked text free of them', () => {
		for (const [key, o] of overrideEntries(REVIEWED_NIGHT_TEXT)) {
			const n = placeholderCount(o.text);
			if (n > 0) expect(REMINDER_PLACEHOLDERS[key]?.length, key).toBe(n);
		}
		for (const [key, o] of overrideEntries(FULL_NIGHT_TEXT))
			expect(o.text, key).not.toContain(':reminder:');
	});

	it('shows Trevor’s reviewed edits', () => {
		expect(shown('grandmother', 'first')).toBe(
			'Point to the [Grandchild] player & show their character token.'
		);
		expect(shown('grandmother', 'other')).toBe(
			'If the grandchild was killed by the Demon, the {Grandmother} dies too. [Dead]'
		);
		expect(shown('lycanthrope', 'other')).toBe('The {Lycanthrope} chooses a player. [Dead]');
		expect(shown('preacher', 'first')).toBe(
			'The {Preacher} chooses a player. [+No Ability] If they chose a Minion: Put the {Preacher} to sleep. Wake the target. Show the «This character selected you» & {Preacher} token.'
		);
		expect(shown('villageidiot', 'first')).toBe(
			// “Village Idiots” is a plural, not the name as a whole word.
			'If there are multiple Village Idiots, mark one as [Drunk]. Wake the Village Idiots one at a time to choose a player. Give a thumb signal.'
		);
	});

	it('keeps the fuller text and the Differs marker parked', () => {
		expect(FULL_NIGHT_INSTRUCTIONS).toBe(false);
		expect(SHOW_DIFFERS_FROM_SOURCE).toBe(false);
		const witch = committedCharacter('witch');
		expect(nightTextFor(witch, 'other')).toEqual({
			text: witch.otherNightReminder,
			source: witch.otherNightReminder,
			placeholders: placeholdersFor(witch, 'other')
		});
		// With the flag on, the parked text would be used.
		expect(shown('witch', 'other', true)).toBe(
			'The {Witch} chooses a player: move [Cursed] to them.'
		);
	});

	it('shows a Storyteller’s edit as it is, and a homebrew character’s own text', () => {
		const gm = committedCharacter('grandmother');
		expect(nightTextFor(gm, 'other', { text: 'My own words.' })).toEqual({
			text: 'My own words.',
			source: gm.otherNightReminder
		});
		const homebrew: Character = { ...gm };
		delete homebrew.edition;
		expect(nightTextFor(homebrew, 'other')?.text).toBe(gm.otherNightReminder);
	});

	// A custom character's own `reminderPlaceholders` map its own text, as the Witch's map
	// TPI's (https://wiki.bloodontheclocktower.com/Witch: the chosen player is Cursed).
	it('maps a homebrew character’s own :reminder: with its own rule', () => {
		const hexer: Character = {
			...committedCharacter('witch'),
			id: 'hexer',
			name: 'Hexer',
			edition: undefined,
			reminders: ['Hexed'],
			otherNightReminder: 'The Hexer chooses a player. :reminder:',
			rules: parseCharacterRules(
				{ reminderPlaceholders: { other: [{ tokens: [{ label: 'Hexed', action: 'place' }] }] } },
				'hexer',
				new Issues(),
				['Hexed']
			)
		};
		const resolved = nightTextFor(hexer, 'other');
		expect(resolved?.placeholders).toEqual([{ tokens: [{ label: 'Hexed', action: 'place' }] }]);
		expect(
			nightTextPlain(
				nightTextSegments(resolved!.text, hexer, { placeholders: resolved!.placeholders }),
				name
			)
		).toBe('The Hexer chooses a player. [+Hexed]');
		// Someone else's text: the mapping does not apply.
		expect(
			nightTextFor(hexer, 'other', { text: 'Mine. :reminder:' })?.placeholders
		).toBeUndefined();
	});

	it('reports a malformed nightText rule', () => {
		const issues = new Issues();
		parseCharacterRules(
			{
				nightText: {
					dusk: {},
					first: { reviewed: { text: 'Wake them.' }, draft: { text: 'x', reason: 'y' } },
					other: { full: { text: 'Do it. :reminder:', reason: 'Names the token.' } }
				}
			},
			'rules',
			issues
		);
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual([
			'rules.nightText.dusk',
			'rules.nightText.first.draft',
			'rules.nightText.first.reviewed.reason',
			'rules.nightText.other.full.text'
		]);
	});

	it('reports a malformed reminderPlaceholders rule', () => {
		const issues = new Issues();
		parseCharacterRules(
			{
				reminderPlaceholders: {
					dusk: [],
					other: [
						{ tokens: [] },
						{ tokens: [{ label: 'Cursed', action: 'move' }] },
						{ tokens: [{ label: 'Nope', action: 'place' }], either: 'yes' }
					]
				}
			},
			'rules',
			issues,
			['Cursed']
		);
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual([
			'rules.reminderPlaceholders.dusk',
			'rules.reminderPlaceholders.other[0].tokens',
			'rules.reminderPlaceholders.other[1].tokens[0].action',
			'rules.reminderPlaceholders.other[2].either',
			'rules.reminderPlaceholders.other[2].tokens[0].label'
		]);
	});
});

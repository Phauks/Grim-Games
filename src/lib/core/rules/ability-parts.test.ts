/**
 * The Character builder's standard ability parts. Setup brackets follow TPI's own ability
 * text and the wiki's Setup page (https://wiki.bloodontheclocktower.com/Setup); the openings
 * are TPI's Sort Order phrases (sort-order.ts).
 */
import { describe, expect, it } from 'vitest';
import type { Character, CharacterName } from '#lib/core/data/types.ts';
import { gameData } from '#lib/core/model/fixtures.test-support.ts';
import {
	openingPhrase,
	readAbility,
	setupPartText,
	withOpening,
	withSetup,
	writeAbility,
	type SetupPart
} from './ability-parts.ts';
import { modifierFromText } from './setup-modifiers.ts';

const King = 'King' as CharacterName;
const king = { id: 'king', name: King };
const findByName = (name: string) => (name.trim().toLowerCase() === 'king' ? king : undefined);

const homebrew = (ability: string, name = 'Scholar'): Character => ({
	id: 'scholar',
	name,
	type: 'townsfolk',
	ability,
	setup: true,
	reminders: [],
	remindersGlobal: [],
	special: []
});

describe('setup parts are written as TPI writes them', () => {
	const cases: [SetupPart, string][] = [
		[{ kind: 'count', type: 'outsider', from: 2 }, '+2 Outsiders'],
		[{ kind: 'count', type: 'outsider', from: 1 }, '+1 Outsider'],
		[{ kind: 'count', type: 'outsider', from: -1 }, '-1 Outsider'],
		[{ kind: 'count', type: 'outsider', from: -1, to: 1, join: 'or' }, '-1 or +1 Outsider'],
		[{ kind: 'count', type: 'outsider', from: 0, to: 1, join: 'or' }, '+0 or +1 Outsider'],
		[{ kind: 'count', type: 'outsider', from: 0, to: -1, join: 'or' }, '-0 or -1 Outsider'],
		[{ kind: 'count', type: 'minion', from: 1 }, '+1 Minion'],
		[{ kind: 'count', type: 'townsfolk', from: 0, to: 2, join: 'to' }, '+0 to +2 Townsfolk'],
		[{ kind: 'any', type: 'outsider' }, '-? to +? Outsiders'],
		[{ kind: 'none', type: 'demon' }, 'No Demon'],
		[{ kind: 'copies', from: 0, to: 2 }, '+0 to +2 Scholars'],
		[{ kind: 'character', id: 'king', name: King }, '+the King'],
		[{ kind: 'text', text: '1 Townsfolk is evil' }, '1 Townsfolk is evil']
	];
	it.each(cases)('%o', (part, text) => expect(setupPartText(part, 'Scholar')).toBe(text));
});

describe('setup reads what the builder writes', () => {
	it('count changes', () => {
		const ability = writeAbility(
			{
				opening: 'You start knowing',
				rest: ' 1 good player.',
				setup: [
					{ kind: 'count', type: 'outsider', from: -1, to: 1, join: 'or' },
					{ kind: 'count', type: 'minion', from: 1 }
				]
			},
			'Scholar'
		);
		expect(ability).toBe('You start knowing 1 good player. [-1 or +1 Outsider. +1 Minion]');
		const modifier = modifierFromText(homebrew(ability));
		expect(modifier?.ops).toEqual([
			{ kind: 'delta', type: 'outsider', values: [-1, 1] },
			{ kind: 'delta', type: 'minion', values: [1] }
		]);
		expect(modifier?.notes).toEqual([]);
	});

	it('a linked character must be in play, as the Choirboy needs the King', () => {
		const ability = withSetup(
			'If the Demon kills the King, you learn which player is the Demon.',
			[{ kind: 'character', id: 'king', name: King }],
			'Scholar'
		);
		const modifier = modifierFromText(homebrew(ability), (name) => findByName(name)?.id);
		expect(modifier?.requires).toBe('king');
	});

	it('copies of this character', () => {
		const ability = withSetup(
			'Each night, choose a player.',
			[{ kind: 'copies', from: 0, to: 2 }],
			'Scholar'
		);
		expect(modifierFromText(homebrew(ability))?.copies).toEqual([0, 1, 2]);
	});
});

describe('reading an ability into parts', () => {
	it('finds the longest opening', () => {
		expect(openingPhrase('Each night*, choose a player: they die.')).toBe('Each night*');
		expect(openingPhrase('Your ability is odd.')).toBe('');
		expect(openingPhrase('Once per game, at night, choose a player.')).toBe(
			'Once per game, at night'
		);
	});

	it('splits the opening, the rest and the setup', () => {
		const parts = readAbility(
			'Each night, choose a player. [+the King. +2 Outsiders]',
			'Scholar',
			findByName
		);
		expect(parts).toEqual({
			opening: 'Each night',
			rest: ', choose a player.',
			setup: [
				{ kind: 'character', id: 'king', name: King },
				{ kind: 'count', type: 'outsider', from: 2 }
			]
		});
	});

	it('changing the opening keeps the rest and the setup', () => {
		expect(withOpening('Each night, choose a player. [+1 Outsider]', 'Each night*', 'S')).toBe(
			'Each night*, choose a player. [+1 Outsider]'
		);
		expect(withOpening('choose a player.', 'Once per game, at night', 'S')).toBe(
			'Once per game, at night choose a player.'
		);
	});

	it('removing every setup part removes the bracket', () => {
		expect(withSetup('Each night, choose a player. [+1 Outsider]', [], 'S')).toBe(
			'Each night, choose a player.'
		);
	});

	// Every official ability with a setup bracket reads back to the same text, so opening a
	// character in the builder never rewrites what it says.
	const official = gameData.characters.filter((c) => c.ability.includes('['));
	const find = (name: string) => {
		const c = gameData.characters.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
		return c && { id: c.id, name: c.name };
	};
	it.each(official.map((c) => [c.id, c] as const))('%s keeps its text', (_, role) => {
		expect(writeAbility(readAbility(role.ability, role.name, find), role.name)).toBe(role.ability);
	});
});

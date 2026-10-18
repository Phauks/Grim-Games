/**
 * The Character builder's standard ability parts. Setup brackets follow TPI's own ability
 * text and the wiki's Setup page (https://wiki.bloodontheclocktower.com/Setup); the openings
 * are TPI's Sort Order phrases (sort-order.ts).
 */
import { describe, expect, it } from 'vitest';
import type { Character, CharacterName } from '#lib/core/data/types.ts';
import { gameData } from '#lib/core/model/fixtures.test-support.ts';
import {
	abilityAction,
	readAction,
	withChoice,
	withResult,
	writeAction,
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

describe('the action after the opening', () => {
	it('reads who is chosen and what happens', () => {
		expect(
			abilityAction('Each night*, choose a player (not yourself): they are poisoned.', 'S')
		).toEqual({ choice: 'choose a player (not yourself)', result: 'they are poisoned', tail: '.' });
		expect(abilityAction('Each night, you learn how many players are evil.', 'S')).toEqual({
			choice: '',
			result: 'you learn',
			tail: ' how many players are evil.'
		});
	});

	it('changes one part and keeps the rest', () => {
		expect(
			withChoice('Each night, choose a player: they are drunk.', 'choose 2 players', 'S')
		).toBe('Each night, choose 2 players: they are drunk.');
		expect(
			withResult('Each night, choose a player: they are drunk.', 'they are poisoned', 'S')
		).toBe('Each night, choose a player: they are poisoned.');
		expect(withChoice('Each night, you learn a number.', 'choose a player', 'S')).toBe(
			'Each night, choose a player: you learn a number.'
		);
		expect(withChoice('Each night, choose a player: they die.', '', 'S')).toBe(
			'Each night, they die.'
		);
		expect(withResult('Each night*, choose a player.', 'they are poisoned', 'S')).toBe(
			'Each night*, choose a player: they are poisoned.'
		);
	});

	it('leaves an ability with none of the parts as it is', () => {
		expect(abilityAction('You start knowing 1 good player.', 'S')).toEqual({
			choice: '',
			result: '',
			tail: ' 1 good player.'
		});
	});

	// Every official ability reads back to the same text through the action parts too.
	it.each(gameData.characters.map((c) => [c.id, c] as const))('%s keeps its text', (_, role) => {
		const parts = readAbility(role.ability, role.name);
		const hasOpening = !!parts.opening;
		const rest = writeAction(readAction(parts.rest, hasOpening), hasOpening);
		expect(writeAbility({ ...parts, rest }, role.name)).toBe(writeAbility(parts, role.name));
	});
});

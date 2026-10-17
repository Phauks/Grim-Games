import { describe, expect, it } from 'vitest';
import { characterLookup, isKnownReminder, isOnScript, scriptCharacterIds } from './characters.ts';
import type { Command } from '#lib/core/engine/commands.ts';
import { newGame, run, testCharacters, testScript, gameData } from './fixtures.test-support.ts';
import {
	aliveNeighbours,
	nearestOfType,
	alignmentOf,
	charactersInPlay,
	getSeat,
	isAliveForWin,
	isTraveller,
	overrideOf,
	registersAsDead,
	replacedBy,
	seatNumber,
	seatsInOrder,
	trueCharacter,
	typeOf
} from './selectors.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

describe('seatNumber', () => {
	it('is the 1-based place in the clockwise seating', () => {
		const { session, seats } = newGame(names);
		expect(seats.map((id) => seatNumber(session.game, id))).toEqual([1, 2, 3, 4, 5]);
		expect(seatNumber(session.game, 'nobody')).toBeUndefined();
	});
});

describe('typeOf and isTraveller', () => {
	it('reads the type from the character data, with no traveller flag', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'beggar', alignment: 'evil' }
		).game;
		expect(typeOf(game, seats[0], testCharacters)).toBe('demon');
		expect(isTraveller(game, seats[0], testCharacters)).toBe(false);
		expect(typeOf(game, seats[1], testCharacters)).toBe('traveller');
		expect(isTraveller(game, seats[1], testCharacters)).toBe(true);
		expect(typeOf(game, seats[2], testCharacters)).toBeUndefined();
		expect(isTraveller(game, 'nobody', testCharacters)).toBe(false);
	});
});

describe('trueCharacter', () => {
	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk is shown a Townsfolk token and
	// the Storyteller marks the truth with the "Is The Drunk" reminder.
	it('follows "Is The Drunk" on a seat showing a Townsfolk', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'washerwoman' },
			{
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		).game;
		expect(getSeat(game, seats[0])?.characterId).toBe('washerwoman');
		expect(trueCharacter(game, seats[0], testCharacters)).toBe('drunk');
		expect(typeOf(game, seats[0], testCharacters)).toBe('outsider');
		expect(alignmentOf(game, seats[0])).toBe('good');
	});

	it('follows "Is The Marionette" and "Is The Philosopher"', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef', alignment: 'evil' },
			{
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'marionette', label: 'Is The Marionette' }
			},
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'empath' },
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'philosopher', label: 'Is The Philosopher' }
			}
		).game;
		expect(trueCharacter(game, seats[0], testCharacters)).toBe('marionette');
		expect(typeOf(game, seats[0], testCharacters)).toBe('minion');
		expect(trueCharacter(game, seats[1], testCharacters)).toBe('philosopher');
	});

	it('ignores reminders that do not replace the character', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'empath' },
			// The Philosopher's "Drunk" reminder marks a drunk player; it is not "Is The …".
			{
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'philosopher', label: 'Drunk' }
			}
		).game;
		expect(trueCharacter(game, seats[0], testCharacters)).toBe('empath');
		expect(replacedBy({ characterId: 'philosopher', label: 'Drunk' }, testCharacters)).toBe(
			undefined
		);
		expect(replacedBy({ characterId: 'homebrew', label: 'Is The X' }, testCharacters)).toBe(
			undefined
		);
	});

	it('lets a Storyteller override win', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'washerwoman' },
			{
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			},
			{
				type: 'SetOverride',
				seatId: seats[0],
				override: { field: 'character', value: 'saint', note: 'house rule' }
			}
		).game;
		expect(trueCharacter(game, seats[0], testCharacters)).toBe('saint');
		expect(overrideOf(getSeat(game, seats[0])!, 'character')?.note).toBe('house rule');
	});

	it('is undefined for an empty or unknown seat', () => {
		const { session, seats } = newGame(names);
		expect(trueCharacter(session.game, seats[0], testCharacters)).toBeUndefined();
		expect(trueCharacter(session.game, 'nobody', testCharacters)).toBeUndefined();
	});
});

describe('registersAsDead and isAliveForWin', () => {
	// https://wiki.bloodontheclocktower.com/Zombuul: the first time the Zombuul dies it
	// lives on but registers as dead, and the game does not end.
	it('treats a Zombuul with its "Dead" reminder as dead for abilities but alive for the win', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[2], characterId: 'zombuul' },
			{ type: 'AddReminder', seatId: seats[2], reminder: { characterId: 'zombuul', label: 'Dead' } }
		).game;
		expect(getSeat(game, seats[2])?.dead).toBe(false);
		expect(registersAsDead(game, seats[2])).toBe(true);
		expect(isAliveForWin(game, seats[2])).toBe(true);
	});

	it('uses the dead flag otherwise', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true }).game;
		expect(registersAsDead(game, seats[0])).toBe(true);
		expect(isAliveForWin(game, seats[0])).toBe(false);
		expect(registersAsDead(game, seats[1])).toBe(false);
		expect(isAliveForWin(game, seats[1])).toBe(true);
		expect(registersAsDead(game, 'nobody')).toBe(false);
		expect(isAliveForWin(game, 'nobody')).toBe(false);
	});

	it('does not treat another character\'s "Dead" reminder as registering dead', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: 'legion', label: 'Dead' }
		}).game;
		expect(registersAsDead(game, seats[0])).toBe(false);
	});

	it('lets a Storyteller override win either way', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'zombuul', label: 'Dead' }
			},
			{
				type: 'SetOverride',
				seatId: seats[0],
				override: { field: 'registersAsDead', value: false }
			},
			{
				type: 'SetOverride',
				seatId: seats[1],
				override: { field: 'registersAsDead', value: true }
			}
		).game;
		expect(registersAsDead(game, seats[0])).toBe(false);
		expect(registersAsDead(game, seats[1])).toBe(true);
		// Overrides change what abilities see, not who is alive for the win.
		expect(isAliveForWin(game, seats[1])).toBe(true);
	});
});

describe('alignmentOf', () => {
	it('is the seat alignment unless overridden', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'recluse' },
			{ type: 'SetOverride', seatId: seats[1], override: { field: 'alignment', value: 'evil' } }
		).game;
		expect(alignmentOf(game, seats[0])).toBe('good');
		expect(alignmentOf(game, seats[1])).toBe('evil');
		expect(alignmentOf(game, seats[2])).toBeUndefined();
		expect(alignmentOf(game, 'nobody')).toBeUndefined();
	});
});

describe('aliveNeighbours', () => {
	// https://wiki.bloodontheclocktower.com/Tea_Lady: neighbours are the nearest alive
	// players, so dead players in between are skipped.
	it('skips a dead player between the Tea Lady and her neighbour', () => {
		const { session, ctx, seats } = newGame(names);
		const [ana, ben, cat, dev, eve] = seats;
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: cat, characterId: 'tealady' },
			{ type: 'SetDead', seatId: dev, dead: true }
		).game;
		expect(aliveNeighbours(game, cat)).toEqual([ben, eve]);
		expect(aliveNeighbours(game, ana)).toEqual([eve, ben]);
	});

	it('wraps around the circle and skips a Zombuul that registers as dead', () => {
		const { session, ctx, seats } = newGame(names);
		const [ana, ben, cat, dev, eve] = seats;
		const game = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: eve, dead: true },
			{ type: 'AddReminder', seatId: ben, reminder: { characterId: 'zombuul', label: 'Dead' } }
		).game;
		expect(aliveNeighbours(game, ana)).toEqual([dev, cat]);
		// A caller can count only the dead flag instead.
		const onlyDeadFlag = (id: string) => game.seats[id].dead;
		expect(aliveNeighbours(game, ana, onlyDeadFlag)).toEqual([dev, ben]);
	});

	it('returns one neighbour when only one other player is alive, none when nobody is', () => {
		const { session, ctx, seats } = newGame(names);
		const [ana, ben, cat, dev, eve] = seats;
		const two = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: ben, dead: true },
			{ type: 'SetDead', seatId: dev, dead: true },
			{ type: 'SetDead', seatId: eve, dead: true }
		);
		expect(aliveNeighbours(two.game, ana)).toEqual([cat]);
		const none = run(two, ctx, { type: 'SetDead', seatId: cat, dead: true });
		expect(aliveNeighbours(none.game, ana)).toEqual([]);
		expect(aliveNeighbours(none.game, 'nobody')).toEqual([]);
	});

	it('follows the seating after a Matron swap', () => {
		const { session, ctx, seats } = newGame(names);
		const [ana, ben, cat, dev, eve] = seats;
		const game = run(session, ctx, { type: 'SwapSeats', seatA: ben, seatB: eve }).game;
		expect(aliveNeighbours(game, ana)).toEqual([ben, eve]);
		expect(aliveNeighbours(game, cat)).toEqual([eve, dev]);
	});
});

describe('Matron swap', () => {
	// https://wiki.bloodontheclocktower.com/Matron: players swap seats; their characters
	// and reminders go with them.
	it('moves players with their characters and reminders, changing only the seating', () => {
		const { session, ctx, seats } = newGame(names);
		const [ana, , cat] = seats;
		const before = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: ana, characterId: 'empath' },
			{
				type: 'AddReminder',
				seatId: ana,
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			},
			{ type: 'AssignCharacter', seatId: cat, characterId: 'monk' }
		);
		const after = run(before, ctx, { type: 'SwapSeats', seatA: ana, seatB: cat });
		expect(seatNumber(after.game, ana)).toBe(3);
		expect(seatNumber(after.game, cat)).toBe(1);
		expect(after.game.seats[ana]).toEqual(before.game.seats[ana]);
		expect(after.game.seats[ana].reminders.map((r) => r.label)).toEqual(['Poisoned']);
		expect(seatsInOrder(after.game).map((s) => s.playerName)).toEqual([
			'Cat',
			'Ben',
			'Ana',
			'Dev',
			'Eve'
		]);
	});
});

describe('character lookup', () => {
	it('lists script characters and lets homebrew replace an official id', () => {
		const custom = {
			id: 'chef',
			name: 'House Chef',
			type: 'townsfolk' as const,
			ability: 'Homebrew.',
			setup: false,
			reminders: ['Tasty'],
			remindersGlobal: [],
			special: []
		};
		const script = {
			entries: [
				{ kind: 'official' as const, id: 'imp' },
				{ kind: 'custom' as const, character: custom }
			]
		};
		const lookup = characterLookup(gameData, script);
		expect(lookup.get('chef')?.name).toBe('House Chef');
		expect(lookup.get('beggar')?.type).toBe('traveller');
		expect(scriptCharacterIds(script)).toEqual(['imp', 'chef']);
		expect(isOnScript(script, 'chef')).toBe(true);
		expect(isOnScript(testScript, 'beggar')).toBe(false);
		expect(isKnownReminder(custom, 'Tasty')).toBe(true);
		expect(isKnownReminder(testCharacters.get('drunk')!, 'Is The Drunk')).toBe(true);
		expect(isKnownReminder(custom, 'Nope')).toBe(false);
	});

	it('lists character tokens in play in seating order', () => {
		const { session, ctx, seats } = newGame(names);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[3], characterId: 'imp' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'chef' }
		).game;
		expect(charactersInPlay(game)).toEqual(['chef', 'imp']);
	});
});

describe('nearestOfType', () => {
	// https://wiki.bloodontheclocktower.com/No_Dashii: the poisoned neighbours are the nearest
	// Townsfolk each way, skipping other types, alive or dead.
	it('skips other types and counts dead Townsfolk', () => {
		const { session, ctx, seats } = newGame(6);
		const [nd, saint, chef, empath, baron, monk] = seats;
		const game = run(
			session,
			ctx,
			...['nodashii', 'saint', 'chef', 'empath', 'baron', 'monk'].map(
				(characterId, i): Command => ({ type: 'AssignCharacter', seatId: seats[i], characterId })
			),
			{ type: 'SetDead', seatId: monk, dead: true }
		).game;
		expect(nearestOfType(game, nd, 'townsfolk', testCharacters)).toEqual({
			anticlockwise: monk,
			clockwise: chef
		});
		expect(nearestOfType(game, chef, 'demon', testCharacters)).toEqual({
			anticlockwise: nd,
			clockwise: nd
		});
		expect(nearestOfType(game, saint, 'minion', testCharacters).clockwise).toBe(baron);
		expect(nearestOfType(game, empath, 'traveller', testCharacters)).toEqual({});
	});
});

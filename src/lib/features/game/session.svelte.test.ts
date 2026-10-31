/**
 * Runs in the Vitest browser project. The open game saves after every command, so a
 * reopened game (a reload, or a PWA update) is exactly where the Storyteller left it.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import { MemoryGameStore, type EngineContext } from '#lib/core/engine/index.ts';
import { endedGames } from '#lib/features/grimoire/device-notes.ts';
import { carryFrom, setNextGame } from './next-game.ts';
import { OpenGame } from './session.svelte.ts';

const chef: Character = {
	id: 'chef',
	name: 'Chef',
	type: 'townsfolk',
	ability: '',
	setup: false,
	reminders: [],
	remindersGlobal: [],
	special: []
};
const data = { characters: [chef] };
const script = { meta: { name: 'Test' }, entries: [{ kind: 'official' as const, id: 'chef' }] };

function context(): EngineContext {
	let id = 0;
	return {
		characters: new Map([['chef', chef]]),
		newId: () => `id-${++id}`,
		now: () => 1_000 + id,
		random: () => 0.5
	};
}

describe('OpenGame', () => {
	it('saves a new game and every command, and reopens it as it was', async () => {
		const store = new MemoryGameStore();
		const game = await OpenGame.create(data, script, 5, store, context());
		const seatId = game.game.seating[0];
		expect(game.run({ type: 'RenameSeat', seatId, playerName: 'Ana' })).toEqual({
			ok: true,
			warnings: []
		});
		expect(game.run({ type: 'AssignCharacter', seatId, characterId: 'chef' }).ok).toBe(true);
		await game.save();

		const reopened = await OpenGame.open(data, game.game.gameId, store, context());
		expect(reopened?.game.seats[seatId]).toMatchObject({ playerName: 'Ana', characterId: 'chef' });
		expect((await store.list()).games).toHaveLength(1);
	});

	it('saves changes made while a save is written together, as one write of the newest', async () => {
		const store = new MemoryGameStore();
		const game = await OpenGame.create(data, script, 5, store, context());
		await game.save();
		const writes: number[] = [];
		const save = store.save.bind(store);
		store.save = async (saved) => {
			writes.push(saved.log.entries.length);
			await new Promise((resolve) => setTimeout(resolve, 20));
			return save(saved);
		};
		const seatId = game.game.seating[0];
		game.run({ type: 'RenameSeat', seatId, playerName: 'Ana' });
		await Promise.resolve();
		// The first write has started; these three wait for it, then go as one.
		game.run({ type: 'RenameSeat', seatId, playerName: 'Ben' });
		game.run({ type: 'RenameSeat', seatId, playerName: 'Cat' });
		game.run({ type: 'AssignCharacter', seatId, characterId: 'chef' });
		await game.save();
		expect(writes).toEqual([2, 5]);
		const reopened = await OpenGame.open(data, game.game.gameId, store, context());
		expect(reopened?.game.seats[seatId]).toMatchObject({ playerName: 'Cat', characterId: 'chef' });
	});

	it('refuses bad commands without changing or saving anything', async () => {
		const store = new MemoryGameStore();
		const game = await OpenGame.create(data, script, 5, store, context());
		const before = game.session;
		const result = game.run({ type: 'RenameSeat', seatId: 'nope', playerName: 'Ana' });
		expect(result.ok).toBe(false);
		expect(game.session).toBe(before);
	});

	it('keeps undo and redo across a reopen', async () => {
		const store = new MemoryGameStore();
		const game = await OpenGame.create(data, script, 5, store, context());
		const seatId = game.game.seating[0];
		game.run({ type: 'SetDead', seatId, dead: true });
		game.undo();
		await game.save();
		const reopened = (await OpenGame.open(data, game.game.gameId, store, context()))!;
		expect(reopened.game.seats[seatId].dead).toBe(false);
		expect(reopened.canRedo).toBe(true);
		reopened.redo();
		expect(reopened.game.seats[seatId].dead).toBe(true);
	});

	it('is undefined for a game that is not saved', async () => {
		expect(await OpenGame.open(data, 'missing', new MemoryGameStore())).toBeUndefined();
	});

	it('opens an ended game to look around in: History steps never change the saved game', async () => {
		const store = new MemoryGameStore();
		const game = await OpenGame.create(data, script, 5, store, context());
		const seatId = game.game.seating[0];
		game.run({ type: 'SetDead', seatId, dead: true });
		await game.save();
		endedGames.end(game.game.gameId);
		try {
			const ended = (await OpenGame.open(data, game.game.gameId, store, context()))!;
			expect(ended.viewOnly).toBe(true);
			expect(ended.run({ type: 'SetDead', seatId, dead: false }).ok).toBe(false);
			ended.goTo(1);
			expect(ended.game.seats[seatId].dead).toBe(false);
			await ended.save();
			const again = (await OpenGame.open(data, game.game.gameId, store, context()))!;
			expect(again.game.seats[seatId].dead).toBe(true);
			// Reopening returns to where the game was saved.
			ended.setViewOnly(false);
			expect(ended.game.seats[seatId].dead).toBe(true);
		} finally {
			endedGames.reopen(game.game.gameId);
		}
	});

	it('a new game from an ended one keeps when that game ended and who won', async () => {
		const store = new MemoryGameStore();
		const old = await OpenGame.create(data, script, 5, store, context());
		await old.save();
		endedGames.end(old.game.gameId, 'good');
		const before = endedGames.read()[old.game.gameId];
		try {
			setNextGame(carryFrom(old.game, false));
			let id = 0;
			const fresh = { ...context(), newId: () => `next-${++id}` };
			const next = await OpenGame.create(data, script, 5, store, fresh);
			expect(next.game.gameId).not.toBe(old.game.gameId);
			expect(endedGames.read()[old.game.gameId]).toEqual(before);
		} finally {
			endedGames.reopen(old.game.gameId);
		}
	});
});

/**
 * Runs in the Vitest browser project (Chromium), against real IndexedDB. The file name
 * ends in `.svelte.test.ts` only because that is what the browser project picks up.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	SAVED_GAME_VERSION,
	SavedGameError,
	createGame,
	dispatch,
	openSession,
	toSavedGame,
	type EngineContext,
	type GameSession
} from '#lib/core/engine/index.ts';
import { IdbGameStore } from './idb-store.ts';

let id = 0;
const ctx: EngineContext = {
	characters: new Map(),
	newId: () => `id-${++id}`,
	now: () => 1_000_000 + id,
	random: () => 0.5
};

function session(players: number): GameSession {
	const created = createGame(
		{
			type: 'CreateGame',
			script: { meta: { name: 'Browser' }, entries: [] },
			playerCount: players
		},
		ctx
	);
	if (!created.ok) throw new Error(created.error.message);
	const renamed = dispatch(
		created.session,
		{ type: 'RenameSeat', seatId: created.session.game.seating[0], playerName: 'Ana' },
		ctx
	);
	if (!renamed.ok) throw new Error(renamed.error.message);
	return renamed.session;
}

const stores: IdbGameStore[] = [];
function freshStore(): IdbGameStore {
	const store = new IdbGameStore(`grim-games-test-${crypto.randomUUID()}`);
	stores.push(store);
	return store;
}

afterEach(async () => {
	for (const store of stores.splice(0)) await store.close();
});

describe('IdbGameStore', () => {
	it('saves and loads a game that replays to the same state', async () => {
		const store = freshStore();
		const s = session(5);
		await store.save(toSavedGame(s, 100));
		const loaded = await store.load(s.game.gameId);
		expect(loaded?.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(openSession(loaded!.log).game).toEqual(s.game);
		expect(await store.load('missing')).toBeUndefined();
	});

	it('lists games newest first, replaces on save and deletes', async () => {
		const store = freshStore();
		const a = session(5);
		const b = session(7);
		await store.save(toSavedGame(a, 100));
		await store.save(toSavedGame(b, 200));
		await store.save(toSavedGame(a, 300));
		const { games, unreadable } = await store.list();
		expect(games.map((g) => [g.gameId, g.savedAt, g.seatCount, g.scriptName])).toEqual([
			[a.game.gameId, 300, 5, 'Browser'],
			[b.game.gameId, 200, 7, 'Browser']
		]);
		expect(unreadable).toEqual([]);
		await store.delete(a.game.gameId);
		expect((await store.list()).games.map((g) => g.gameId)).toEqual([b.game.gameId]);
	});

	it('keeps games across connections', async () => {
		const name = `grim-games-test-${crypto.randomUUID()}`;
		const first = new IdbGameStore(name);
		const s = session(5);
		await first.save(toSavedGame(s, 100));
		await first.close();
		const second = new IdbGameStore(name);
		stores.push(second);
		expect((await second.load(s.game.gameId))?.gameId).toBe(s.game.gameId);
	});

	it('reports games saved by a newer build as unreadable instead of opening them', async () => {
		const store = freshStore();
		await store.putRaw({ gameId: 'future', schemaVersion: SAVED_GAME_VERSION + 1 });
		expect(await store.list()).toEqual({
			games: [],
			unreadable: [{ gameId: 'future', problem: 'too-new' }]
		});
		await expect(store.load('future')).rejects.toBeInstanceOf(SavedGameError);
	});
});

import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { openSession } from './log.ts';
import {
	MIGRATIONS,
	MemoryGameStore,
	SAVED_GAME_VERSION,
	SavedGameError,
	listSavedGames,
	migrateSavedGame,
	runMigrations,
	summariseSavedGame,
	toSavedGame,
	type Migration,
	type SavedDocument
} from './persistence.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

function savedGame(savedAt = 5000) {
	const { session, ctx, seats } = newGame(names);
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
		{ type: 'AddSeat', playerName: 'Fay' },
		{ type: 'AddSeat', playerName: 'Gus' },
		{ type: 'RemoveSeat', seatId: seats[4] }
	);
	return { session: s, saved: toSavedGame(s, savedAt) };
}

function problem(fn: () => unknown): string {
	try {
		fn();
	} catch (e) {
		if (e instanceof SavedGameError) return e.problem;
		throw e;
	}
	return 'none';
}

describe('saved games', () => {
	it('round-trips a session through a saved game', () => {
		const { session, saved } = savedGame();
		expect(saved.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(saved.gameId).toBe(session.game.gameId);
		const loaded = migrateSavedGame(JSON.parse(JSON.stringify(saved)));
		expect(openSession(loaded.log).game).toEqual(session.game);
	});

	it('copies the log so later changes do not alter the save', () => {
		const { session, saved } = savedGame();
		expect(saved.log).not.toBe(session.log);
		expect(saved.log).toEqual(session.log);
	});

	it('summarises a save without replaying it', () => {
		const { session, saved } = savedGame();
		expect(summariseSavedGame(saved)).toEqual({
			gameId: session.game.gameId,
			savedAt: 5000,
			createdAt: session.game.createdAt,
			scriptName: 'Test Brewing',
			seatCount: 6
		});
	});

	it('counts seats at the cursor, so an undone seat is not counted', () => {
		const { saved } = savedGame();
		const undone = { ...saved, log: { ...saved.log, cursor: saved.log.cursor - 1 } };
		expect(summariseSavedGame(undone).seatCount).toBe(7);
	});

	it('rejects documents that are not saved games', () => {
		const { saved } = savedGame();
		for (const raw of [
			null,
			[],
			'x',
			{},
			{ schemaVersion: 0 },
			{ schemaVersion: 1.5 },
			{ ...saved, gameId: 3 },
			{ ...saved, log: { entries: [], cursor: 0 } },
			{ ...saved, log: { ...saved.log, cursor: 99 } },
			{ ...saved, log: { ...saved.log, entries: [1] } }
		]) {
			expect(problem(() => migrateSavedGame(raw))).toBe('invalid');
		}
	});

	it('refuses a game saved by a newer build instead of guessing', () => {
		const { saved } = savedGame();
		expect(
			problem(() => migrateSavedGame({ ...saved, schemaVersion: SAVED_GAME_VERSION + 1 }))
		).toBe('too-new');
	});

	it('has a migration for every version below the current one', () => {
		const expected = Array.from({ length: SAVED_GAME_VERSION - 1 }, (_, i) => String(i + 1));
		expect(Object.keys(MIGRATIONS)).toEqual(expected);
	});
});

describe('migration chain', () => {
	// A made-up history: v1 stored `name`, v2 renamed it to `title`, v3 added `tags`.
	const chain: Record<number, Migration> = {
		1: ({ name, ...rest }) => ({ ...rest, title: name, schemaVersion: 2 }),
		2: (doc) => ({ ...doc, tags: [], schemaVersion: 3 })
	};

	it('runs each step in order up to the target', () => {
		const v1: SavedDocument = { schemaVersion: 1, name: 'Old game' };
		expect(runMigrations(v1, chain, 3)).toEqual({ schemaVersion: 3, title: 'Old game', tags: [] });
		expect(runMigrations({ schemaVersion: 2, title: 'T' }, chain, 3)).toEqual({
			schemaVersion: 3,
			title: 'T',
			tags: []
		});
		expect(v1).toEqual({ schemaVersion: 1, name: 'Old game' });
	});

	it('leaves a current document alone', () => {
		const doc: SavedDocument = { schemaVersion: 3, title: 'T', tags: [] };
		expect(runMigrations(doc, chain, 3)).toBe(doc);
	});

	it('fails on a gap in the chain or a step that skips a version', () => {
		expect(problem(() => runMigrations({ schemaVersion: 1 }, { 2: chain[2] }, 3))).toBe(
			'missing-migration'
		);
		const skipping: Record<number, Migration> = { 1: (doc) => ({ ...doc, schemaVersion: 3 }) };
		expect(() => runMigrations({ schemaVersion: 1 }, skipping, 3)).toThrow(/produced format 3/);
	});

	it('runs through migrateSavedGame into a current saved game', () => {
		const { saved } = savedGame();
		// Pretend the current saved game is version 2 and version 1 called the log `events`.
		const { log, ...rest } = saved;
		const v1 = { ...rest, schemaVersion: 1, events: log };
		const toV2: Migration = ({ events, ...doc }) => ({ ...doc, log: events, schemaVersion: 2 });
		const loaded = migrateSavedGame(v1, { 1: toV2 }, 2);
		expect(loaded.log).toEqual(log);
		expect(loaded.schemaVersion).toBe(2);
	});
});

describe('MemoryGameStore and listing', () => {
	it('saves, loads, lists newest first and deletes', async () => {
		const store = new MemoryGameStore();
		const a = savedGame(1000).saved;
		const b = { ...savedGame(2000).saved, gameId: 'other' };
		await store.save(a);
		await store.save(b);
		expect(await store.load(a.gameId)).toEqual(a);
		expect(await store.load('missing')).toBeUndefined();
		const { games, unreadable } = await store.list();
		expect(games.map((g) => g.gameId)).toEqual(['other', a.gameId]);
		expect(unreadable).toEqual([]);
		await store.delete('other');
		expect((await store.list()).games.map((g) => g.gameId)).toEqual([a.gameId]);
	});

	it('lists unreadable games separately so they can be deleted', async () => {
		const store = new MemoryGameStore();
		store.putRaw('future', { schemaVersion: 99, gameId: 'future' });
		store.putRaw('broken', { schemaVersion: 1, gameId: 'broken' });
		store.putRaw('junk', 'junk');
		expect(await store.list()).toEqual({
			games: [],
			unreadable: [
				{ gameId: 'future', problem: 'too-new' },
				{ gameId: 'broken', problem: 'invalid' }
			]
		});
		await expect(store.load('future')).rejects.toBeInstanceOf(SavedGameError);
	});

	it('rethrows unexpected errors', () => {
		const exploding = {
			get schemaVersion(): number {
				throw new TypeError('boom');
			}
		};
		expect(() => listSavedGames([exploding])).toThrow(TypeError);
	});
});

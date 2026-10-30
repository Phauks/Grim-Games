import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newGame, run, testContext } from '#lib/core/model/fixtures.test-support.ts';
import { GENERIC_REMINDER_ID } from '#lib/core/model/index.ts';
import { dispatch, openSession, redo, undo } from './log.ts';
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
			seatCount: 6,
			days: 0
		});
	});

	it("reads the script's logo for the list: an edition's own, else the author's link", () => {
		const { saved } = savedGame();
		const withMeta = (meta: { name: string; logo?: string }) => {
			const copy = structuredClone(saved);
			const created = copy.log.entries[0].events.find((e) => e.type === 'GameCreated');
			if (created?.type !== 'GameCreated') throw new Error('no GameCreated');
			created.script = { ...created.script, meta: { ...created.script.meta, ...meta } };
			return summariseSavedGame(copy).scriptLogo;
		};
		expect(withMeta({ name: 'Trouble Brewing' })).toBe('/data/logos/tb.webp');
		expect(withMeta({ name: 'Storm', logo: 'https://logo.example/storm.png' })).toBe(
			'https://logo.example/storm.png'
		);
		expect(withMeta({ name: 'Storm', logo: 'http://logo.example/storm.png' })).toBeUndefined();
		expect(summariseSavedGame(saved).scriptLogo).toBeUndefined();
	});

	it('counts the days begun, as game.pastDays does', () => {
		const { session, ctx } = newGame(names);
		expect(summariseSavedGame(toSavedGame(session, 1)).days).toBe(0);
		const later = run(session, ctx, { type: 'NewDay' }, { type: 'NewDay' });
		expect(summariseSavedGame(toSavedGame(later, 1)).days).toBe(later.game.pastDays.length);
		expect(summariseSavedGame(toSavedGame(later, 1)).days).toBe(2);
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

describe('version 1 saves', () => {
	/** A game saved before causes of death and night or day overrides existed. */
	const readV1 = (): unknown =>
		JSON.parse(readFileSync(new URL('./fixtures/saved-game-v1.json', import.meta.url), 'utf8'));

	it('migrates to the current version with no causes and no overrides', () => {
		const raw = readV1();
		const loaded = migrateSavedGame(raw);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual((raw as { log: unknown }).log);
		const { game } = openSession(loaded.log);
		expect(game.seats.b).toEqual({
			seatId: 'b',
			dead: true,
			ghostVoteUsed: false,
			overrides: [],
			reminders: []
		});
		expect(game.nightOrderOverrides).toEqual([]);
		expect(game.dayReminderOverrides).toEqual([]);
		expect(raw).toEqual(readV1());
	});

	it('keeps the redo stack, and the migrated game takes new commands', () => {
		const loaded = migrateSavedGame(readV1());
		const session = redo(openSession(loaded.log));
		expect(session.game.seats.c.dead).toBe(true);
		const caused = dispatch(
			session,
			{ type: 'SetDeathCause', seatId: 'b', cause: 'execution' },
			testContext()
		);
		if (!caused.ok) throw new Error(caused.error.message);
		expect(caused.session.game.seats.b.deathCause).toBe('execution');
		expect(undo(caused.session).game.seats.b.deathCause).toBeUndefined();
	});
});

describe('version 2 saves', () => {
	/** A game saved before the day log existed. */
	const readV2 = (): unknown =>
		JSON.parse(readFileSync(new URL('./fixtures/saved-game-v2.json', import.meta.url), 'utf8'));

	it('migrates to the current version with an empty day log and no past days', () => {
		const raw = readV2();
		const loaded = migrateSavedGame(raw);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual((raw as { log: unknown }).log);
		const { game } = openSession(loaded.log);
		expect(game.today).toEqual({ entries: [] });
		expect(game.pastDays).toEqual([]);
		expect(game.seats.b).toMatchObject({ dead: true, deathCause: 'execution' });
		expect(game.dayReminderOverrides).toHaveLength(1);
		expect(raw).toEqual(readV2());
	});

	it('takes day-log commands after migrating', () => {
		const session = openSession(migrateSavedGame(readV2()).log);
		const ctx = testContext();
		const nominated = dispatch(session, { type: 'Nominate', nominator: 'a', nominee: 'c' }, ctx);
		if (!nominated.ok) throw new Error(nominated.error.message);
		expect(nominated.session.game.today.entries).toHaveLength(1);
		const saved = migrateSavedGame(JSON.parse(JSON.stringify(toSavedGame(nominated.session, 1))));
		expect(openSession(saved.log).game.today).toEqual(nominated.session.game.today);
	});
});

describe('version 4 saves', () => {
	/** A game saved before the script could be changed mid-game. */
	const readV4 = (): unknown =>
		JSON.parse(readFileSync(new URL('./fixtures/saved-game-v4.json', import.meta.url), 'utf8'));

	it('migrates to the current version with the log unchanged', () => {
		const raw = readV4();
		const loaded = migrateSavedGame(raw);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual((raw as { log: unknown }).log);
		const { game } = openSession(loaded.log);
		expect(game.script.meta?.name).toBe('Older Brewing');
		expect(game.prepValues).toEqual({ 'yaggababble.phrase': 'hello' });
		expect(raw).toEqual(readV4());
	});

	it('takes ChangeScript after migrating, and the summary names the new script', () => {
		const session = openSession(migrateSavedGame(readV4()).log);
		const script = { meta: { name: 'Newer Brewing' }, entries: [] };
		const changed = dispatch(session, { type: 'ChangeScript', script }, testContext());
		if (!changed.ok) throw new Error(changed.error.message);
		expect(changed.warnings.map((w) => w.message)).toEqual(['Imp is not on the script']);
		const saved = migrateSavedGame(JSON.parse(JSON.stringify(toSavedGame(changed.session, 1))));
		expect(openSession(saved.log).game.script).toEqual(script);
		expect(summariseSavedGame(saved).scriptName).toBe('Newer Brewing');
		const undone = { ...saved, log: { ...saved.log, cursor: saved.log.cursor - 1 } };
		expect(summariseSavedGame(undone).scriptName).toBe('Older Brewing');
	});
});

describe('version 8 saves', () => {
	// Before reminders took text: the log loads unchanged, and a note set afterwards is saved.
	it('migrate with the log unchanged and then keep a reminder note', () => {
		const { session, ctx, seats } = newGame(['Sam', 'Ana', 'Kim', 'Lee', 'Max']);
		const placed = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' }
		});
		const v8 = { ...JSON.parse(JSON.stringify(toSavedGame(placed, 1))), schemaVersion: 8 };
		const loaded = migrateSavedGame(v8);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual(v8.log);
		const opened = openSession(loaded.log);
		const reminder = opened.game.seats[seats[0]].reminders[0];
		expect(reminder).not.toHaveProperty('note');
		const noted = run(opened, ctx, {
			type: 'SetReminderNote',
			reminderId: reminder.reminderId,
			note: 'Chose Sam'
		});
		const again = migrateSavedGame(JSON.parse(JSON.stringify(toSavedGame(noted, 2))));
		expect(openSession(again.log).game.seats[seats[0]].reminders[0].note).toBe('Chose Sam');
	});
});

describe('version 10 saves', () => {
	// Before the Storyteller's name: the log loads unchanged, and a name set afterwards is saved.
	it('migrate with the log unchanged and then keep a Storyteller name', () => {
		const { session, ctx } = newGame(['Sam', 'Ana', 'Kim', 'Lee', 'Max']);
		const v10 = { ...JSON.parse(JSON.stringify(toSavedGame(session, 1))), schemaVersion: 10 };
		const loaded = migrateSavedGame(v10);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual(v10.log);
		const opened = openSession(loaded.log);
		expect(opened.game).not.toHaveProperty('storytellerName');
		const named = run(opened, ctx, { type: 'SetStorytellerName', name: 'Trev' });
		const again = openSession(migrateSavedGame(toSavedGame(named, 2)).log);
		expect(again.game.storytellerName).toBe('Trev');
	});
});

describe('version 18 saves', () => {
	// Before several notes per seat (Trevor, 2026-10-26): an older seat's single note
	// (`SeatNoteSet`) opens as its untitled first note, and more can be added.
	it('migrates a version 20 game with no held abilities, then takes one', () => {
		const { session, ctx, seats } = newGame(['Sam', 'Ana', 'Kim', 'Lee', 'Max']);
		const v20 = { ...JSON.parse(JSON.stringify(toSavedGame(session, 1))), schemaVersion: 20 };
		const loaded = migrateSavedGame(v20);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual(v20.log);
		const opened = openSession(loaded.log);
		expect(opened.game.seats[seats[0]].abilities).toBeUndefined();
		const held = run(opened, ctx, {
			type: 'SetHeldAbility',
			seatId: seats[0],
			via: 'boffin',
			characterId: 'chef'
		});
		const again = openSession(migrateSavedGame(toSavedGame(held, 2)).log);
		expect(again.game.seats[seats[0]].abilities).toEqual([{ characterId: 'chef', via: 'boffin' }]);
	});

	it("migrate with the log unchanged and keep a seat's note as its first", () => {
		const { session, ctx, seats } = newGame(['Sam', 'Ana', 'Kim', 'Lee', 'Max']);
		const saved = JSON.parse(JSON.stringify(toSavedGame(session, 1)));
		saved.log.entries.push({
			at: 2,
			command: 'SetSeatNote',
			events: [{ type: 'SeatNoteSet', seatId: seats[1], note: 'Secret word: lantern' }]
		});
		saved.log.cursor += 1;
		const v18 = { ...saved, schemaVersion: 18 };
		const loaded = migrateSavedGame(v18);
		expect(loaded.schemaVersion).toBe(SAVED_GAME_VERSION);
		expect(loaded.log).toEqual(v18.log);
		const opened = openSession(loaded.log);
		expect(opened.game.seats[seats[1]].notes).toEqual([
			{ noteId: 'n1', title: '', text: 'Secret word: lantern', hidden: false }
		]);
		const more = run(opened, ctx, {
			type: 'SetSeatNote',
			seatId: seats[1],
			title: 'Claim',
			text: 'Chef: 1',
			hidden: false
		});
		const again = openSession(migrateSavedGame(toSavedGame(more, 3)).log);
		expect(again.game.seats[seats[1]].notes?.map((n) => n.noteId)).toEqual(['n1', 'n2']);
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

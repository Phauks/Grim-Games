/**
 * Saved games and the storage port.
 *
 * The app is an offline-first PWA: a newer build can open a game saved by an older one
 * (CLAUDE.md). Every saved game carries `schemaVersion`; loading runs it through the
 * migration chain up to the current version. A game saved by a *newer* build is refused
 * rather than guessed at.
 *
 * To change the saved shape (including any event shape in `events.ts`): bump
 * `SAVED_GAME_VERSION`, add a migration from the previous version to `MIGRATIONS`, and
 * add a fixture of the old shape to `persistence.test.ts`.
 */
import { APP_NAME } from '#lib/core/app-name.ts';
import { scriptLogo } from '#lib/core/data/script-logo.ts';
import { scriptEdition } from '#lib/core/data/script.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { GameLog, GameSession } from './log.ts';

export const SAVED_GAME_VERSION = 19;

export interface SavedGame {
	schemaVersion: typeof SAVED_GAME_VERSION;
	gameId: GameId;
	/** Milliseconds since the epoch. */
	savedAt: number;
	log: GameLog;
}

/** What a saved-games list shows, without opening the game. */
export interface SavedGameSummary {
	gameId: GameId;
	savedAt: number;
	createdAt: number;
	scriptName?: string;
	/** The script's logo (`scriptLogo`), for the list (Trevor, 2026-10-18); read from the save, not stored. */
	scriptLogo?: string;
	seatCount: number;
	/**
	 * How many days have begun (each New day adds one), as `game.pastDays.length`: the saved
	 * games list's phase (gamePhase) with what the device knows of the night.
	 */
	days: number;
}

/** A saved game that could not be read, so a list can still offer to delete it. */
export interface UnreadableGame {
	gameId: GameId;
	problem: SavedGameProblem;
}

/** Where saved games live. The IndexedDB adapter is `#lib/features/game/idb-store.ts`. */
export interface GameStore {
	/** Saves (or replaces) the game with `saved.gameId`. */
	save(saved: SavedGame): Promise<void>;
	/** Loads and migrates a game. Undefined when there is none; throws `SavedGameError` when it cannot be read. */
	load(gameId: GameId): Promise<SavedGame | undefined>;
	/** All saved games, most recently saved first. */
	list(): Promise<{ games: SavedGameSummary[]; unreadable: UnreadableGame[] }>;
	delete(gameId: GameId): Promise<void>;
}

export type SavedGameProblem = 'invalid' | 'too-new' | 'missing-migration';

export class SavedGameError extends Error {
	constructor(
		readonly problem: SavedGameProblem,
		message: string
	) {
		super(message);
		this.name = 'SavedGameError';
	}
}

/** A stored document of any version. */
export type SavedDocument = { schemaVersion: number } & Record<string, unknown>;

/** Turns a document of version `n` into version `n + 1`. Must not mutate its input. */
export type Migration = (doc: SavedDocument) => SavedDocument;

/**
 * Version 2 (2026-10-15) added causes of death (`DeathSet.cause`, `DeathCauseSet`) and the
 * Storyteller's night-order and day-reminder overrides (`NightStepOverride*` and
 * `DayReminderOverride*` events, `Game.nightOrderOverrides` and `Game.dayReminderOverrides`).
 * Saved games hold the event log, not the game, so the new fields are defaulted on replay:
 * a version 1 death has no recorded cause, and `GameCreated` starts both override lists
 * empty. The log itself needs no change. The version bump makes older builds refuse a
 * version 2 save as too new instead of meeting events they cannot apply.
 */
const migrateV1toV2: Migration = (doc) => ({ ...doc, schemaVersion: 2 });

/**
 * Version 3 (2026-10-15) added the day log: `Game.today` and `Game.pastDays`, and the
 * `DayEntryAdded`, `DayEntryReplaced`, `DayEntryRemoved`, `DemonVotedSet` and `DayStarted`
 * events. As with version 2, the log needs no change: `GameCreated` starts an empty day
 * log on replay, so a version 2 game opens with nothing logged today and no past days.
 */
const migrateV2toV3: Migration = (doc) => ({ ...doc, schemaVersion: 3 });

/**
 * Version 4 (2026-10-15) added values chosen during prep (`Game.prepValues`, the
 * `PrepValueSet` event), such as the Yaggababble's phrase. The log needs no change: an
 * older game simply has none set.
 */
const migrateV3toV4: Migration = (doc) => ({ ...doc, schemaVersion: 4 });

/**
 * Version 5 (2026-10-15) added changing the script mid-game (the `ScriptChanged` event,
 * 08-script-loading.md §5.6). The log needs no change: an older game never changed its
 * script. The bump makes older builds refuse a version 5 save instead of failing on the
 * unknown event.
 */
const migrateV4toV5: Migration = (doc) => ({ ...doc, schemaVersion: 5 });

/**
 * Version 6 (2026-10-16) added the Storyteller's note on a seat (`Seat.note`, the
 * `SeatNoteSet` event). The log needs no change: an older game has no notes. The bump makes
 * older builds refuse a version 6 save instead of failing on the unknown event.
 */
const migrateV5toV6: Migration = (doc) => ({ ...doc, schemaVersion: 6 });

/**
 * Version 7 (2026-10-17) added reminders held by a Fabled or Loric (`Game.ruleReminders`,
 * the `RuleReminderAdded` and `ReminderMovedToRuleCharacter` events). The log needs no
 * change: an older game has none. The bump makes older builds refuse a version 7 save
 * instead of failing on the unknown events.
 */
const migrateV6toV7: Migration = (doc) => ({ ...doc, schemaVersion: 7 });

/**
 * Version 8 (2026-10-17) added reminders loose on the board, held by no seat
 * (`Game.looseReminders`, the `LooseReminderPlaced` and `ReminderLoosened` events). The log
 * needs no change; the bump makes older builds refuse a version 8 save.
 */
const migrateV7toV8: Migration = (doc) => ({ ...doc, schemaVersion: 8 });

/**
 * Version 9 (2026-10-18) added the Storyteller's text on a reminder (`ReminderInstance.note`,
 * the `ReminderNoteSet` event), for the generic ∞ reminder. The log needs no change: an
 * older game has no notes. The bump makes older builds refuse a version 9 save instead of
 * failing on the unknown event.
 */
const migrateV8toV9: Migration = (doc) => ({ ...doc, schemaVersion: 9 });

/**
 * Version 10 (2026-10-19) added the Storyteller's general notes on a game (`Game.notes`, the
 * `GameNotesSet` event). The log needs no change: an older game has none. The bump makes
 * older builds refuse a version 10 save instead of failing on the unknown event.
 */
const migrateV9toV10: Migration = (doc) => ({ ...doc, schemaVersion: 10 });

/**
 * Version 11 (2026-10-19) added the Storyteller's name (`Game.storytellerName`, the
 * `StorytellerNameSet` event). The log needs no change: an older game has no name. The bump
 * makes older builds refuse a version 11 save instead of failing on the unknown event.
 */
const migrateV10toV11: Migration = (doc) => ({ ...doc, schemaVersion: 11 });

/**
 * Version 12 (2026-10-19) added the generic reminder's own symbol (`ReminderInstance.symbol`,
 * the `ReminderSymbolSet` event). The log needs no change: an older reminder has none. The bump
 * makes older builds refuse a version 12 save instead of failing on the unknown event.
 */
const migrateV11toV12: Migration = (doc) => ({ ...doc, schemaVersion: 12 });

/**
 * Version 13 (2026-10-20) added the colour of the generic reminder's symbol
 * (`ReminderInstance.symbolColour`, the `ReminderSymbolColourSet` event). The log needs no
 * change: an older reminder has none. The bump makes older builds refuse a version 13 save
 * instead of failing on the unknown event.
 */
const migrateV12toV13: Migration = (doc) => ({ ...doc, schemaVersion: 13 });

/**
 * Version 14 (2026-10-23) added the avatar and frame a player picked on their phone
 * (`Seat.avatar`, `Seat.frame`, the `SeatLookSet` event, plan R6). The log needs no change:
 * an older seat has neither. The bump makes older builds refuse a version 14 save instead of
 * failing on the unknown event.
 */
const migrateV13toV14: Migration = (doc) => ({ ...doc, schemaVersion: 14 });

/**
 * Version 15 (2026-10-23) added the bank's reusable ∞ tokens (`Game.genericTokens`, the
 * `GenericToken…` events, plan B9). The log needs no change: an older game has none. The bump
 * makes older builds refuse a version 15 save instead of failing on the unknown events.
 */
const migrateV14toV15: Migration = (doc) => ({ ...doc, schemaVersion: 15 });

/**
 * Version 16 (2026-10-23) added the filled symbol of a generic reminder or bank ∞ token
 * (`symbolFill`, the `ReminderSymbolFillSet` event). The log needs no change: an older
 * reminder has none. The bump makes older builds refuse a version 16 save instead of failing
 * on the unknown event.
 */
const migrateV15toV16: Migration = (doc) => ({ ...doc, schemaVersion: 16 });

/**
 * Version 17 (2026-10-23) gave the Storyteller several titled game notes (`Game.notes` as a
 * list, the `GameNoteSet` and `GameNoteDeleted` events). The log needs no change: an older
 * game's `GameNotesSet` replays as the untitled first note. The bump makes older builds
 * refuse a version 17 save instead of failing on the unknown events.
 */
const migrateV16toV17: Migration = (doc) => ({ ...doc, schemaVersion: 17 });

/**
 * Version 18 (2026-10-24) made the Flowergirl's Demon voted one of several day marks
 * (`DayLog.marks`, the `DayMarkSet` event), adding the Town Crier's Minion nominated. The log
 * needs no change: an older game's `DemonVotedSet` replays as the `demon-voted` mark. The bump
 * makes older builds refuse a version 18 save instead of failing on the unknown event.
 */
const migrateV17toV18: Migration = (doc) => ({ ...doc, schemaVersion: 18 });

/**
 * Version 19 (2026-10-26) gave each seat several titled notes, like the game's (`Seat.notes`,
 * the `SeatNoteSaved` and `SeatNoteDeleted` events). The log needs no change: an older game's
 * `SeatNoteSet` replays as the seat's untitled first note. The bump makes older builds refuse
 * a version 19 save instead of failing on the unknown events.
 */
const migrateV18toV19: Migration = (doc) => ({ ...doc, schemaVersion: 19 });

/** `MIGRATIONS[n]` migrates version `n` to `n + 1`. Version 1 is the first saved shape. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
	1: migrateV1toV2,
	2: migrateV2toV3,
	3: migrateV3toV4,
	4: migrateV4toV5,
	5: migrateV5toV6,
	6: migrateV6toV7,
	7: migrateV7toV8,
	8: migrateV8toV9,
	9: migrateV9toV10,
	10: migrateV10toV11,
	11: migrateV11toV12,
	12: migrateV12toV13,
	13: migrateV13toV14,
	14: migrateV14toV15,
	15: migrateV15toV16,
	16: migrateV16toV17,
	17: migrateV17toV18,
	18: migrateV18toV19
};

export function toSavedGame(session: GameSession, savedAt: number): SavedGame {
	return {
		schemaVersion: SAVED_GAME_VERSION,
		gameId: session.game.gameId,
		savedAt,
		log: structuredClone(session.log)
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Runs `doc` through `chain` until it reaches `target`. */
export function runMigrations(
	doc: SavedDocument,
	chain: Readonly<Record<number, Migration>>,
	target: number
): SavedDocument {
	let current = doc;
	if (current.schemaVersion > target) {
		throw new SavedGameError(
			'too-new',
			`saved by a newer version of ${APP_NAME} (format ${current.schemaVersion}, this build reads up to ${target})`
		);
	}
	while (current.schemaVersion < target) {
		const from = current.schemaVersion;
		const migration = Object.hasOwn(chain, from) ? chain[from] : undefined;
		if (!migration) {
			throw new SavedGameError('missing-migration', `no migration from format ${from}`);
		}
		current = migration(current);
		if (current.schemaVersion !== from + 1) {
			throw new Error(`migration from format ${from} produced format ${current.schemaVersion}`);
		}
	}
	return current;
}

/** Checks that a document has the current saved-game shape. */
function checkCurrent(doc: SavedDocument): SavedGame {
	const log = doc.log;
	if (
		typeof doc.gameId !== 'string' ||
		typeof doc.savedAt !== 'number' ||
		!isRecord(log) ||
		!Array.isArray(log.entries) ||
		typeof log.cursor !== 'number' ||
		log.entries.length === 0 ||
		!log.entries.every((e) => isRecord(e) && Array.isArray(e.events)) ||
		!Number.isInteger(log.cursor) ||
		log.cursor < 1 ||
		log.cursor > log.entries.length
	) {
		throw new SavedGameError('invalid', `not a ${APP_NAME} saved game`);
	}
	return doc as unknown as SavedGame;
}

/**
 * Reads a stored document (from IndexedDB or an imported file) as a current saved game.
 * Throws `SavedGameError` when it is not a saved game, was saved by a newer build, or
 * has no migration path.
 */
export function migrateSavedGame(
	raw: unknown,
	chain: Readonly<Record<number, Migration>> = MIGRATIONS,
	target: number = SAVED_GAME_VERSION
): SavedGame {
	if (!isRecord(raw) || !Number.isInteger(raw.schemaVersion) || (raw.schemaVersion as number) < 1) {
		throw new SavedGameError('invalid', `not a ${APP_NAME} saved game`);
	}
	return checkCurrent(runMigrations(raw as SavedDocument, chain, target));
}

export function summariseSavedGame(saved: SavedGame): SavedGameSummary {
	const created = saved.log.entries[0].events.find((e) => e.type === 'GameCreated');
	const summary: SavedGameSummary = {
		gameId: saved.gameId,
		savedAt: saved.savedAt,
		createdAt: created?.createdAt ?? saved.savedAt,
		seatCount: 0,
		days: 0
	};
	// Script and seat count at the cursor, without replaying the whole game.
	let script = created?.script;
	let seats = created?.seatIds.length ?? 0;
	for (const entry of saved.log.entries.slice(1, saved.log.cursor)) {
		for (const event of entry.events) {
			if (event.type === 'SeatAdded') seats++;
			else if (event.type === 'SeatRemoved') seats--;
			else if (event.type === 'ScriptChanged') script = event.script;
			else if (event.type === 'DayStarted') summary.days++;
		}
	}
	if (script?.meta?.name) summary.scriptName = script.meta.name;
	const logo =
		script &&
		scriptLogo({
			edition: scriptEdition(script)?.id,
			meta: { ...script.meta, name: script.meta?.name ?? '' }
		});
	if (logo) summary.scriptLogo = logo;
	summary.seatCount = seats;
	return summary;
}

/** Splits stored documents into readable summaries and unreadable games, newest first. */
export function listSavedGames(records: readonly unknown[]): {
	games: SavedGameSummary[];
	unreadable: UnreadableGame[];
} {
	const games: SavedGameSummary[] = [];
	const unreadable: UnreadableGame[] = [];
	for (const raw of records) {
		try {
			games.push(summariseSavedGame(migrateSavedGame(raw)));
		} catch (e) {
			if (!(e instanceof SavedGameError)) throw e;
			const gameId = isRecord(raw) && typeof raw.gameId === 'string' ? raw.gameId : undefined;
			if (gameId !== undefined) unreadable.push({ gameId, problem: e.problem });
		}
	}
	games.sort((a, b) => b.savedAt - a.savedAt);
	return { games, unreadable };
}

/** A `GameStore` kept in memory: for tests, and when the browser has no IndexedDB. */
export class MemoryGameStore implements GameStore {
	readonly #records = new Map<GameId, unknown>();

	async save(saved: SavedGame): Promise<void> {
		this.#records.set(saved.gameId, structuredClone(saved));
	}

	async load(gameId: GameId): Promise<SavedGame | undefined> {
		const raw = this.#records.get(gameId);
		return raw === undefined ? undefined : migrateSavedGame(structuredClone(raw));
	}

	async list() {
		return listSavedGames([...this.#records.values()]);
	}

	async delete(gameId: GameId): Promise<void> {
		this.#records.delete(gameId);
	}

	/** Stores a raw document as-is (tests use it to plant older or broken records). */
	putRaw(gameId: GameId, raw: unknown): void {
		this.#records.set(gameId, raw);
	}
}

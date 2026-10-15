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
import type { GameId } from '#lib/core/model/index.ts';
import type { GameLog, GameSession } from './log.ts';

export const SAVED_GAME_VERSION = 1;

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
	seatCount: number;
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

/** `MIGRATIONS[n]` migrates version `n` to `n + 1`. Version 1 is the first saved shape. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
			`saved by a newer version of Grim-Games (format ${current.schemaVersion}, this build reads up to ${target})`
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
		throw new SavedGameError('invalid', 'not a Grim-Games saved game');
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
		throw new SavedGameError('invalid', 'not a Grim-Games saved game');
	}
	return checkCurrent(runMigrations(raw as SavedDocument, chain, target));
}

export function summariseSavedGame(saved: SavedGame): SavedGameSummary {
	const created = saved.log.entries[0].events.find((e) => e.type === 'GameCreated');
	const summary: SavedGameSummary = {
		gameId: saved.gameId,
		savedAt: saved.savedAt,
		createdAt: created?.createdAt ?? saved.savedAt,
		seatCount: 0
	};
	if (created?.script.meta?.name) summary.scriptName = created.script.meta.name;
	// Seat count at the cursor, without replaying the whole game.
	let seats = created?.seatIds.length ?? 0;
	for (const entry of saved.log.entries.slice(1, saved.log.cursor)) {
		for (const event of entry.events) {
			if (event.type === 'SeatAdded') seats++;
			else if (event.type === 'SeatRemoved') seats--;
		}
	}
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

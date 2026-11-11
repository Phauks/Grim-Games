/**
 * Saved games and the storage port.
 *
 * Every saved game carries `schemaVersion`. There are no migrations (Trevor, 2026-11-10:
 * "there should be none ... old games not working is fine"): a game saved in any other
 * format is refused with a load error, never converted. One saved by a *newer* build says so,
 * so the app can offer its newer build.
 *
 * To change the saved shape (including any event shape in `events.ts`): bump
 * `SAVED_GAME_VERSION`. Games saved in the old shape then stop opening.
 */
import { APP_NAME } from '#lib/core/app-name.ts';
import { scriptLogo } from '#lib/core/data/script-logo.ts';
import { scriptEdition } from '#lib/core/data/script.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { Script } from '#lib/core/data/index.ts';
import type { GameLog, GameSession } from './log.ts';

export const SAVED_GAME_VERSION = 31;

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
	/** Loads a game. Undefined when there is none; throws `SavedGameError` when it cannot be read. */
	load(gameId: GameId): Promise<SavedGame | undefined>;
	/** All saved games, most recently saved first. */
	list(): Promise<{ games: SavedGameSummary[]; unreadable: UnreadableGame[] }>;
	delete(gameId: GameId): Promise<void>;
}

/** `too-new`: saved by a newer build. `invalid`: anything else that can't be opened, older formats included. */
export type SavedGameProblem = 'invalid' | 'too-new';

export class SavedGameError extends Error {
	constructor(
		readonly problem: SavedGameProblem,
		message: string
	) {
		super(message);
		this.name = 'SavedGameError';
	}
}

/**
 * The session as a saved game. Its log is shared, not copied (memory sweep, 2026-10-31): a log
 * is never changed in place, as each command makes new entries, and a store or a message copies
 * it as it writes.
 */
export function toSavedGame(session: GameSession, savedAt: number): SavedGame {
	return {
		schemaVersion: SAVED_GAME_VERSION,
		gameId: session.game.gameId,
		savedAt,
		log: session.log
	};
}

/**
 * The same game under another id, so a copy opened on a device (a game sent with a report)
 * never replaces a game of its own. The id is in the save and in the game's first event.
 */
export function withGameId(saved: SavedGame, gameId: GameId): SavedGame {
	return {
		...saved,
		gameId,
		log: {
			...saved.log,
			entries: saved.log.entries.map((entry) => ({
				...entry,
				events: entry.events.map((event) =>
					event.type === 'GameCreated' ? { ...event, gameId } : event
				)
			}))
		}
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks that a document has the current saved-game shape. */
function checkCurrent(doc: Record<string, unknown>): SavedGame {
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
 * Reads a stored document (from IndexedDB, a room or an imported file) as a saved game.
 * Throws `SavedGameError` when it was saved by a newer build (`too-new`), or is not a saved
 * game of this build's format (`invalid`): older formats are not converted.
 */
export function readSavedGame(raw: unknown): SavedGame {
	if (!isRecord(raw) || !Number.isInteger(raw.schemaVersion)) {
		throw new SavedGameError('invalid', `not a ${APP_NAME} saved game`);
	}
	const version = raw.schemaVersion as number;
	if (version > SAVED_GAME_VERSION) {
		throw new SavedGameError(
			'too-new',
			`saved by a newer version of ${APP_NAME} (format ${version}, this build reads ${SAVED_GAME_VERSION})`
		);
	}
	if (version !== SAVED_GAME_VERSION) {
		throw new SavedGameError(
			'invalid',
			`saved by an older version of ${APP_NAME} (format ${version}), which this build can't open`
		);
	}
	return checkCurrent(raw);
}

/** A game's script's logo (`scriptLogo`), as the saved games list shows it. */
export function gameScriptLogo(script: Script): string | undefined {
	return scriptLogo({
		edition: scriptEdition(script)?.id,
		meta: { ...script.meta, name: script.meta?.name ?? '' }
	});
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
	const logo = script && gameScriptLogo(script);
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
			games.push(summariseSavedGame(readSavedGame(raw)));
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
		return raw === undefined ? undefined : readSavedGame(structuredClone(raw));
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

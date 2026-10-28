/**
 * Saved games in IndexedDB, implementing core's `GameStore` port with the raw IndexedDB
 * API (a few promise wrappers do not justify a dependency).
 *
 * Two kinds of version are involved:
 * - the IndexedDB database version (`DB_VERSION`) covers object stores and indexes, and
 *   is upgraded in `onupgradeneeded`;
 * - each saved game's `schemaVersion` covers the game data, and is migrated by core on
 *   load (`migrateSavedGame`), so documents are stored exactly as they were written.
 */
import {
	listSavedGames,
	migrateSavedGame,
	type GameStore,
	type SavedGame,
	type SavedGameSummary,
	type UnreadableGame
} from '#lib/core/engine/index.ts';
import { DB_NAME } from './db-name.ts';

const DB_VERSION = 1;
const GAMES = 'games';

function done<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function committed(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
	});
}

export class IdbGameStore implements GameStore {
	#db: Promise<IDBDatabase> | undefined;

	constructor(
		private readonly name: string = DB_NAME,
		private readonly factory: IDBFactory = globalThis.indexedDB
	) {}

	#open(): Promise<IDBDatabase> {
		this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = this.factory.open(this.name, DB_VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(GAMES))
					db.createObjectStore(GAMES, { keyPath: 'gameId' });
			};
			request.onsuccess = () => {
				const db = request.result;
				// A newer build in another tab wants to upgrade: let it, and reopen next time.
				db.onversionchange = () => {
					db.close();
					this.#db = undefined;
				};
				resolve(db);
			};
			request.onerror = () => {
				this.#db = undefined;
				reject(request.error);
			};
			request.onblocked = () => {
				this.#db = undefined;
				reject(new DOMException('Saved games are open in an older tab', 'InvalidStateError'));
			};
		});
		return this.#db;
	}

	async save(saved: SavedGame): Promise<void> {
		const tx = (await this.#open()).transaction(GAMES, 'readwrite');
		tx.objectStore(GAMES).put(saved);
		await committed(tx);
	}

	async load(gameId: string): Promise<SavedGame | undefined> {
		const tx = (await this.#open()).transaction(GAMES, 'readonly');
		const raw: unknown = await done(tx.objectStore(GAMES).get(gameId));
		return raw === undefined ? undefined : migrateSavedGame(raw);
	}

	async list(): Promise<{ games: SavedGameSummary[]; unreadable: UnreadableGame[] }> {
		const tx = (await this.#open()).transaction(GAMES, 'readonly');
		return listSavedGames(await done(tx.objectStore(GAMES).getAll()));
	}

	async delete(gameId: string): Promise<void> {
		const tx = (await this.#open()).transaction(GAMES, 'readwrite');
		tx.objectStore(GAMES).delete(gameId);
		await committed(tx);
	}

	/** Closes the connection; the next call reopens it. */
	async close(): Promise<void> {
		const db = this.#db;
		this.#db = undefined;
		if (db) (await db).close();
	}

	/** Stores a document as-is, bypassing the types (tests plant old or broken records). */
	async putRaw(raw: { gameId: string } & Record<string, unknown>): Promise<void> {
		const tx = (await this.#open()).transaction(GAMES, 'readwrite');
		tx.objectStore(GAMES).put(raw);
		await committed(tx);
	}
}

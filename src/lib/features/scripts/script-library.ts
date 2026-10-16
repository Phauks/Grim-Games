/**
 * Saved scripts in IndexedDB. A database of its own (not the saved-games one), so its
 * versions and upgrades never touch saved games.
 */
import {
	MAX_SAVED_SCRIPTS,
	migrateSavedScript,
	SAVED_SCRIPT_VERSION,
	sameScript,
	type SavedScript,
	type ScriptSource
} from './saved-scripts.ts';

export const SCRIPTS_DB_NAME = 'grim-games-scripts';
const DB_VERSION = 1;
const SCRIPTS = 'scripts';

/** IndexedDB can report a failure with no error object; always reject with an Error. */
function failure(error: DOMException | null, what: string): Error {
	return error ?? new DOMException(`Saved scripts: ${what} failed`, 'UnknownError');
}

function done<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(failure(request.error, 'read'));
	});
}

function committed(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(failure(tx.error, 'write'));
		tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
	});
}

export interface NewScript {
	name: string;
	edition?: string;
	json: unknown[];
	source: ScriptSource;
}

export class IdbScriptLibrary {
	#db: Promise<IDBDatabase> | undefined;
	/** Writes run one at a time, so two quick saves of one script can't both add it. */
	#writes: Promise<unknown> = Promise.resolve();

	#queue<T>(write: () => Promise<T>): Promise<T> {
		const next = this.#writes.then(write, write);
		this.#writes = next.catch(() => undefined);
		return next;
	}

	constructor(
		private readonly name: string = SCRIPTS_DB_NAME,
		private readonly factory: IDBFactory = globalThis.indexedDB,
		private readonly now: () => number = Date.now
	) {}

	#open(): Promise<IDBDatabase> {
		this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = this.factory.open(this.name, DB_VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(SCRIPTS)) {
					db.createObjectStore(SCRIPTS, { keyPath: 'scriptId' });
				}
			};
			request.onsuccess = () => {
				const db = request.result;
				db.onversionchange = () => {
					db.close();
					this.#db = undefined;
				};
				resolve(db);
			};
			request.onerror = () => {
				this.#db = undefined;
				reject(failure(request.error, 'open'));
			};
			request.onblocked = () => {
				this.#db = undefined;
				reject(new DOMException('Saved scripts are open in an older tab', 'InvalidStateError'));
			};
		});
		return this.#db;
	}

	async #all(): Promise<SavedScript[]> {
		const tx = (await this.#open()).transaction(SCRIPTS, 'readonly');
		const raw: unknown[] = await done(tx.objectStore(SCRIPTS).getAll());
		return raw.flatMap((r) => migrateSavedScript(r) ?? []);
	}

	/** Saved scripts, most recently used first. */
	async list(): Promise<SavedScript[]> {
		return (await this.#all()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
	}

	/**
	 * Records that a script was used: moves an identical saved script to the top (keeping
	 * its id), or saves a new one, then drops the oldest beyond `MAX_SAVED_SCRIPTS`.
	 */
	use(script: NewScript): Promise<SavedScript> {
		return this.#queue(() => this.#use(script));
	}

	async #use(script: NewScript): Promise<SavedScript> {
		const all = await this.list();
		const now = this.now();
		const existing = all.find((s) => sameScript(s, script));
		const saved: SavedScript = existing
			? { ...existing, name: script.name, source: script.source, lastUsedAt: now }
			: {
					schemaVersion: SAVED_SCRIPT_VERSION,
					scriptId: crypto.randomUUID(),
					name: script.name,
					...(script.edition ? { edition: script.edition } : {}),
					json: script.json,
					source: script.source,
					addedAt: now,
					lastUsedAt: now,
					revision: 1
				};
		const others = all.filter((s) => s.scriptId !== saved.scriptId);
		const tx = (await this.#open()).transaction(SCRIPTS, 'readwrite');
		const store = tx.objectStore(SCRIPTS);
		store.put(saved);
		for (const old of others.slice(MAX_SAVED_SCRIPTS - 1)) store.delete(old.scriptId);
		await committed(tx);
		return saved;
	}

	delete(scriptId: string): Promise<void> {
		return this.#queue(() => this.#delete(scriptId));
	}

	async #delete(scriptId: string): Promise<void> {
		const tx = (await this.#open()).transaction(SCRIPTS, 'readwrite');
		tx.objectStore(SCRIPTS).delete(scriptId);
		await committed(tx);
	}

	/** Closes the connection; the next call reopens it. */
	async close(): Promise<void> {
		const db = this.#db;
		this.#db = undefined;
		if (db) (await db).close();
	}
}

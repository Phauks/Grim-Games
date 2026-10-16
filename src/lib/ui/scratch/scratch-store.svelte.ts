/**
 * Scratch pads, kept in this browser's IndexedDB only (database `grim-games-scratch`, one
 * record per pad). Nothing is sent anywhere. Callers name a pad with a namespaced key, such
 * as `player:<script>`, so player pads and any later Storyteller pads never mix.
 */
import {
	commitStroke,
	emptyPad,
	migratePad,
	redo,
	undo,
	type ScratchHistory,
	type ScratchStroke
} from '#lib/core/scratch/scratch.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';

const DB_NAME = 'grim-games-scratch';
const DB_VERSION = 1;
const PADS = 'pads';
const SAVE_DELAY_MS = 300;

let db: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	db ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(PADS))
				request.result.createObjectStore(PADS, { keyPath: 'key' });
		};
		request.onsuccess = () => {
			const opened = request.result;
			opened.onversionchange = () => {
				opened.close();
				db = undefined;
			};
			resolve(opened);
		};
		request.onerror = () => {
			db = undefined;
			reject(request.error);
		};
	});
	return db;
}

async function read(key: string): Promise<unknown> {
	const store = (await open()).transaction(PADS).objectStore(PADS);
	return new Promise((resolve, reject) => {
		const request = store.get(key);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function write(key: string, strokes: readonly ScratchStroke[]): Promise<void> {
	const tx = (await open()).transaction(PADS, 'readwrite');
	tx.objectStore(PADS).put({ ...emptyPad(), key, strokes, updatedAt: Date.now() });
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** One reactive pad, saved shortly after every change. Undo history lasts for the visit. */
export class ScratchPadState {
	history = $state.raw<ScratchHistory>({ strokes: [], undone: [] });
	/** Set when this browser has no usable IndexedDB (e.g. some private modes). */
	saveError = $state(false);
	#timer: ReturnType<typeof setTimeout> | undefined;

	constructor(readonly key: string) {}

	get strokes(): readonly ScratchStroke[] {
		return this.history.strokes;
	}

	async load(): Promise<void> {
		try {
			const saved = migratePad(await read(this.key));
			if (saved) this.history = { strokes: saved.strokes, undone: [] };
		} catch (e) {
			// Drawings never go into an error report; IndexedDB errors carry none.
			reportError(e, { area: 'scratch', notify: false });
			this.saveError = true;
		}
	}

	#change(next: ScratchHistory) {
		if (next === this.history) return;
		this.history = next;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			write(this.key, this.history.strokes).then(
				() => (this.saveError = false),
				(e: unknown) => {
					reportError(e, { area: 'scratch', notify: false });
					this.saveError = true;
				}
			);
		}, SAVE_DELAY_MS);
	}

	add(stroke: ScratchStroke) {
		this.#change(commitStroke(this.history, stroke));
	}
	undo() {
		this.#change(undo(this.history));
	}
	redo() {
		this.#change(redo(this.history));
	}
	/** Deletes the drawing; it cannot be undone, so callers confirm first. */
	clear() {
		this.#change({ strokes: [], undone: [] });
	}
}

/**
 * Scratch pads, kept in this browser's IndexedDB only (database `grim-games-scratch`, one
 * record per pad). Nothing is sent anywhere. Pads are listed by a namespaced base key, such
 * as `player:<script>`, so player pads and any later Storyteller pads never mix; each pad is
 * `<base>:<id>`, and a pad saved before v3 keeps the bare base key.
 */
import {
	commitStroke,
	emptyPad,
	migratePad,
	redo,
	undo,
	type ScratchHistory,
	type ScratchPad,
	type ScratchPaper,
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

async function write(key: string, pad: ScratchPad): Promise<void> {
	const tx = (await open()).transaction(PADS, 'readwrite');
	tx.objectStore(PADS).put({ ...pad, key, updatedAt: Date.now() });
	await done(tx);
}

async function remove(key: string): Promise<void> {
	const tx = (await open()).transaction(PADS, 'readwrite');
	tx.objectStore(PADS).delete(key);
	await done(tx);
}

function done(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** Every saved record whose key is `base` (a pad from before v3) or `base:<id>`. */
async function list(base: string): Promise<{ key: string; value: unknown }[]> {
	const store = (await open()).transaction(PADS).objectStore(PADS);
	const range = IDBKeyRange.bound(base, `${base}\uffff`);
	const values = await new Promise<unknown[]>((resolve, reject) => {
		const request = store.getAll(range);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return values
		.map((value) => ({ key: (value as { key?: unknown })?.key, value }))
		.filter(
			(r): r is { key: string; value: unknown } =>
				r.key === base || (typeof r.key === 'string' && r.key.startsWith(`${base}:`))
		);
}

/** Deletes every pad under `base` from this device (a notebook thrown away whole). */
export async function removePads(base: string): Promise<void> {
	for (const { key } of await list(base)) await remove(key);
}

/** One reactive pad, saved shortly after every change. Undo history lasts for the visit. */
export class ScratchPadState {
	history = $state.raw<ScratchHistory>({ strokes: [], undone: [] });
	title = $state('');
	paper = $state<ScratchPaper>('leather');
	locked = $state(false);
	hidden = $state(false);
	createdAt = 0;
	/** Set when this browser has no usable IndexedDB (e.g. some private modes). */
	saveError = $state(false);
	#timer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		readonly key: string,
		saved?: ScratchPad
	) {
		if (saved) this.#apply(saved);
	}

	get strokes(): readonly ScratchStroke[] {
		return this.history.strokes;
	}

	#apply(saved: ScratchPad) {
		this.history = { strokes: saved.strokes, undone: [] };
		this.title = saved.title;
		this.paper = saved.paper;
		this.locked = saved.locked;
		this.hidden = saved.hidden;
		this.createdAt = saved.createdAt;
	}

	async load(): Promise<void> {
		try {
			const saved = migratePad(await read(this.key));
			if (saved) this.#apply(saved);
		} catch (e) {
			// Drawings never go into an error report; IndexedDB errors carry none.
			reportError(e, { area: 'scratch', notify: false });
			this.saveError = true;
		}
	}

	get pad(): ScratchPad {
		return {
			...emptyPad(this.createdAt),
			strokes: [...this.history.strokes],
			title: this.title,
			paper: this.paper,
			locked: this.locked,
			hidden: this.hidden
		};
	}

	/** Saves now (a new pad) or shortly after the last change. */
	save(delay = SAVE_DELAY_MS): Promise<void> {
		clearTimeout(this.#timer);
		return new Promise((resolve) => {
			this.#timer = setTimeout(() => {
				write(this.key, this.pad).then(
					() => {
						this.saveError = false;
						resolve();
					},
					(e: unknown) => {
						reportError(e, { area: 'scratch', notify: false });
						this.saveError = true;
						resolve();
					}
				);
			}, delay);
		});
	}

	#change(next: ScratchHistory) {
		if (next === this.history) return;
		this.history = next;
		void this.save();
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
	rename(title: string) {
		this.title = title;
		void this.save();
	}
	setPaper(paper: ScratchPaper) {
		this.paper = paper;
		void this.save();
	}
	setLocked(locked: boolean) {
		this.locked = locked;
		void this.save();
	}
	setHidden(hidden: boolean) {
		this.hidden = hidden;
		void this.save();
	}
	/** Stops a pending save, for a pad being deleted. */
	cancel() {
		clearTimeout(this.#timer);
	}
}

/** A player's pads for one script (`base` is e.g. `player:<script>`), oldest first. */
export class ScratchPads {
	pads = $state.raw<ScratchPadState[]>([]);
	saveError = $state(false);

	constructor(readonly base: string) {}

	async load(): Promise<void> {
		try {
			const records = await list(this.base);
			this.pads = records
				.map(({ key, value }) => {
					const saved = migratePad(value);
					return saved && new ScratchPadState(key, saved);
				})
				.filter((p): p is ScratchPadState => !!p)
				.sort((a, b) => a.createdAt - b.createdAt);
		} catch (e) {
			reportError(e, { area: 'scratch', notify: false });
			this.saveError = true;
		}
	}

	/** A new blank pad, saved straight away so it is still there after a reload. */
	add(): ScratchPadState {
		const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		const pad = new ScratchPadState(`${this.base}:${id}`, emptyPad(Date.now()));
		this.pads = [...this.pads, pad];
		void pad.save(0);
		return pad;
	}

	/** Deletes a pad from this device; it cannot be undone, so callers confirm first. */
	async remove(pad: ScratchPadState): Promise<void> {
		pad.cancel();
		this.pads = this.pads.filter((p) => p !== pad);
		try {
			await remove(pad.key);
		} catch (e) {
			reportError(e, { area: 'scratch', notify: false });
			this.saveError = true;
		}
	}
}

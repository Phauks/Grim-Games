/**
 * The player's notebook, kept in this browser's IndexedDB only (database
 * `grim-games-player`, one record per script). Nothing here is sent anywhere: notes are
 * private to the player's device (09-player-script-view.md).
 *
 * The database is separate from the Storyteller's saved games (`grim-games`) so the two
 * never share a schema upgrade, and so player mode never reads Storyteller state.
 */
import {
	addNote,
	deleteNote,
	emptyNotebook,
	isBlankNote,
	migrateNotebook,
	updateNote,
	type PlayerNotebook
} from './notebook.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { playerSettings } from './player-settings.svelte.ts';

/** The player view's own database; Settings > Data clears it by this name. */
const DB_NAME = 'grim-games-player';
const DB_VERSION = 1;
const NOTEBOOKS = 'notebooks';
const SAVE_DELAY_MS = 300;

let db: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	db ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(NOTEBOOKS))
				request.result.createObjectStore(NOTEBOOKS, { keyPath: 'scriptKey' });
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
	const store = (await open()).transaction(NOTEBOOKS).objectStore(NOTEBOOKS);
	return new Promise((resolve, reject) => {
		const request = store.get(key);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function write(book: PlayerNotebook): Promise<void> {
	const tx = (await open()).transaction(NOTEBOOKS, 'readwrite');
	tx.objectStore(NOTEBOOKS).put($state.snapshot(book));
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** Deletes one notebook from this device: the grim cover's, which starts blank each time. */
export async function deleteNotebook(key: string): Promise<void> {
	const tx = (await open()).transaction(NOTEBOOKS, 'readwrite');
	tx.objectStore(NOTEBOOKS).delete(key);
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** A reactive notebook for one script, saved shortly after every change. */
export class NotebookState {
	book = $state<PlayerNotebook>() as PlayerNotebook;
	/** False until the saved notebook (if any) has been read. */
	ready = $state(false);
	/** Set when this browser has no usable IndexedDB (e.g. some private modes). */
	saveError = $state(false);
	#timer: ReturnType<typeof setTimeout> | undefined;

	constructor(readonly key: string) {
		this.book = emptyNotebook(key);
	}

	async load(): Promise<void> {
		try {
			const saved = migrateNotebook(await read(this.key), playerSettings.current.hideNoteContents);
			if (saved && saved.scriptKey === this.key) this.book = saved;
		} catch (e) {
			// The panel says this browser cannot save, so only logged. IndexedDB errors carry
			// no notebook content (notes never go into an error).
			reportError(e, { area: 'play', notify: false });
			this.saveError = true;
		}
		this.ready = true;
	}

	#change(next: PlayerNotebook) {
		this.book = { ...next, updatedAt: Date.now() };
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			write(this.book).then(
				() => (this.saveError = false),
				(e: unknown) => {
					reportError(e, { area: 'play', notify: false });
					this.saveError = true;
				}
			);
		}, SAVE_DELAY_MS);
	}

	/** Adds an empty note and returns its id. */
	addNote(): string {
		const { book, noteId } = addNote(this.book);
		this.#change(book);
		return noteId;
	}
	updateNote(noteId: string, patch: { title?: string; text?: string; hidden?: boolean }) {
		this.#change(updateNote(this.book, noteId, patch));
	}
	deleteNote(noteId: string) {
		this.#change(deleteNote(this.book, noteId));
	}
	/** Drops the note if it was closed with nothing in it, as a new note left empty. */
	dropIfBlank(noteId: string) {
		const note = this.book.notes.find((n) => n.noteId === noteId);
		if (note && isBlankNote(note)) this.deleteNote(noteId);
	}
}

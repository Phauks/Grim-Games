/**
 * The player's own notebook for one script: titled notes (Trevor, 2026-10-15: e.g. an evil
 * player keeps their real information apart from their bluff). Private to the player's device
 * (09-player-script-view.md "Privacy and storage").
 *
 * Each note has its own "Hide contents" switch (Trevor, 2026-10-17).
 *
 * Saved notebooks carry `schemaVersion`, and only the current version is read (no
 * migrations, Trevor 2026-11-10): a notebook in any other format starts fresh.
 */

export const NOTEBOOK_VERSION = 6;

export interface PlayerNote {
	noteId: string;
	/** Empty until the player names it. */
	title: string;
	text: string;
	/** The list shows the title only; the text shows when the note is opened. */
	hidden: boolean;
}

export interface PlayerNotebook {
	schemaVersion: typeof NOTEBOOK_VERSION;
	/** Which script this notebook belongs to (`scriptKey`). */
	scriptKey: string;
	notes: PlayerNote[];
	updatedAt: number;
}

/** Notebook key for a script: the edition id for official editions, else its name. */
export function scriptKey(script: { edition?: string; name: string }): string {
	return script.edition
		? `edition:${script.edition}`
		: `script:${script.name.trim().toLowerCase()}`;
}

/** A script's notebook before any note is written: no notes, only the "+ New note" card. */
export function emptyNotebook(key: string, now = Date.now()): PlayerNotebook {
	return { schemaVersion: NOTEBOOK_VERSION, scriptKey: key, notes: [], updatedAt: now };
}

/** A note with nothing in it, which is not kept (as the Storyteller's game notes). */
export function isBlankNote(note: { title: string; text: string }): boolean {
	return !note.title.trim() && !note.text.trim();
}

/** Adds an empty note at the end and returns the notebook and the new note's id. */
export function addNote(book: PlayerNotebook): { book: PlayerNotebook; noteId: string } {
	const n = book.notes.reduce((max, x) => Math.max(max, Number(x.noteId.slice(1)) || 0), 0) + 1;
	const noteId = `n${n}`;
	return {
		book: { ...book, notes: [...book.notes, { noteId, title: '', text: '', hidden: false }] },
		noteId
	};
}

export function updateNote(
	book: PlayerNotebook,
	noteId: string,
	patch: Partial<Omit<PlayerNote, 'noteId'>>
): PlayerNotebook {
	return {
		...book,
		notes: book.notes.map((x) => (x.noteId === noteId ? { ...x, ...patch } : x))
	};
}

export function deleteNote(book: PlayerNotebook, noteId: string): PlayerNotebook {
	return { ...book, notes: book.notes.filter((x) => x.noteId !== noteId) };
}

const isString = (v: unknown): v is string => typeof v === 'string';

function readNotes(raw: unknown): PlayerNote[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const notes: PlayerNote[] = [];
	for (const [i, item] of raw.entries()) {
		const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
		let noteId = isString(o.noteId) && o.noteId ? o.noteId : `n${i + 1}`;
		if (seen.has(noteId)) noteId = `n${raw.length + i + 1}`;
		seen.add(noteId);
		notes.push({
			noteId,
			title: isString(o.title) ? o.title : '',
			text: isString(o.text) ? o.text : '',
			hidden: o.hidden === true
		});
	}
	return notes;
}

/**
 * Reads a stored notebook of the current version. Returns undefined for anything else (another
 * version, or not a notebook), so the caller starts a fresh one. Blank notes are dropped.
 */
export function readNotebook(raw: unknown): PlayerNotebook | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	if (o.schemaVersion !== NOTEBOOK_VERSION || !isString(o.scriptKey)) return undefined;
	return {
		schemaVersion: NOTEBOOK_VERSION,
		scriptKey: o.scriptKey,
		notes: readNotes(o.notes).filter((n) => !isBlankNote(n)),
		updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0
	};
}

/**
 * The player's own notebook for one script: titled notes (Trevor, 2026-10-15: e.g. an evil
 * player keeps their real information apart from their bluff). Private to the player's device
 * (09-player-script-view.md "Privacy and storage").
 *
 * The player view is a reading page, not a grimoire (Trevor, 2026-10-16): v1 to v4 also kept
 * a seat circle (names, claims, deaths, a note per player). v5 keeps only notes; a note
 * written on a seat becomes a titled note so nothing the player wrote is lost.
 *
 * v6 gives each note its own "Hide contents" switch (Trevor, 2026-10-17), replacing the
 * single setting that hid every note.
 *
 * Saved notebooks carry `schemaVersion`: the app is an offline-first PWA, so a newer build
 * can open a notebook written by an older one, and `migrateNotebook` must read every
 * version ever saved.
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

function readNotes(raw: unknown, hideAll: boolean): PlayerNote[] {
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
			hidden: o.hidden === true || hideAll
		});
	}
	return notes;
}

/**
 * v1 to v4 seats' notes as titled notes, named like the circle showed them: "Seat 3" or
 * "Seat 3 · Alex". Seats with no note are dropped with the circle.
 */
function seatNotes(raw: unknown, after: readonly PlayerNote[], hidden: boolean): PlayerNote[] {
	if (!Array.isArray(raw)) return [];
	let n = after.reduce((max, x) => Math.max(max, Number(x.noteId.slice(1)) || 0), 0);
	const notes: PlayerNote[] = [];
	for (const [i, item] of raw.entries()) {
		const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
		const text = isString(o.note) ? o.note : '';
		if (!text.trim()) continue;
		const name = isString(o.name) ? o.name.trim() : '';
		n += 1;
		notes.push({
			noteId: `n${n}`,
			title: name ? `Seat ${i + 1} · ${name}` : `Seat ${i + 1}`,
			text,
			hidden
		});
	}
	return notes;
}

/**
 * Reads a stored notebook of any known version. Returns undefined for data it cannot
 * understand (a newer schema, or not a notebook), so the caller starts a fresh one rather
 * than losing the player's notes by overwriting them silently. Blank notes are dropped:
 * older builds started every notebook with one, so a new game showed an empty note.
 *
 * `hideAll` is the old "Hide note contents" setting: notes saved before v6 start hidden
 * when it was on, so nothing that was hidden shows after the update.
 */
export function migrateNotebook(raw: unknown, hideAll = false): PlayerNotebook | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	const version = typeof o.schemaVersion === 'number' ? o.schemaVersion : 0;
	if (![1, 2, 3, 4, 5, 6].includes(version) || !isString(o.scriptKey)) return undefined;
	const legacyHide = version < 6 && hideAll;
	const notes =
		version === 1
			? [{ noteId: 'n1', title: '', text: isString(o.notes) ? o.notes : '', hidden: legacyHide }]
			: readNotes(o.notes, legacyHide);
	return {
		schemaVersion: NOTEBOOK_VERSION,
		scriptKey: o.scriptKey,
		// v1 to v4's seat circle, claims, layout and `me` were dropped in v5 (Trevor).
		notes: (version < 5 ? [...notes, ...seatNotes(o.seats, notes, legacyHide)] : notes).filter(
			(n) => !isBlankNote(n)
		),
		updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0
	};
}

/**
 * The player's own notebook for one script: their seat circle (names, guesses, deaths,
 * ghost votes, a note per player) and titled notes (Trevor, 2026-10-15: e.g. an evil
 * player keeps their real information apart from their bluff). Private to the player's device
 * (09-player-script-view.md "Privacy and storage").
 *
 * Saved notebooks carry `schemaVersion`: the app is an offline-first PWA, so a newer build
 * can open a notebook written by an older one, and `migrateNotebook` must read every
 * version ever saved.
 */
import type { CharacterId } from '#lib/core/data/index.ts';

export const NOTEBOOK_VERSION = 2;

/** 5 to 15 dealt players plus up to 5 Travellers (wiki: Setup, Travellers). */
export const MIN_SEATS = 5;
export const MAX_SEATS = 20;
export const DEFAULT_SEATS = 8;

export interface NotebookSeat {
	/** Stable id; seat numbers are positions in `seats`, clockwise from the top. */
	seatId: string;
	name: string;
	/** The character the player thinks this seat has. */
	guess?: CharacterId;
	dead: boolean;
	ghostVoteUsed: boolean;
	note: string;
}

export interface PlayerNote {
	noteId: string;
	/** Empty until the player names it. */
	title: string;
	text: string;
}

export interface PlayerNotebook {
	schemaVersion: typeof NOTEBOOK_VERSION;
	/** Which script this notebook belongs to (`scriptKey`). */
	scriptKey: string;
	seats: NotebookSeat[];
	/** The player's own seat. */
	me?: string;
	notes: PlayerNote[];
	updatedAt: number;
}

/** Notebook key for a script: the edition id for official editions, else its name. */
export function scriptKey(script: { edition?: string; name: string }): string {
	return script.edition
		? `edition:${script.edition}`
		: `script:${script.name.trim().toLowerCase()}`;
}

function newSeat(n: number): NotebookSeat {
	return { seatId: `s${n}`, name: '', dead: false, ghostVoteUsed: false, note: '' };
}

/** Next unused seat id, so ids never repeat after removing and adding seats. */
function nextSeatNumber(seats: readonly NotebookSeat[]): number {
	return seats.reduce((max, s) => Math.max(max, Number(s.seatId.slice(1)) || 0), 0) + 1;
}

export function emptyNotebook(
	key: string,
	seats = DEFAULT_SEATS,
	now = Date.now()
): PlayerNotebook {
	return {
		schemaVersion: NOTEBOOK_VERSION,
		scriptKey: key,
		seats: Array.from({ length: seats }, (_, i) => newSeat(i + 1)),
		notes: [{ noteId: 'n1', title: '', text: '' }],
		updatedAt: now
	};
}

function clampSeats(n: number): number {
	return Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(n)));
}

/** Adds empty seats at the end, or removes seats from the end (keeping filled ones' data). */
export function setSeatCount(book: PlayerNotebook, count: number): PlayerNotebook {
	const target = clampSeats(count);
	const seats = book.seats.slice(0, target);
	while (seats.length < target) seats.push(newSeat(nextSeatNumber(seats)));
	const me = seats.some((s) => s.seatId === book.me) ? book.me : undefined;
	return { ...book, seats, me };
}

export type SeatPatch = Partial<Omit<NotebookSeat, 'seatId'>>;

export function updateSeat(book: PlayerNotebook, seatId: string, patch: SeatPatch): PlayerNotebook {
	return {
		...book,
		seats: book.seats.map((s) => {
			if (s.seatId !== seatId) return s;
			const next = { ...s, ...patch };
			// Only dead players spend their one remaining vote (https://wiki.bloodontheclocktower.com/Rules_Explanation).
			if (!next.dead) next.ghostVoteUsed = false;
			return next;
		})
	};
}

/** Marks a seat as the player's own; tapping it again clears it. */
export function toggleMe(book: PlayerNotebook, seatId: string): PlayerNotebook {
	return { ...book, me: book.me === seatId ? undefined : seatId };
}

/** Adds an empty note at the end and returns the notebook and the new note's id. */
export function addNote(book: PlayerNotebook): { book: PlayerNotebook; noteId: string } {
	const n = book.notes.reduce((max, x) => Math.max(max, Number(x.noteId.slice(1)) || 0), 0) + 1;
	const noteId = `n${n}`;
	return { book: { ...book, notes: [...book.notes, { noteId, title: '', text: '' }] }, noteId };
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

/**
 * Seats per player count that are not Travellers is unknown to the player view, so the
 * seat count stands in for the player count (09-player-script-view.md, open decision 3).
 */
export function playerCount(book: PlayerNotebook): number {
	return book.seats.length;
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
			text: isString(o.text) ? o.text : ''
		});
	}
	return notes;
}

function readSeat(raw: unknown, n: number): NotebookSeat {
	const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const dead = o.dead === true;
	return {
		seatId: isString(o.seatId) && o.seatId ? o.seatId : `s${n}`,
		name: isString(o.name) ? o.name : '',
		guess: isString(o.guess) && o.guess ? o.guess : undefined,
		dead,
		ghostVoteUsed: dead && o.ghostVoteUsed === true,
		note: isString(o.note) ? o.note : ''
	};
}

/**
 * Reads a stored notebook of any known version. Returns undefined for data it cannot
 * understand (a newer schema, or not a notebook), so the caller starts a fresh one rather
 * than losing the player's notes by overwriting them silently.
 */
export function migrateNotebook(raw: unknown): PlayerNotebook | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	const version = o.schemaVersion;
	if ((version !== 1 && version !== 2) || !isString(o.scriptKey)) return undefined;
	const rawSeats = Array.isArray(o.seats) ? o.seats.slice(0, MAX_SEATS) : [];
	const seats = rawSeats.map((s, i) => readSeat(s, i + 1));
	while (seats.length < MIN_SEATS) seats.push(newSeat(nextSeatNumber(seats)));
	const me = isString(o.me) && seats.some((s) => s.seatId === o.me) ? o.me : undefined;
	return {
		schemaVersion: NOTEBOOK_VERSION,
		scriptKey: o.scriptKey,
		seats,
		me,
		notes:
			version === 1
				? [{ noteId: 'n1', title: '', text: isString(o.notes) ? o.notes : '' }]
				: readNotes(o.notes),
		updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0
	};
}

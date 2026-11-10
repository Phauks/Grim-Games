/**
 * A players-only game's town on this phone (plan M55): the Grim tab and the Notes tab read the
 * same one, so a seat named on one shows on the other at once. One town per notebook key
 * (the script, or a saved script), kept in localStorage beside the guesses.
 */
import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
import {
	localPublicSeats,
	parseLocalTown,
	startingTown,
	type LocalTown
} from '#lib/core/town/local-town.ts';
import type { LoadedScript } from '#lib/core/data/index.ts';
import type { SavedScript } from '#lib/features/scripts/saved-scripts.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { removePads } from '#lib/ui/scratch/scratch-store.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { forgetGuesses } from './grim-guesses.ts';
import { deleteNotebook } from './notebook-store.svelte.ts';
import { scriptKey } from './notebook.ts';
import { forgetPlayerReminders } from './player-reminders.ts';
import { forgetSeatNotes } from './seat-notes.svelte.ts';

const storeKey = (key: string) => `grim-games:play:town:${key}`;

/**
 * The notebook key /play keeps a script's notes and players-only town under, with no room:
 * official editions by id, saved scripts by their library id.
 */
export function localNotesKey(script: LoadedScript, saved: SavedScript | undefined): string {
	return !script.edition && saved && saved.scriptId !== 'unsaved'
		? `saved:${saved.scriptId}`
		: scriptKey(script);
}

/** The towns changed since they were read, so every reader follows them. */
const changed: Record<string, LocalTown> = $state({});

/** Where a players-only game's guesses, reminders and seat notes are kept. */
export const localGuessKey = (notesKey: string) => `local:${notesKey}`;

/** The town this phone keeps for `notesKey`, or none before the player opened or changed it. */
export function keptLocalTown(notesKey: string): LocalTown | undefined {
	if (changed[notesKey]) return changed[notesKey];
	const stored = readStored(storeKey(notesKey));
	return stored === undefined ? undefined : parseLocalTown(stored);
}

/**
 * The town as the Grim tab shows it: the kept one, or seven empty seats to start (also for a
 * town an older build kept with None).
 */
export function localTown(notesKey: string): LocalTown {
	const kept = keptLocalTown(notesKey);
	return kept?.seats.length ? kept : startingTown();
}

export function saveLocalTown(notesKey: string, town: LocalTown): void {
	changed[notesKey] = town;
	writeStored(storeKey(notesKey), town);
}

export const localSeats = (notesKey: string): PublicSeat[] => localPublicSeats(localTown(notesKey));

/**
 * The seats of a town this phone keeps, for Notes: none while /play only shows a script, so
 * reading one adds no seats to its notes until a players-only game starts or a seat changes.
 */
export const keptLocalSeats = (notesKey: string): PublicSeat[] => {
	const kept = keptLocalTown(notesKey);
	return kept ? localPublicSeats(kept) : [];
};

/**
 * Where each players-only town came from, so Join game can list it and open it again (Trevor,
 * 2026-11-05: "they should also show up differently in the resume game area"): its script's
 * name, the edition or saved script to load, and when /play last showed it.
 */
export interface LocalTownVisit {
	key: string;
	name: string;
	edition?: string;
	scriptId?: string;
	at: number;
}

const VISITS_KEY = 'grim-games:play:towns';
/** Plenty for a phone; the oldest drop off. */
const MAX_VISITS = 30;

function parseVisits(raw: unknown): LocalTownVisit[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((v): LocalTownVisit[] => {
		if (typeof v !== 'object' || v === null) return [];
		const { key, name, edition, scriptId, at } = v as Record<string, unknown>;
		if (typeof key !== 'string' || typeof name !== 'string' || typeof at !== 'number') return [];
		return [
			{
				key,
				name,
				at,
				...(typeof edition === 'string' ? { edition } : {}),
				...(typeof scriptId === 'string' ? { scriptId } : {})
			}
		];
	});
}

let visits = $state<LocalTownVisit[] | undefined>();

/** Every players-only town this phone has opened, newest first. */
export function localTownVisits(): LocalTownVisit[] {
	return visits ?? parseVisits(readStored(VISITS_KEY));
}

/** /play showed `visit.key`'s town: it moves to the top of Join game's list. */
export function recordLocalVisit(visit: LocalTownVisit): void {
	const rest = localTownVisits().filter((v) => v.key !== visit.key);
	visits = [visit, ...rest].slice(0, MAX_VISITS);
	writeStored(VISITS_KEY, visits);
}

/**
 * A new players-only game on `notesKey`'s script: a clear board of seven empty seats, with the
 * last game's guesses, reminders and seat notes taken off (Trevor, 2026-11-10: a new game on
 * the same script kept the old board). The Notes tab's notes and scratch pads go too ("they
 * are usually associated with actions in a game").
 */
export async function startLocalTown(notesKey: string): Promise<void> {
	const kept = localGuessKey(notesKey);
	forgetGuesses(kept);
	forgetPlayerReminders(kept);
	forgetSeatNotes(kept);
	saveLocalTown(notesKey, startingTown());
	for (const result of await Promise.allSettled([
		deleteNotebook(notesKey),
		removePads(`player:${notesKey}`)
	]))
		if (result.status === 'rejected') reportError(result.reason, { area: 'play', notify: false });
}

/** Opened from New game or Join game: /play turns to its Grim tab, where the town is. */
let grimRequested = false;
export const openOnGrim = {
	request(): void {
		grimRequested = true;
	},
	/** Whether /play should open on Grim, which this answers once. */
	take(): boolean {
		const asked = grimRequested;
		grimRequested = false;
		return asked;
	}
};

/** Removes a players-only town from this phone: its seats and its place in Join game's list. */
export function forgetLocalTown(notesKey: string): void {
	delete changed[notesKey];
	writeStored(storeKey(notesKey), undefined);
	visits = localTownVisits().filter((v) => v.key !== notesKey);
	writeStored(VISITS_KEY, visits);
}

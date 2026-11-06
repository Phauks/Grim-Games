/**
 * A players-only game's town on this phone (plan M55): the Grim tab and the Notes tab read the
 * same one, so a seat named on one shows on the other at once. One town per notebook key
 * (the script, or a saved script), kept in localStorage beside the guesses.
 */
import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
import { localPublicSeats, parseLocalTown, type LocalTown } from '#lib/core/town/local-town.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const storeKey = (key: string) => `grim-games:play:town:${key}`;

/** The towns changed since they were read, so every reader follows them. */
const changed: Record<string, LocalTown> = $state({});

/** Where a players-only game's guesses, reminders and seat notes are kept. */
export const localGuessKey = (notesKey: string) => `local:${notesKey}`;

export function localTown(notesKey: string): LocalTown {
	return changed[notesKey] ?? parseLocalTown(readStored(storeKey(notesKey)));
}

export function saveLocalTown(notesKey: string, town: LocalTown): void {
	changed[notesKey] = town;
	writeStored(storeKey(notesKey), town);
}

export const localSeats = (notesKey: string): PublicSeat[] => localPublicSeats(localTown(notesKey));

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

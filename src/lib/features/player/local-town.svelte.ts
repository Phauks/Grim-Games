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

import { reportError } from '#lib/features/errors/report.svelte.ts';
import { removePads } from '#lib/ui/scratch/scratch-store.svelte.ts';
import { forgetGuesses } from './grim-guesses.ts';
import { deleteNotebook } from './notebook-store.svelte.ts';
import { forgetSeatNotes } from './seat-notes.svelte.ts';

/**
 * The notebook the grim cover's Player view keeps a player's notes, scratch pads, seat notes
 * and guesses in, on the Storyteller's device. It is never the Storyteller's own, and it starts
 * blank each time, since the device is handed round the table (Trevor, 2026-10-27: "Blank each
 * time").
 */
export const tableNotebook = (gameId: string) => `cover:${gameId}`;

/** Throws the table notebook away: before the Player view opens and after it closes. */
export async function forgetTableNotebook(gameId: string): Promise<void> {
	const key = tableNotebook(gameId);
	forgetSeatNotes(key);
	forgetGuesses(key);
	for (const result of await Promise.allSettled([deleteNotebook(key), removePads(`player:${key}`)]))
		if (result.status === 'rejected') reportError(result.reason, { area: 'play', notify: false });
}

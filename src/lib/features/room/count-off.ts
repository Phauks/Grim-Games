/**
 * Ending a count off on the Storyteller's device (plan J40): Done puts the numbers' order and
 * names on the board as one undoable step, Cancel leaves the board as it was. The count off's
 * dialog and the Seating mode's Done (Trevor, 2026-10-31) both end it here.
 */
import type { Command } from '#lib/core/engine/index.ts';
import { countOffSeats } from '#lib/core/sync/room.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { roomHost } from './host.svelte.ts';

/** Runs the count off on the board and ends it; false when there is none or the board refused. */
export function finishCountOff(game: OpenGame, run?: (command: Command) => boolean): boolean {
	const host = roomHost();
	const view = host.countOff;
	if (!view) return false;
	const seats = countOffSeats(game.game.seating, game.game.seats, view);
	const command: Command = { type: 'CountOff', seats };
	if (!(run ? run(command) : game.run(command).ok)) return false;
	host.send({ type: 'end-count-off' });
	return true;
}

/** Ends the count off with the board as it was. */
export function cancelCountOff(): void {
	const host = roomHost();
	if (host.countOff) host.send({ type: 'end-count-off' });
}

/**
 * The Seating mode (Trevor, 2026-10-31: arrange seats, open and lock seating, and count off
 * "are all very similar toolings", so one tool). On the board it is arranging seats
 * (seat-arranging.svelte.ts) with the room's seating along the bottom (SeatingBar): entering it
 * with a room open lets phones move their seats ("switch starts on"), and Done locks seating,
 * finishes a count off, and goes back to Character selection when it was opened from there.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { GameId } from '#lib/core/model/index.ts';
import { finishCountOff } from '#lib/features/room/count-off.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import type { SeatArranging } from './seat-arranging.svelte.ts';

/** A game whose board should open in Seating, from its Character selection. */
let fromSetup = $state<GameId>();
let backToSetup: GameId | undefined;

/** Opens the board of `gameId` in Seating; Done comes back to its Character selection. */
export async function seatingFromSetup(gameId: GameId): Promise<void> {
	fromSetup = gameId;
	await goto(resolve('/grimoire/[gameId]', { gameId }));
}

/** Whether the board of `gameId` was asked to open in Seating, which this answers once. */
export function seatingRequested(gameId: GameId): boolean {
	if (fromSetup !== gameId) return false;
	fromSetup = undefined;
	backToSetup = gameId;
	return true;
}

/** Turns on letting phones move their seats, or off. */
export function letPhonesMove(open: boolean): void {
	const host = roomHost();
	if (host.code) host.send({ type: 'seating', open });
}

export function enterSeating(seatArr: SeatArranging): void {
	seatArr.start();
	if (!roomHost().seatingOpen) letPhonesMove(true);
}

/** Done: locks seating, puts a count off on the board, and leaves Seating. */
export function leaveSeating(seatArr: SeatArranging, grimoire: Grimoire): void {
	const host = roomHost();
	if (host.countOff) finishCountOff(grimoire.open, (command) => grimoire.run(command));
	if (host.seatingOpen) letPhonesMove(false);
	seatArr.arranging = false;
	const back = backToSetup;
	backToSetup = undefined;
	if (back === grimoire.game.gameId)
		void goto(resolve('/grimoire/[gameId]/setup', { gameId: back }));
}

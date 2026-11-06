/**
 * The Seating mode (Trevor, 2026-10-31: arrange seats, open and lock seating, and count off
 * "are all very similar toolings", so one tool). On the board it is arranging seats
 * (seat-arranging.svelte.ts) with the room's seating beside it in the top bar (BoardToolbar;
 * Trevor, 2026-11-01: "all look similar"): entering it
 * with a room open lets phones move their seats ("switch starts on"), and Done locks seating,
 * finishes a count off, and goes back to Character selection or the bag draw when it was opened
 * from there.
 * Unlock seating and Count off work before anyone has joined: they open the room first (Trevor,
 * 2026-11-02: "Even if no one is in the room yet").
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { GameId } from '#lib/core/model/index.ts';
import type { ClientMessage } from '#lib/core/sync/room.ts';
import { finishCountOff } from '#lib/features/room/count-off.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import { playersDialog } from '#lib/features/room/players-dialog.svelte.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import type { SeatArranging } from './seat-arranging.svelte.ts';

/** The setup screen Seating was opened from, which its Done goes back to. */
export type SeatingFrom = 'setup' | 'draw';

/** A game whose board should open in Seating, and the setup screen it was opened from. */
let requested = $state<{ gameId: GameId; from: SeatingFrom }>();
let backTo: { gameId: GameId; from: SeatingFrom } | undefined;

/** Opens the board of `gameId` in Seating; Done comes back to the screen `from`. */
export async function seatingFromSetup(gameId: GameId, from: SeatingFrom): Promise<void> {
	requested = { gameId, from };
	await goto(resolve('/grimoire/[gameId]', { gameId }));
}

/** Whether `url` is the board that `gameId`'s Seating is about to open on (not leaving setup). */
export function openingSeating(gameId: GameId, url: URL): boolean {
	return requested?.gameId === gameId && url.pathname === resolve('/grimoire/[gameId]', { gameId });
}

/** Whether the board of `gameId` was asked to open in Seating, which this answers once. */
export function seatingRequested(gameId: GameId): boolean {
	if (requested?.gameId !== gameId) return false;
	backTo = requested;
	requested = undefined;
	return true;
}

/** Sends `message` to the room, opening one first when this device has none. */
function sendInRoom(message: ClientMessage): void {
	const host = roomHost();
	if (host.send(message)) return;
	host.prepare();
	const stop = $effect.root(() => {
		$effect(() => {
			if (host.status !== 'open') return;
			host.send(message);
			queueMicrotask(stop);
		});
	});
}

/** Turns on letting phones move their seats, or off. */
export function letPhonesMove(open: boolean): void {
	sendInRoom({ type: 'seating', open });
}

/** Count off: starts one if none is running, and opens its sheet. */
export function countOff(): void {
	if (!roomHost().countOff) sendInRoom({ type: 'count-off' });
	playersDialog.countOff = true;
}

/** Enters Seating; with a room open, phones may move their seats straight away. */
export function enterSeating(seatArr: SeatArranging): void {
	seatArr.start();
	if (roomHost().code && !roomHost().seatingOpen) letPhonesMove(true);
}

/** Done: locks seating, puts a count off on the board, and leaves Seating. */
export function leaveSeating(seatArr: SeatArranging, grimoire: Grimoire): void {
	const host = roomHost();
	if (host.countOff) finishCountOff(grimoire.open, (command) => grimoire.run(command));
	if (host.seatingOpen) host.send({ type: 'seating', open: false });
	seatArr.arranging = false;
	const back = backTo;
	backTo = undefined;
	if (back?.gameId !== grimoire.game.gameId) return;
	const { gameId } = back;
	void goto(
		back.from === 'draw'
			? resolve('/grimoire/[gameId]/draw', { gameId })
			: resolve('/grimoire/[gameId]/setup', { gameId })
	);
}

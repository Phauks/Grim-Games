/**
 * Room transfer (Trevor, 2026-10-28): the Storyteller's device hands its live room to another
 * device, so the players stay in it. The Storyteller's device shows a six-digit transfer code;
 * the other device types the room code on Join game, then the transfer code (⋯ Room transfer),
 * and becomes the room's Storyteller. The room holds only the code's hash, for five minutes and
 * three wrong tries. Split from `room.ts`.
 */
import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
import type { RoomState } from './room.ts';

/** Digits in a transfer code, as many as a room code (Trevor, 2026-10-28). */
export const TRANSFER_CODE_LENGTH = 6;
/** How long a transfer code works. */
export const TRANSFER_MS = 5 * 60 * 1000;
/** Wrong codes, from any device, that end a transfer. */
export const TRANSFER_TRIES = 3;

/** An open transfer, as the room stores it. */
export interface RoomTransfer {
	/** SHA-256 (hex) of the transfer code. */
	codeHash: string;
	/** When it stops working (epoch ms, the room's clock). */
	endsAt: number;
	/** Wrong codes so far. */
	tries: number;
	/** The game on the table goes to the new Storyteller's device with the room. */
	bringGame: boolean;
}

/** What the Storyteller's device sees of its open transfer (`HostView.transfer`, hostView). */
export interface TransferStatus {
	endsAt: number;
	tries: number;
}

/** What a device that typed the right code is shown before it takes over (`TransferView`). */
export interface TransferDetails {
	/** The Storyteller's name on the game, when it has one. */
	storyteller?: string;
	/** Players with a seat. */
	players: number;
	/** Where the game is up to, when it comes with the room; absent for a new game. */
	game?: { phase?: PlayersPhase };
}

/** A six-digit code from `random` (0 ≤ r < 1), zero-padded. */
export function makeTransferCode(random: () => number): string {
	return String(Math.floor(random() * 10 ** TRANSFER_CODE_LENGTH)).padStart(
		TRANSFER_CODE_LENGTH,
		'0'
	);
}

const HASH = /^[0-9a-f]{64}$/;

/**
 * Opens a transfer with this code's hash, replacing any open one (the Storyteller changed a
 * switch, or made a new code). A malformed message changes nothing.
 */
export function openTransfer(
	room: RoomState,
	codeHash: unknown,
	bringGame: unknown,
	now: number
): RoomState {
	if (typeof codeHash !== 'string' || !HASH.test(codeHash)) return room;
	const same = room.transfer?.codeHash === codeHash;
	const transfer: RoomTransfer = {
		codeHash,
		endsAt: same ? room.transfer!.endsAt : now + TRANSFER_MS,
		tries: same ? room.transfer!.tries : 0,
		bringGame: bringGame === true
	};
	return { ...room, transfer };
}

/** Ends the open transfer, if any. */
export function closeTransfer(room: RoomState): RoomState {
	if (!room.transfer) return room;
	const { transfer: _gone, ...rest } = room;
	void _gone;
	return rest;
}

/** The open transfer, while it still works. */
export function liveTransfer(room: RoomState, now: number): RoomTransfer | undefined {
	const transfer = room.transfer;
	return transfer && now < transfer.endsAt && transfer.tries < TRANSFER_TRIES
		? transfer
		: undefined;
}

export type TransferCheck =
	{ ok: true; room: RoomState } | { ok: false; room: RoomState; triesLeft: number };

/**
 * Checks a typed code's hash. A wrong one counts a try, and the third ends the transfer, so
 * a million codes can't be guessed; with no live transfer, nothing is counted.
 */
export function checkTransfer(room: RoomState, codeHash: unknown, now: number): TransferCheck {
	const transfer = liveTransfer(room, now);
	if (!transfer) return { ok: false, room: closeTransfer(room), triesLeft: 0 };
	if (codeHash === transfer.codeHash) return { ok: true, room };
	const tries = transfer.tries + 1;
	const triesLeft = TRANSFER_TRIES - tries;
	const next = triesLeft > 0 ? { ...room, transfer: { ...transfer, tries } } : closeTransfer(room);
	return { ok: false, room: next, triesLeft };
}

/** What the device taking over is told, once its code is right. */
export function transferDetails(room: RoomState): TransferDetails {
	const details: TransferDetails = {
		players: room.members.filter((m) => m.seatId !== undefined).length
	};
	const storyteller = room.public?.storytellerName?.trim();
	if (storyteller) details.storyteller = storyteller;
	if (room.transfer?.bringGame) details.game = room.public?.now ? { phase: room.public.now } : {};
	return details;
}

/**
 * The room changes hands: `keyHash` (the new device's host key) is now the Storyteller's, and
 * the old key stops working. What belonged to the old Storyteller goes: Grim view (its
 * password was theirs) and players' messages (written to them).
 */
export function completeTransfer(room: RoomState, keyHash: string): RoomState {
	const {
		transfer: _done,
		viewerKeyHash: _viewers,
		viewerPassword: _password,
		messages: _messages,
		...rest
	} = room;
	void _done;
	void _viewers;
	void _password;
	void _messages;
	return { ...rest, hostKeyHash: keyHash };
}

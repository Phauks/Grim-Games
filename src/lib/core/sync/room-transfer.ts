/**
 * Room transfer (Trevor, 2026-10-28): the Storyteller's device hands its live room to another
 * device, so the players stay in it. The Storyteller's device shows an eight-digit transfer code;
 * the other device types the room code on Join game, then the transfer code (⋯ Room transfer),
 * and asks to take over; the Storyteller's device allows it (Trevor, 2026-10-28: "so that
 * someone cannot just take the room without consent"), and the other device becomes the room's
 * Storyteller. The room holds only the code's hash, for two minutes (Trevor, 2026-11-01) and three wrong tries.
 * Split from `room.ts`.
 */
import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
import type { RoomState } from './room.ts';

/**
 * Digits in a transfer code: more than a room code's six, so the two never look alike (Trevor,
 * 2026-10-28: "8 digits, not 6, so it looks different from a room code").
 */
export const TRANSFER_CODE_LENGTH = 8;
/** How long a transfer code works. */
export const TRANSFER_MS = 2 * 60 * 1000;
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
	/** A device with the right code asking to take over, until the Storyteller answers. */
	asking?: TransferAsk;
	/**
	 * The friend in the room the Storyteller handed it to (plan F14), by account: that
	 * account's signed-in device may take over with no code (`offeredTransfer`).
	 */
	offeredTo?: string;
}

/** A device asking to take the room over: its new host key's hash, and its Profile name. */
export interface TransferAsk {
	keyHash: string;
	name?: string;
}

/** What the Storyteller's device sees of its open transfer (`HostView.transfer`, hostView). */
export interface TransferStatus {
	endsAt: number;
	tries: number;
	/**
	 * A device asks to take over: the Storyteller's device asks to allow it, showing the
	 * asker's match check (`transferCheck`).
	 */
	asking?: { name?: string; check?: string };
	/** The account of the friend it was handed to (plan F14), so their row says so. */
	offered?: string;
}

/** Digits in a transfer's match check. */
export const TRANSFER_CHECK_LENGTH = 4;

/**
 * The match check (Trevor, 2026-10-31, after asking whether a transfer could be spoofed): a
 * short number from the asking device's host key hash, shown on that device and in the
 * Storyteller's Allow prompt. A Profile name can be anyone's; the check only matches on the
 * device that really asked, so the Storyteller allows it only when the two screens agree.
 */
export function transferCheck(keyHash: string): string {
	const n = parseInt(keyHash.slice(0, 8), 16) % 10 ** TRANSFER_CHECK_LENGTH;
	return String(Number.isNaN(n) ? 0 : n).padStart(TRANSFER_CHECK_LENGTH, '0');
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

/** A transfer code from `random` (0 ≤ r < 1), zero-padded. */
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
	if (same && room.transfer!.asking) transfer.asking = room.transfer!.asking;
	if (same && room.transfer!.offeredTo) transfer.offeredTo = room.transfer!.offeredTo;
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

const MAX_NAME = 40;

/**
 * A device with the right code asks to take over (`keyHash`, its new host key's hash). A later
 * ask replaces an earlier one; the Storyteller's device sees the latest.
 */
export function askTransfer(room: RoomState, keyHash: string, name: unknown): RoomState {
	if (!room.transfer) return room;
	const asking: TransferAsk = { keyHash };
	const trimmed = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '';
	if (trimmed) asking.name = trimmed;
	return { ...room, transfer: { ...room.transfer, asking } };
}

/**
 * The Storyteller hands the live transfer to a friend in the room (plan F14), replacing any
 * earlier one; the worker checks first that they are friends and here. With no live transfer
 * or no account, nothing changes.
 */
export function offerTransfer(room: RoomState, accountId: unknown, now: number): RoomState {
	const transfer = liveTransfer(room, now);
	if (!transfer || typeof accountId !== 'string' || !accountId) return room;
	return { ...room, transfer: { ...transfer, offeredTo: accountId } };
}

/**
 * Whether the device signed in as `accountId` may take the room with no code: the live
 * transfer was handed to that account. A device signed out never may.
 */
export function offeredTransfer(
	room: RoomState,
	accountId: string | undefined,
	now: number
): boolean {
	return !!accountId && liveTransfer(room, now)?.offeredTo === accountId;
}

/** The Storyteller said no, or the asking device went: the transfer stays open, unasked. */
export function dropAsk(room: RoomState): RoomState {
	if (!room.transfer?.asking) return room;
	const { asking: _asked, ...transfer } = room.transfer;
	void _asked;
	return { ...room, transfer };
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

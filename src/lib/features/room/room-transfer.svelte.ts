/**
 * Room transfer (Trevor, 2026-10-28), the devices' side of core/sync/room-transfer.ts. The
 * Storyteller's device opens a transfer and shows its code (`roomTransfer`); another device
 * types the room code on Join game, then the transfer code (`RoomClaim`), and becomes the
 * room's Storyteller. The players stay in the room, and the game comes too when it is brought.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { buildInfo } from '#lib/build-info.ts';
import { sha256Hex } from '#lib/core/codes/hash.ts';
import { migrateSavedGame } from '#lib/core/engine/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import {
	makeTransferCode,
	ROOM_PROTOCOL,
	TRANSFER_CODE_LENGTH,
	type ServerMessage,
	type SharedGrimoire,
	type TransferDetails
} from '#lib/core/sync/room.ts';
import { gameStore } from '#lib/features/game/session.svelte.ts';
import {
	parseReminderCopyIds,
	parseReminderSpots,
	reminderCopyIds,
	reminderSpots,
	seatLayouts
} from '#lib/features/grimoire/device-notes.ts';
import { parseSeatLayout } from '#lib/ui/seating/seat-layout.ts';
import { roomHost } from './host.svelte.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';

/** The Storyteller's side: the open transfer's code and its switches, on this device only. */
class RoomTransferHost {
	/** The code shown while a transfer is open ("730 518"). */
	code = $state<string>();
	bringGame = $state(false);
	/** This device joins the room as a player once it is handed over. */
	joinAsPlayer = $state(true);
	#codeHash: string | undefined;

	constructor() {
		roomHost().onMessage = (message) => this.#heard(message);
	}

	/** Opens a transfer with a new code; false when the room can't be reached. */
	async start(): Promise<boolean> {
		const code = makeTransferCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
		this.#codeHash = await sha256Hex(code);
		if (!this.#send()) return false;
		this.code = `${code.slice(0, 3)} ${code.slice(3)}`;
		return true;
	}

	/** Brings the game with the room, or not; the code stays the same. */
	setBringGame(on: boolean): void {
		this.bringGame = on;
		this.#send();
	}

	stop(): void {
		roomHost().send({ type: 'close-transfer' });
		this.#reset();
	}

	#send(): boolean {
		const host = roomHost();
		if (!this.#codeHash) return false;
		host.sendingGame = this.bringGame;
		return host.send({
			type: 'open-transfer',
			codeHash: this.#codeHash,
			bringGame: this.bringGame
		});
	}

	#reset(): void {
		this.code = undefined;
		this.#codeHash = undefined;
		roomHost().sendingGame = false;
	}

	#heard(message: ServerMessage): void {
		// The room no longer has this transfer: it ran out, or wrong codes ended it.
		if (message.type === 'host-view' && !message.transfer && this.code) this.#reset();
		if (message.type !== 'handed-over') return;
		const room = roomHost().code;
		this.#reset();
		// The board stays; this device carries on as a player in the same room if asked.
		if (this.joinAsPlayer && room) void goto(resolve('/join/[code]', { code: room }));
	}
}

let transferHost: RoomTransferHost | undefined;

/** This device's side of a Room transfer as the room's Storyteller. */
export function roomTransfer(): RoomTransferHost {
	transferHost ??= new RoomTransferHost();
	return transferHost;
}

/** Why a typed transfer code was turned down: wrong (with tries left), or none is open. */
export type ClaimProblem = { kind: 'wrong'; triesLeft: number } | { kind: 'none' };

/** The other side: a device typing the transfer code for room `roomCode`. */
export class RoomClaim {
	/** What comes with the room, once the code is right. */
	details = $state.raw<TransferDetails>();
	problem = $state.raw<ClaimProblem>();
	taking = $state(false);
	readonly #roomCode: string;
	readonly #key = randomKey();
	readonly #socket: RoomSocket;
	#code = '';
	#taken: ((gameId: GameId | undefined) => void) | undefined;

	constructor(roomCode: string) {
		this.#roomCode = roomCode;
		this.#socket = new RoomSocket(
			roomCode,
			{
				type: 'hello',
				role: 'claim',
				key: this.#key,
				protocol: ROOM_PROTOCOL,
				builtAt: buildInfo.builtAt
			},
			(m) => void this.#heard(m),
			// A code typed before the socket opened (or while it reconnected) is checked now.
			() => this.#send()
		);
	}

	/** Checks a whole code; a shorter one clears what an earlier one said. */
	check(code: string): void {
		this.#code = code;
		this.details = undefined;
		this.problem = undefined;
		this.#send();
	}

	#send(): void {
		if (this.#code.length === TRANSFER_CODE_LENGTH) {
			this.#socket.send({ type: 'check-transfer', code: this.#code });
		}
	}

	/**
	 * Takes the room: this device becomes its Storyteller, with the game when it comes along.
	 * Resolves with that game's id (undefined for a new game), or rejects when it can't.
	 */
	take(): Promise<GameId | undefined> {
		return new Promise((done, fail) => {
			if (!this.details || !this.#socket.send({ type: 'take-room', code: this.#code })) {
				fail(new Error('Not connected'));
				return;
			}
			this.taking = true;
			this.#taken = done;
		});
	}

	stop(): void {
		this.#socket.stop();
	}

	async #heard(message: ServerMessage): Promise<void> {
		if (message.type === 'transfer') this.details = message.details;
		else if (message.type === 'transfer-refused') {
			this.taking = false;
			this.details = undefined;
			this.problem =
				message.triesLeft > 0 ? { kind: 'wrong', triesLeft: message.triesLeft } : { kind: 'none' };
		} else if (message.type === 'transferred') {
			this.#socket.stop();
			const gameId = message.grimoire ? await keepGame(message.grimoire) : undefined;
			roomHost().adopt(this.#roomCode, this.#key);
			this.#taken?.(gameId);
		}
	}
}

/**
 * Saves the game that came with the room on this device, under its own id so the players'
 * seats, notes and guesses carry on, with where the old device drew its seats and reminders.
 * Undefined when this build can't read it (saved by a newer one): the room comes alone.
 */
async function keepGame(grimoire: SharedGrimoire): Promise<GameId | undefined> {
	try {
		const saved = migrateSavedGame(grimoire.saved);
		await gameStore().save(saved);
		const gameId = saved.gameId as GameId;
		if (grimoire.layout !== undefined) seatLayouts.write(gameId, parseSeatLayout(grimoire.layout));
		reminderSpots.write(gameId, parseReminderSpots(grimoire.reminderSpots));
		reminderCopyIds.write(gameId, parseReminderCopyIds(grimoire.copies));
		return gameId;
	} catch {
		return undefined;
	}
}

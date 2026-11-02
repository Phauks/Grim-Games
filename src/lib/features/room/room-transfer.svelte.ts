/**
 * Room transfer (Trevor, 2026-10-28), the devices' side of core/sync/room-transfer.ts. The
 * Storyteller's device opens a transfer and shows its code (`roomTransfer`); another device
 * types the room code on Join game, then the transfer code (`RoomClaim`), and asks to take
 * over; once the Storyteller's device allows it (`answer`), it is the room's Storyteller and the
 * old device is put out of the room. The players stay, and the game comes too when brought.
 * Or the Storyteller hands it to a friend in the room (`offer`, plan F14), whose phone opens
 * the same prompt with no code (`RoomClaim` with `offered`) and takes over at once.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { buildInfo } from '#lib/build-info.ts';
import { sha256Hex } from '#lib/core/codes/hash.ts';
import type { GameId } from '#lib/core/model/index.ts';
import {
	makeTransferCode,
	ROOM_PROTOCOL,
	transferCheck,
	TRANSFER_CODE_LENGTH,
	type ServerMessage,
	type TransferDetails
} from '#lib/core/sync/room.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { leaveWithoutAsking } from '#lib/features/shell/shell.ts';
import { keepGrimoire } from './board-notes.ts';
import { roomHost } from './host.svelte.ts';
import { playerName } from './player.svelte.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';

/** The Storyteller's side: the open transfer's code and its switches, on this device only. */
class RoomTransferHost {
	/** The code shown while a transfer is open ("7305 1842"). */
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
		const half = TRANSFER_CODE_LENGTH / 2;
		this.code = `${code.slice(0, half)} ${code.slice(half)}`;
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

	/**
	 * Hands the open transfer to a friend with a phone in the room, by account (plan F14);
	 * false when it can't be sent.
	 */
	offer(accountId: string): boolean {
		return roomHost().send({ type: 'offer-transfer', to: accountId });
	}

	/** Allows, or turns down, the device asking to take over; false when it can't be sent. */
	answer(allow: boolean): boolean {
		return roomHost().send({ type: 'answer-transfer', allow });
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
		if (message.type === 'transfer-offer-refused') toast(t('room.transfer.offerFailed'));
		if (message.type !== 'handed-over') return;
		const room = roomHost().code;
		this.#reset();
		// Put out of the room (Trevor, 2026-10-28: "when room transfer has occurred, force the
		// user out"): off the Storyteller's screens, into the room as a player if asked.
		toast(t('room.transfer.handedOver'));
		// The board's leave guard doesn't ask: Room transfer opens from the board's ⋯ menu.
		leaveWithoutAsking(
			() =>
				void goto(
					this.joinAsPlayer && room ? resolve('/join/[code]', { code: room }) : resolve('/')
				)
		);
	}
}

let transferHost: RoomTransferHost | undefined;

/** This device's side of a Room transfer as the room's Storyteller. */
export function roomTransfer(): RoomTransferHost {
	transferHost ??= new RoomTransferHost();
	return transferHost;
}

/**
 * Why a typed transfer code was turned down: wrong (with tries left), none is open, or the
 * Storyteller's device said no.
 */
export type ClaimProblem =
	{ kind: 'wrong'; triesLeft: number } | { kind: 'none' } | { kind: 'denied' };

/**
 * The other side: a device typing the transfer code for room `roomCode`, or, `offered`, one
 * whose signed-in account the Storyteller handed it to (plan F14), which types nothing.
 */
export class RoomClaim {
	/** What comes with the room, once the code is right. */
	details = $state.raw<TransferDetails>();
	problem = $state.raw<ClaimProblem>();
	taking = $state(false);
	/**
	 * This device's match check, the same number the Storyteller's Allow prompt shows for it
	 * (`transferCheck` of this device's host key hash).
	 */
	matchCheck = $state<string>();
	readonly #roomCode: string;
	readonly #offered: boolean;
	readonly #key = randomKey();
	readonly #socket: RoomSocket;
	#code = '';
	#taken: ((gameId: GameId | undefined) => void) | undefined;
	#denied: ((error: Error) => void) | undefined;

	constructor(roomCode: string, offered = false) {
		this.#roomCode = roomCode;
		this.#offered = offered;
		void sha256Hex(this.#key).then((hash) => (this.matchCheck = transferCheck(hash)));
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
		if (this.#offered) this.#socket.send({ type: 'check-transfer', offer: true });
		else if (this.#code.length === TRANSFER_CODE_LENGTH) {
			this.#socket.send({ type: 'check-transfer', code: this.#code });
		}
	}

	/**
	 * Asks to take the room; once the Storyteller's device allows it, this device becomes its
	 * Storyteller, with the game when it comes along. Resolves with that game's id (undefined
	 * for a new game), or rejects when it can't or was turned down (`problem` says which).
	 */
	take(): Promise<GameId | undefined> {
		return new Promise((done, fail) => {
			const name = playerName.current.trim();
			const message = {
				type: 'take-room' as const,
				...(this.#offered ? { offer: true as const } : { code: this.#code }),
				...(name ? { name } : {})
			};
			if (!this.details || !this.#socket.send(message)) {
				fail(new Error('Not connected'));
				return;
			}
			this.taking = true;
			this.problem = undefined;
			this.#taken = done;
			this.#denied = fail;
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
		} else if (message.type === 'transfer-denied') {
			// The code still works, so the details stay and Take over can ask again.
			this.taking = false;
			this.problem = { kind: 'denied' };
			this.#denied?.(new Error('Turned down'));
		} else if (message.type === 'transferred') {
			this.#socket.stop();
			const gameId = message.grimoire ? await keepGrimoire(message.grimoire) : undefined;
			roomHost().adopt(this.#roomCode, this.#key);
			this.#taken?.(gameId);
		}
	}
}

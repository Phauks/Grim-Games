/**
 * A player's phone in a live room (07-accounts-and-multi-device.md §4.2): it sees the
 * public table and asks the Storyteller for a name and a seat. The phone's key is its own
 * secret, kept on the device, so it is the same member when it comes back.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { ROOM_PROTOCOL, type PlayerView, type SharedGrimoire } from '#lib/core/sync/room.ts';
import { readStored, readStoredText, writeStored, writeStoredText } from '#lib/ui/stored.ts';
import { forgetRecentRoom, rememberRoom } from './recent-rooms.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';
import { travellersInPlay, type TravellerInPlay } from '#lib/features/player/travellers-in-play.ts';
import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';

const STORAGE_KEY = 'grim-games-room-player';

function deviceKey(): string {
	const stored = readStored<{ key: string }>(STORAGE_KEY);
	if (stored?.key) return stored.key;
	const key = randomKey();
	writeStored(STORAGE_KEY, { key });
	return key;
}

/** The last name this phone asked for, to fill the field next time. */
const NAME_KEY = 'grim-games-room-name';

/** The room this phone last joined, so /play's Room tab opens it again (Trevor, 2026-10-19). */
const LAST_ROOM_KEY = 'grim-games-room-last';

export function lastRoom(): string | undefined {
	return readStoredText(LAST_ROOM_KEY);
}

/**
 * What /play shows from the room this phone last joined (Trevor, 2026-10-19): who runs the
 * game, and the Travellers the town knows are in play. Kept on the device with the room's
 * code, and forgotten with the room.
 */
const TABLE_KEY = 'grim-games-room-table';

export interface RoomTable {
	storyteller?: string;
	travellers?: TravellerInPlay[];
}

function storedTable(code: string | undefined): RoomTable {
	const stored = readStored<RoomTable & { code: string }>(TABLE_KEY);
	if (!code || stored?.code !== code) return {};
	return { storyteller: stored.storyteller, travellers: stored.travellers };
}

/** The last room's table, while it is remembered. */
export const roomTable = $state<RoomTable>(storedTable(lastRoom()));

function setTable(code: string, table: RoomTable): void {
	if (JSON.stringify(table) === JSON.stringify($state.snapshot(roomTable))) return;
	roomTable.storyteller = table.storyteller;
	roomTable.travellers = table.travellers;
	const empty = !table.storyteller && !table.travellers?.length;
	writeStored(TABLE_KEY, empty ? undefined : { code, ...table });
}

/** Forgets the last room when it is `code` (it closed, or refused this phone). */
export function forgetRoom(code: string): void {
	forgetRecentRoom(code);
	if (lastRoom() !== code) return;
	writeStoredText(LAST_ROOM_KEY, undefined);
	setTable(code, {});
}

export class RoomPlayer {
	view = $state.raw<PlayerView>();
	/** The game's script, once the Storyteller's device has sent it. */
	script = $state.raw<Script>();
	/** The finished grimoire, once the Storyteller shares it after the game (plan R5). */
	revealed = $state.raw<{ gameId: string; grimoire: SharedGrimoire }>();
	readonly code: string;
	readonly #socket: RoomSocket;

	constructor(code: string) {
		this.code = code;
		writeStoredText(LAST_ROOM_KEY, code);
		rememberRoom(code);
		this.#socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'player', key: deviceKey(), protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'player-view') {
					this.view = m;
					// The game runs again, or a new one began: the finished grimoire goes.
					if (!m.ended) this.revealed = undefined;
					const storyteller = m.public?.storytellerName?.trim();
					const travellers = travellersInPlay(m.public?.seats ?? []);
					setTable(code, {
						...(storyteller ? { storyteller } : {}),
						...(travellers.length ? { travellers } : {})
					});
				} else if (m.type === 'script') this.script = m.script;
				else if (m.type === 'reveal') {
					this.revealed = { gameId: m.gameId, grimoire: m.grimoire };
				}
			},
			() => this.sendLook()
		);
	}

	/**
	 * Tells the room this phone's avatar and frame (plan R6) when they differ from what it
	 * has: on every connect, and when the player picks again.
	 */
	sendLook(): void {
		const { avatar, frame } = playerSettings.current;
		const me = this.view?.me;
		if (me && me.avatar === avatar && me.frame === frame) return;
		this.#socket.send({
			type: 'look',
			...(avatar ? { avatar } : {}),
			...(frame ? { frame } : {})
		});
	}

	get status() {
		return this.#socket.status;
	}

	get refusedReason() {
		return this.#socket.refusedReason;
	}

	get savedName(): string {
		return readStored<string>(NAME_KEY) ?? '';
	}

	/** Asks to sit in `seatId` (or anywhere) as `name`; replaces an earlier request. */
	ask(name: string, seatId?: SeatId): boolean {
		writeStored(NAME_KEY, name);
		return this.#socket.send(
			seatId ? { type: 'request', name, seatId } : { type: 'request', name }
		);
	}

	cancel(): void {
		this.#socket.send({ type: 'cancel-request' });
	}

	leaveSeat(): void {
		this.#socket.send({ type: 'leave-seat' });
	}

	/** A spectator's choice in the open vote (Specters); a new choice replaces the last. */
	vote(choice: SeatId): boolean {
		const voteId = this.view?.vote?.voteId;
		return voteId ? this.#socket.send({ type: 'vote', voteId, choice }) : false;
	}

	/** This phone's ballot in the script vote (plan R1); a new one replaces the last. */
	scriptBallot(choices: string[]): boolean {
		const voteId = this.view?.scriptVote?.voteId;
		return voteId ? this.#socket.send({ type: 'script-ballot', voteId, choices }) : false;
	}

	stop(): void {
		this.#socket.stop();
	}
}

/**
 * The live room players join from their phones (07-accounts-and-multi-device.md §4.2):
 * its stored state, the messages devices and the room exchange, and the pure rules the
 * `Room` Durable Object applies. Shared by the Worker and the app so both sides agree.
 *
 * The room holds public state only. Phones ask (a name, a seat); the Storyteller approves,
 * and only then does the grimoire change, through its own commands.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';

export const MAX_MEMBERS = 40;
export const MAX_PLAYER_NAME_LENGTH = 40;

/** A phone in the room, known by a short hash of its own secret key. */
export interface RoomMember {
	memberId: string;
	/** The name the Storyteller approved. */
	name?: string;
	/** The seat the Storyteller approved, in the current game. */
	seatId?: SeatId;
}

/** "Sit in this seat as this name", or just a name, waiting for the Storyteller. */
export interface RoomRequest {
	requestId: string;
	memberId: string;
	name: string;
	seatId?: SeatId;
	/** Milliseconds since the epoch. */
	at: number;
}

export interface RoomState {
	/** SHA-256 (hex) of the Storyteller's host key. */
	hostKeyHash: string;
	/** The game whose public state is shown; a new game clears everyone's seat. */
	gameId?: string;
	public?: PublicGameState;
	members: RoomMember[];
	/** At most one per member, oldest first. */
	requests: RoomRequest[];
}

export type ClientMessage =
	/** First message on every socket. Keys never go in the URL. */
	| { type: 'hello'; role: 'host' | 'player'; key: string }
	// From a player.
	| { type: 'request'; name: string; seatId?: SeatId }
	| { type: 'cancel-request' }
	| { type: 'leave-seat' }
	// From the Storyteller.
	| { type: 'publish'; gameId: string; state: PublicGameState }
	/** `seatId` puts the player in a different seat from the one they asked for. */
	| { type: 'resolve'; requestId: string; accept: boolean; seatId?: SeatId }
	| { type: 'unseat'; memberId: string }
	| { type: 'close' };

/** What the Storyteller's device sees. */
export interface HostView {
	type: 'host-view';
	members: RoomMember[];
	requests: RoomRequest[];
}

/** What one player's phone sees: the public table, and their own place in it. */
export interface PlayerView {
	type: 'player-view';
	public?: PublicGameState;
	me: RoomMember;
	request?: Pick<RoomRequest, 'name' | 'seatId'>;
	/** Seats someone in the room already sits in. */
	takenSeats: SeatId[];
}

export type ServerMessage =
	| HostView
	| PlayerView
	| { type: 'refused'; reason: 'no-room' | 'not-host' | 'room-full' }
	| { type: 'closed' };

export function newRoom(hostKeyHash: string): RoomState {
	return { hostKeyHash, members: [], requests: [] };
}

export function hostView(room: RoomState): HostView {
	return { type: 'host-view', members: room.members, requests: room.requests };
}

export function playerView(room: RoomState, memberId: string): PlayerView {
	const me = room.members.find((m) => m.memberId === memberId) ?? { memberId };
	const request = room.requests.find((r) => r.memberId === memberId);
	const view: PlayerView = {
		type: 'player-view',
		me,
		takenSeats: room.members.flatMap((m) => (m.seatId ? [m.seatId] : []))
	};
	if (room.public) view.public = room.public;
	if (request) {
		view.request = { name: request.name };
		if (request.seatId) view.request.seatId = request.seatId;
	}
	return view;
}

/** Adds a member on first hello; `null` when the room is full. */
export function join(room: RoomState, memberId: string): RoomState | null {
	if (room.members.some((m) => m.memberId === memberId)) return room;
	if (room.members.length >= MAX_MEMBERS) return null;
	return { ...room, members: [...room.members, { memberId }] };
}

export function cleanName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
	return name || null;
}

function seatExists(room: RoomState, seatId: SeatId): boolean {
	return room.public?.seats.some((s) => s.seatId === seatId) ?? false;
}

/** A player's request replaces any earlier one of theirs. Invalid requests change nothing. */
export function request(
	room: RoomState,
	memberId: string,
	raw: { name: unknown; seatId?: unknown },
	at: number,
	requestId: string
): RoomState {
	const name = cleanName(raw.name);
	if (!name || !room.members.some((m) => m.memberId === memberId)) return room;
	const next: RoomRequest = { requestId, memberId, name, at };
	if (raw.seatId !== undefined) {
		if (typeof raw.seatId !== 'string' || !seatExists(room, raw.seatId as SeatId)) return room;
		next.seatId = raw.seatId as SeatId;
	}
	return { ...room, requests: [...room.requests.filter((r) => r.memberId !== memberId), next] };
}

export function cancelRequest(room: RoomState, memberId: string): RoomState {
	return { ...room, requests: room.requests.filter((r) => r.memberId !== memberId) };
}

function setMember(room: RoomState, memberId: string, change: Partial<RoomMember>): RoomState {
	return {
		...room,
		members: room.members.map((m) => {
			if (m.memberId !== memberId) {
				// One phone per seat: taking a seat moves anyone else out of it.
				return change.seatId && m.seatId === change.seatId
					? { memberId: m.memberId, ...nameOf(m) }
					: m;
			}
			const updated: RoomMember = { ...m, ...change };
			if (change.seatId === undefined && 'seatId' in change) delete updated.seatId;
			return updated;
		})
	};
}

function nameOf(m: RoomMember): Pick<RoomMember, 'name'> {
	return m.name === undefined ? {} : { name: m.name };
}

/**
 * The Storyteller's answer. Accepting records the name (and seat); the Storyteller's own
 * device renames the seat in the grimoire, so the room only remembers who sits where.
 */
export function resolve(
	room: RoomState,
	requestId: string,
	accept: boolean,
	seatId?: SeatId
): RoomState {
	const found = room.requests.find((r) => r.requestId === requestId);
	if (!found) return room;
	const rest = { ...room, requests: room.requests.filter((r) => r.requestId !== requestId) };
	if (!accept) return rest;
	const change: Partial<RoomMember> = { name: found.name };
	const seat = seatId ?? found.seatId;
	if (seat && seatExists(room, seat)) change.seatId = seat;
	return setMember(rest, found.memberId, change);
}

export function unseat(room: RoomState, memberId: string): RoomState {
	return setMember(room, memberId, { seatId: undefined });
}

/**
 * New public state from the Storyteller. Seats that no longer exist lose their phone; a
 * different game clears every seat and every seat request, but names stay.
 */
export function publish(room: RoomState, gameId: string, state: PublicGameState): RoomState {
	const newGame = room.gameId !== undefined && room.gameId !== gameId;
	const seats = new Set(state.seats.map((s) => s.seatId));
	const keep = (seatId?: SeatId) => !newGame && seatId !== undefined && seats.has(seatId);
	return {
		...room,
		gameId,
		public: state,
		members: room.members.map((m) =>
			keep(m.seatId) || m.seatId === undefined ? m : { memberId: m.memberId, ...nameOf(m) }
		),
		requests: room.requests.map((r) => {
			if (r.seatId === undefined || keep(r.seatId)) return r;
			const { seatId: _gone, ...without } = r;
			void _gone;
			return without;
		})
	};
}

/** Parses a socket message; anything malformed is `null` and ignored. */
export function parseClientMessage(raw: string): ClientMessage | null {
	let message: unknown;
	try {
		message = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof message !== 'object' || message === null) return null;
	const type = (message as { type?: unknown }).type;
	return typeof type === 'string' ? (message as ClientMessage) : null;
}

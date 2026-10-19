/**
 * The live room players join from their phones (07-accounts-and-multi-device.md §4.2):
 * its stored state, the messages devices and the room exchange, and the pure rules the
 * `Room` Durable Object applies. Shared by the Worker and the app so both sides agree.
 *
 * The room holds public state only. Phones ask (a name, a seat); the Storyteller approves,
 * and only then does the grimoire change, through its own commands.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';

export const MAX_MEMBERS = 40;
export const MAX_PLAYER_NAME_LENGTH = 40;
/** A script's own characters (homebrew) carry their text and images, so it can be large. */
export const MAX_SCRIPT_BYTES = 256 * 1024;

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
	/** A spectators' vote the Storyteller has open (Specters), if any. */
	vote?: SpectatorVote;
}

/**
 * Specters (https://www.youtube.com/watch?v=-R34QbIgDh8): spectators share one ability and
 * vote on how it is used. A spectator is a member without a seat. The Storyteller opens a
 * vote with the seats it can pick, reads the tally, and decides; the room only counts.
 */
export interface SpectatorVote {
	voteId: string;
	options: SeatId[];
	/** What the vote is for, as the Storyteller set it: the shared ability. */
	ability?: string;
	/** One choice per spectator, by member id. */
	votes: Record<string, SeatId>;
}

/** At most this many options in a vote: one per seat. */
export const MAX_VOTE_OPTIONS = MAX_MEMBERS;
/** The longest ability text a vote carries. */
export const MAX_VOTE_ABILITY = 500;

/**
 * The room protocol this build speaks. The Worker updates the moment a build deploys, but an
 * open app keeps its build until the user taps Refresh, so the two can differ for hours.
 * Changes to these messages stay backward compatible (new optional fields only); when one
 * cannot, bump `ROOM_PROTOCOL` and raise `MIN_ROOM_PROTOCOL` so older apps are told to update.
 */
export const ROOM_PROTOCOL = 1;
/** The oldest protocol the room still accepts. */
export const MIN_ROOM_PROTOCOL = 1;

export type ClientMessage =
	/**
	 * First message on every socket. Keys never go in the URL. `protocol` is missing from
	 * apps built before it existed, which speak protocol 1.
	 */
	| { type: 'hello'; role: 'host' | 'player'; key: string; protocol?: number }
	// From a player.
	| { type: 'request'; name: string; seatId?: SeatId }
	| { type: 'cancel-request' }
	| { type: 'leave-seat' }
	/** A spectator's choice in the open vote; a new choice replaces the last. */
	| { type: 'vote'; voteId: string; choice: SeatId }
	// From the Storyteller.
	| { type: 'publish'; gameId: string; state: PublicGameState }
	/**
	 * The game's script, sent apart from `publish` and only when it changes: phones keep it as
	 * their current script, so players can read it before seats are assigned.
	 */
	| { type: 'script'; script: Script }
	/** `seatId` puts the player in a different seat from the one they asked for. */
	| { type: 'resolve'; requestId: string; accept: boolean; seatId?: SeatId }
	| { type: 'unseat'; memberId: string }
	| { type: 'open-vote'; voteId: string; options: SeatId[]; ability?: string }
	| { type: 'close-vote' }
	| { type: 'close' };

/** What the Storyteller's device sees. */
export interface HostView {
	type: 'host-view';
	members: RoomMember[];
	requests: RoomRequest[];
	/** The open vote's count of spectators' choices; absent when no vote is open. */
	vote?: VoteTally;
}

export interface VoteTally {
	voteId: string;
	options: SeatId[];
	/** Votes per option, every option listed. */
	counts: Record<SeatId, number>;
	/** Spectators who have voted. */
	voted: number;
	/** Spectators in the room (members without a seat). */
	spectators: number;
}

/** What one player's phone sees: the public table, and their own place in it. */
export interface PlayerView {
	type: 'player-view';
	public?: PublicGameState;
	me: RoomMember;
	request?: Pick<RoomRequest, 'name' | 'seatId'>;
	/** Seats someone in the room already sits in. */
	takenSeats: SeatId[];
	/** The open vote, shown to spectators only. */
	vote?: { voteId: string; options: SeatId[]; ability?: string; choice?: SeatId };
}

/** The game's script, sent to a phone when it joins and whenever the Storyteller changes it. */
export interface ScriptView {
	type: 'script';
	script: Script;
}

export type ServerMessage =
	| HostView
	| PlayerView
	| ScriptView
	| { type: 'refused'; reason: RefusedReason }
	| { type: 'closed' };

/** `too-old`: the app must update before it can use the room; the room itself is fine. */
export type RefusedReason = 'no-room' | 'not-host' | 'room-full' | 'too-old';

/**
 * What a phone sees of a room before it joins, from `GET /api/room/<code>` (Trevor,
 * 2026-10-19: type the code "and then it shows you what game you will be joining"). Only
 * what joining would show anyway: the script's name, author and logo, and the table's size.
 */
export interface RoomPreview {
	open: boolean;
	/** Once the Storyteller's device has sent the script. */
	script?: {
		name: string;
		author?: string;
		/** The author's `_meta.logo`, as given; the phone checks it before showing it. */
		logo?: string;
		/** No characters of its own, so an edition's name means that edition (and its logo). */
		official: boolean;
	};
	/** Seats at the table, once the Storyteller's device has published it. */
	seats?: number;
	/** Seats someone in the room sits in. */
	seated?: number;
}

export function roomPreview(room: RoomState | undefined, script?: Script): RoomPreview {
	if (!room) return { open: false };
	const preview: RoomPreview = { open: true };
	if (script) {
		const { name = '', author, logo } = script.meta ?? {};
		preview.script = {
			name,
			...(author ? { author } : {}),
			...(typeof logo === 'string' && logo ? { logo } : {}),
			official: script.entries.every((e) => e.kind === 'official')
		};
	}
	if (room.public) {
		preview.seats = room.public.seats.length;
		preview.seated = room.members.filter((m) => m.seatId).length;
	}
	return preview;
}

/**
 * A light shape check of a script from the Storyteller's device: the room only stores and
 * relays it, and each phone loads it through its own script loader.
 */
export function isScript(value: unknown): value is Script {
	if (typeof value !== 'object' || value === null) return false;
	const { entries } = value as { entries?: unknown };
	return (
		Array.isArray(entries) &&
		entries.every(
			(e) =>
				typeof e === 'object' &&
				e !== null &&
				((e.kind === 'official' && typeof e.id === 'string') ||
					(e.kind === 'custom' && typeof e.character === 'object' && e.character !== null))
		)
	);
}

/** True when the room still speaks the protocol of the app that said this hello. */
export function supportsProtocol(protocol: unknown): boolean {
	const version = protocol === undefined ? 1 : protocol;
	return typeof version === 'number' && Number.isInteger(version) && version >= MIN_ROOM_PROTOCOL;
}

export function newRoom(hostKeyHash: string): RoomState {
	return { hostKeyHash, members: [], requests: [] };
}

export function hostView(room: RoomState): HostView {
	const view: HostView = { type: 'host-view', members: room.members, requests: room.requests };
	if (room.vote) view.vote = tally(room, room.vote);
	return view;
}

const isSpectator = (m: RoomMember) => m.seatId === undefined;

function tally(room: RoomState, vote: SpectatorVote): VoteTally {
	const spectators = room.members.filter(isSpectator);
	const counts = Object.fromEntries(vote.options.map((o) => [o, 0])) as Record<SeatId, number>;
	let voted = 0;
	for (const m of spectators) {
		const choice = vote.votes[m.memberId];
		if (choice === undefined || !(choice in counts)) continue;
		counts[choice]++;
		voted++;
	}
	return {
		voteId: vote.voteId,
		options: vote.options,
		counts,
		voted,
		spectators: spectators.length
	};
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
	if (room.vote && isSpectator(me)) {
		const choice = room.vote.votes[memberId];
		view.vote = { voteId: room.vote.voteId, options: room.vote.options };
		if (room.vote.ability) view.vote.ability = room.vote.ability;
		if (choice !== undefined) view.vote.choice = choice;
	}
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
 * different game clears every seat, every seat request and any open vote, but names stay.
 */
export function publish(room: RoomState, gameId: string, state: PublicGameState): RoomState {
	const newGame = room.gameId !== undefined && room.gameId !== gameId;
	const seats = new Set(state.seats.map((s) => s.seatId));
	const keep = (seatId?: SeatId) => !newGame && seatId !== undefined && seats.has(seatId);
	// A vote belongs to its game.
	const base = newGame ? closeVote(room) : room;
	return {
		...base,
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

/**
 * Opens a spectators' vote, replacing any open one. Options must be seats at the table, each
 * once; a vote with none is not opened. `ability` (optional, added later) says what it is for.
 */
export function openVote(
	room: RoomState,
	voteId: unknown,
	options: unknown,
	ability?: unknown
): RoomState {
	if (typeof voteId !== 'string' || !voteId || !Array.isArray(options)) return room;
	const seats = [
		...new Set(
			options.filter((o): o is SeatId => typeof o === 'string' && seatExists(room, o as SeatId))
		)
	].slice(0, MAX_VOTE_OPTIONS);
	if (seats.length === 0) return room;
	const text = typeof ability === 'string' ? ability.trim().slice(0, MAX_VOTE_ABILITY) : '';
	return {
		...room,
		vote: { voteId, options: seats, votes: {}, ...(text ? { ability: text } : {}) }
	};
}

export function closeVote(room: RoomState): RoomState {
	if (!room.vote) return room;
	const { vote: _closed, ...rest } = room;
	void _closed;
	return rest;
}

/** A spectator's vote in the open vote; anything else (a seated player, a stale vote) is ignored. */
export function castVote(
	room: RoomState,
	memberId: string,
	voteId: unknown,
	choice: unknown
): RoomState {
	const vote = room.vote;
	const member = room.members.find((m) => m.memberId === memberId);
	if (!vote || !member || !isSpectator(member) || voteId !== vote.voteId) return room;
	if (typeof choice !== 'string' || !vote.options.includes(choice as SeatId)) return room;
	return { ...room, vote: { ...vote, votes: { ...vote.votes, [memberId]: choice as SeatId } } };
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

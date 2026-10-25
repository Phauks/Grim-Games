/**
 * The live room players join from their phones (07-accounts-and-multi-device.md §4.2):
 * its stored state, the messages devices and the room exchange, and the pure rules the
 * `Room` Durable Object applies. Shared by the Worker and the app so both sides agree.
 *
 * The room holds public state only, unless the Storyteller turns on the view-only grimoire
 * link (`SharedGrimoire`). Phones ask (a name, a seat); the Storyteller approves, and only
 * then does the grimoire change, through its own commands.
 */
import type { Alignment, Script } from '#lib/core/data/index.ts';
import type { GameFeedback } from '#lib/core/feedback/index.ts';
import { parseAvatarId, type AvatarId } from '#lib/core/avatars/index.ts';
import { parseFrameId, type FrameId } from '#lib/core/frames/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import { feedbackView, type FeedbackView, type MemberFeedback } from './room-feedback.ts';
import {
	cleanBallot,
	newScriptVote,
	scriptVoteEnded,
	tallyScriptVote,
	type ScriptVote,
	type ScriptVoteKind,
	type ScriptVoteOption,
	type ScriptVoteTally
} from './script-vote.ts';

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
	/**
	 * The avatar and frame the player picked on their phone (plan R6, L4). Purely decorative,
	 * so no approval: the Storyteller's device puts them on the member's seat.
	 */
	avatar?: AvatarId;
	frame?: FrameId;
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
	/**
	 * SHA-256 (hex) of the key in the view-only grimoire link, while the Storyteller has the
	 * link turned on. Turning it off (or on again, with a new key) stops every earlier link.
	 */
	viewerKeyHash?: string;
	/**
	 * The link's key is made from a password the Storyteller set (Grim view, plan D1), so a
	 * phone with only the room code can watch by typing it.
	 */
	viewerPassword?: true;
	/** The current game is over, as the Storyteller ended it; a new game clears it. */
	ended?: GameOver;
	/** The Storyteller is choosing the next script (plan R1); a new game clears it. */
	choosing?: true;
	/** The room's vote on the next script, while the Storyteller has it open. */
	scriptVote?: ScriptVote;
	/** Players' feedback on the ended game, one per member; cleared with `ended`. */
	feedback?: MemberFeedback[];
}

/**
 * A finished game, as End game saved it (Trevor, 2026-10-18): who won and how. The table is
 * told at the end anyway, so phones see it, and the room stays open for what comes after.
 */
export interface GameOver {
	gameId: string;
	winner?: Alignment;
	/** How it ended (`EndReason`): `demon-dead`, `two-alive`, `character:<id>` or `other`. */
	reason?: string;
}

/** The longest end reason a game-over message carries: `character:` and an id. */
export const MAX_END_REASON = 80;

/**
 * The Storyteller's whole grimoire, for the view-only link (Trevor, 2026-10-18: Specters
 * spectators watch the grimoire, after promising not to spoil the game). Only the
 * Storyteller's device sends it and only viewers with the link's key receive it; the room
 * relays it as given, and each viewer checks `saved` as a saved game before showing it.
 */
export interface SharedGrimoire {
	/** The game as the Storyteller's device saves it (`SavedGame`). */
	saved: Record<string, unknown>;
	/** Where that device draws the seats, and its reminders' spots and copies (device notes). */
	layout?: unknown;
	reminderSpots?: unknown;
	copies?: unknown;
	/** The day timer as it is on that device (`SharedDayTimer`), so spectators see it run. */
	timer?: unknown;
}

/** A whole game's history with a homebrew script: well above `MAX_SCRIPT_BYTES`. */
export const MAX_GRIMOIRE_BYTES = 1024 * 1024;

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
export const ROOM_PROTOCOL = 2;
/**
 * The oldest protocol the room still accepts. 2 (2026-10-22): the room stays open after End
 * game and says the game is over (`game-over`); an older app would show the game as running.
 */
export const MIN_ROOM_PROTOCOL = 2;

export type ClientMessage =
	/**
	 * First message on every socket. Keys never go in the URL. `protocol` is missing from
	 * apps built before it existed, which speak protocol 1.
	 */
	| { type: 'hello'; role: 'host' | 'player' | 'viewer'; key: string; protocol?: number }
	// From a player.
	| { type: 'request'; name: string; seatId?: SeatId }
	| { type: 'cancel-request' }
	| { type: 'leave-seat' }
	/** The player's avatar and frame (plan R6); a missing one clears it. */
	| { type: 'look'; avatar?: string; frame?: string }
	/** A spectator's choice in the open vote; a new choice replaces the last. */
	| { type: 'vote'; voteId: string; choice: SeatId }
	/** Feedback on the ended game `gameId`; a new one replaces the member's last. */
	| { type: 'feedback'; gameId: string; feedback: GameFeedback }
	/** A player's ballot in the script vote; a new one replaces the last. */
	| { type: 'script-ballot'; voteId: string; choices: string[] }
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
	/**
	 * Turns the view-only grimoire link on with this key's hash, or off with `null`.
	 * `password`: the key is made from a password (`viewerPassword`).
	 */
	| { type: 'viewers'; keyHash: string | null; password?: boolean }
	/** The grimoire for viewers; ignored while the link is off. */
	| { type: 'grimoire'; grimoire: SharedGrimoire }
	/** The game `gameId` is over (protocol 2). */
	| { type: 'game-over'; gameId: string; winner?: Alignment; reason?: string }
	/**
	 * The finished grimoire for every player (Share grim, Trevor 2026-10-20, plan R5): only
	 * once the game `gameId` is over, and kept until it is reopened or a new game starts.
	 */
	| { type: 'reveal'; gameId: string; grimoire: SharedGrimoire }
	/** The Storyteller reopened the game `gameId`: it runs again (protocol 2). */
	| { type: 'reopen-game'; gameId: string }
	/** The Storyteller is (or no longer is) choosing the next script. */
	| { type: 'choosing'; on: boolean }
	/** Opens a vote on the next script, replacing any open one. */
	| {
			type: 'open-script-vote';
			voteId: string;
			kind: ScriptVoteKind;
			options: ScriptVoteOption[];
			/** A time limit in minutes (one of SCRIPT_VOTE_MINUTES); older apps send none. */
			minutes?: number;
			/** A vote on the game mode; a script vote when absent. */
			subject?: 'mode';
	  }
	| { type: 'close-script-vote' }
	| { type: 'close' };

export { receiveFeedback, type FeedbackView, type MemberFeedback } from './room-feedback.ts';
export * from './room-preview.ts';

/** What the Storyteller's device sees. */
export interface HostView {
	type: 'host-view';
	members: RoomMember[];
	requests: RoomRequest[];
	/** The open vote's count of spectators' choices; absent when no vote is open. */
	vote?: VoteTally;
	/** Players' feedback on the ended game, once any has come. */
	feedback?: FeedbackView[];
	/** The script vote's count, while one is open. */
	scriptVote?: ScriptVoteTally;
	/**
	 * The members whose phone is connected now. A room keeps every phone that ever joined it,
	 * so lists and counts use this to leave out phones from earlier games (2026-10-25).
	 */
	present?: string[];
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
	/**
	 * The game on the table, so a phone keeps its notes and guesses per game, not per room or
	 * script (Trevor, 2026-10-25). Not a secret: phones are sent it with the final grimoire.
	 */
	gameId?: string;
	me: RoomMember;
	request?: Pick<RoomRequest, 'name' | 'seatId'>;
	/** Seats someone in the room already sits in. */
	takenSeats: SeatId[];
	/** The open vote, shown to spectators only. */
	vote?: { voteId: string; options: SeatId[]; ability?: string; choice?: SeatId };
	/** The game on the table is over, with who won and how. */
	ended?: Omit<GameOver, 'gameId'>;
	/** The feedback this phone sent on the ended game. */
	feedback?: GameFeedback;
	/** The game that ended, for the feedback a phone sends on it. */
	endedGameId?: string;
	/** The Storyteller is choosing the next script. */
	choosing?: true;
	/** The script vote, while one is open, with this phone's own ballot. */
	scriptVote?: {
		voteId: string;
		kind: ScriptVoteKind;
		subject?: 'mode';
		options: ScriptVoteOption[];
		choices?: string[];
		/** When the time limit runs out (epoch ms, the room's clock). */
		endsAt?: number;
	};
}

/** The game's script, sent to a phone when it joins and whenever the Storyteller changes it. */
export interface ScriptView {
	type: 'script';
	script: Script;
}

/** What a viewer of the view-only link sees, on joining and on every change. */
export interface GrimoireView {
	type: 'grimoire';
	grimoire: SharedGrimoire;
}

/** The finished grimoire, sent to every player once the Storyteller shares it (plan R5). */
export interface RevealView {
	type: 'reveal';
	gameId: string;
	grimoire: SharedGrimoire;
}

export type ServerMessage =
	| HostView
	| RevealView
	| PlayerView
	| ScriptView
	| GrimoireView
	/** To the Storyteller: how many are watching through the view-only link right now. */
	| { type: 'watchers'; count: number }
	| { type: 'refused'; reason: RefusedReason }
	| { type: 'closed' };

/**
 * `too-old`: the app must update before it can use the room; the room itself is fine.
 * `not-viewer`: the view-only link is off, or was replaced by a newer one, or the password
 * was wrong. `too-many-tries`: too many wrong keys lately; watching waits a while.
 */
export type RefusedReason =
	'no-room' | 'not-host' | 'room-full' | 'too-old' | 'not-viewer' | 'too-many-tries';

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

/**
 * What the Storyteller's device sees. `present` holds the members whose phone is connected
 * now; counts leave out the others, unless they have already voted.
 */
export function hostView(room: RoomState, present?: ReadonlySet<string>): HostView {
	const view: HostView = { type: 'host-view', members: room.members, requests: room.requests };
	const here = (m: RoomMember, voted: boolean) => !present || present.has(m.memberId) || voted;
	if (room.vote) {
		const votes = room.vote.votes;
		view.vote = tally(room, room.vote, (m) => here(m, votes[m.memberId] !== undefined));
	}
	if (room.feedback?.length) view.feedback = room.feedback.map((f) => feedbackView(room, f));
	if (room.scriptVote) {
		const ballots = room.scriptVote.ballots;
		view.scriptVote = tallyScriptVote(
			room.scriptVote,
			room.members.filter((m) => here(m, !!ballots[m.memberId])).map((m) => m.memberId)
		);
	}
	if (present)
		view.present = room.members.flatMap((m) => (present.has(m.memberId) ? [m.memberId] : []));
	return view;
}

const isSpectator = (m: RoomMember) => m.seatId === undefined;

function tally(
	room: RoomState,
	vote: SpectatorVote,
	counted: (m: RoomMember) => boolean
): VoteTally {
	const spectators = room.members.filter((m) => isSpectator(m) && counted(m));
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
	if (room.gameId) view.gameId = room.gameId;
	if (room.ended && room.ended.gameId === room.gameId) {
		const { gameId: _game, ...ended } = room.ended;
		void _game;
		view.ended = ended;
		view.endedGameId = room.ended.gameId;
		const mine = room.feedback?.find((f) => f.memberId === memberId);
		if (mine) view.feedback = mine.feedback;
	}
	if (room.choosing) view.choosing = true;
	if (room.scriptVote) {
		const { voteId, kind, subject, options, ballots, endsAt } = room.scriptVote;
		view.scriptVote = { voteId, kind, options, ...(subject ? { subject } : {}) };
		if (endsAt !== undefined) view.scriptVote.endsAt = endsAt;
		if (ballots[memberId]) view.scriptVote.choices = ballots[memberId];
	}
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

/**
 * Adds a member on first hello; `null` when the room is full. A full room first lets go of
 * phones from earlier games: members with no seat and no request whose phone is not connected
 * (`present`), so a room in use for many games never fills with phones that left.
 */
export function join(
	room: RoomState,
	memberId: string,
	present?: ReadonlySet<string>
): RoomState | null {
	if (room.members.some((m) => m.memberId === memberId)) return room;
	let members = room.members;
	if (members.length >= MAX_MEMBERS && present) {
		const asking = new Set(room.requests.map((r) => r.memberId));
		members = members.filter(
			(m) => m.seatId !== undefined || asking.has(m.memberId) || present.has(m.memberId)
		);
	}
	if (members.length >= MAX_MEMBERS) return null;
	return { ...room, members: [...members, { memberId }] };
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
					? { memberId: m.memberId, ...nameOf(m), ...lookOf(m) }
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

function lookOf(m: RoomMember): Pick<RoomMember, 'avatar' | 'frame'> {
	return {
		...(m.avatar === undefined ? {} : { avatar: m.avatar }),
		...(m.frame === undefined ? {} : { frame: m.frame })
	};
}

/** A player's avatar and frame; unknown ones are dropped, as if none were picked. */
export function setLook(
	room: RoomState,
	memberId: string,
	raw: { avatar?: unknown; frame?: unknown }
): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member) return room;
	const avatar = parseAvatarId(raw.avatar);
	const frame = parseFrameId(raw.frame);
	if (avatar === member.avatar && frame === member.frame) return room;
	const { avatar: _a, frame: _f, ...rest } = member;
	void _a;
	void _f;
	const updated: RoomMember = { ...rest, ...lookOf({ memberId, avatar, frame }) };
	return { ...room, members: room.members.map((m) => (m.memberId === memberId ? updated : m)) };
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
	// A vote, and the game being over, belong to their game.
	const base = newGame ? closeScriptVote(setChoosing(withoutEnded(closeVote(room)), false)) : room;
	return {
		...base,
		gameId,
		public: state,
		members: room.members.map((m) =>
			keep(m.seatId) || m.seatId === undefined
				? m
				: { memberId: m.memberId, ...nameOf(m), ...lookOf(m) }
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

/**
 * The current game is over. A game-over for another game (one the room has moved on from)
 * is ignored, and so are a winner other than good or evil and a reason too long to be one.
 */
export function gameOver(
	room: RoomState,
	gameId: unknown,
	winner?: unknown,
	reason?: unknown
): RoomState {
	if (typeof gameId !== 'string' || gameId !== room.gameId) return room;
	const ended: GameOver = { gameId };
	if (winner === 'good' || winner === 'evil') {
		ended.winner = winner;
		if (typeof reason === 'string' && reason && reason.length <= MAX_END_REASON) {
			ended.reason = reason;
		}
	}
	return { ...room, ended };
}

/** Whether the finished grimoire of `gameId` may go to the players: only once it is over. */
export function canReveal(room: RoomState, gameId: unknown): boolean {
	return typeof gameId === 'string' && room.gameId === gameId && room.ended?.gameId === gameId;
}

/** The game `gameId` runs again; nothing changes if it was not the one that ended. */
export function reopenGame(room: RoomState, gameId: unknown): RoomState {
	return room.ended?.gameId === gameId ? withoutEnded(room) : room;
}

function withoutEnded(room: RoomState): RoomState {
	if (!room.ended) return room;
	const { ended: _over, feedback: _feedback, ...rest } = room;
	void _over;
	void _feedback;
	return rest;
}

/** The Storyteller is choosing the next script, or has stopped; anything else is ignored. */
export function setChoosing(room: RoomState, on: unknown): RoomState {
	if (on === true) return room.choosing ? room : { ...room, choosing: true };
	if (on !== false || !room.choosing) return room;
	const { choosing: _off, ...rest } = room;
	void _off;
	return rest;
}

/** Opens a vote on the next script, replacing any open one; a malformed one changes nothing. */
export function openScriptVote(
	room: RoomState,
	voteId: unknown,
	kind: unknown,
	options: unknown,
	minutes?: unknown,
	now = 0,
	subject?: unknown
): RoomState {
	const vote = newScriptVote(voteId, kind, options, minutes, now, subject);
	return vote ? { ...room, scriptVote: vote } : room;
}

export function closeScriptVote(room: RoomState): RoomState {
	if (!room.scriptVote) return room;
	const { scriptVote: _closed, ...rest } = room;
	void _closed;
	return rest;
}

/**
 * A member's ballot in the open script vote; a stale or malformed one, or one after the time
 * limit ran out at `now`, is ignored.
 */
export function castScriptBallot(
	room: RoomState,
	memberId: string,
	voteId: unknown,
	choices: unknown,
	now = 0
): RoomState {
	const vote = room.scriptVote;
	if (!vote || voteId !== vote.voteId || !room.members.some((m) => m.memberId === memberId)) {
		return room;
	}
	if (scriptVoteEnded(vote, now)) return room;
	const ballot = cleanBallot(vote, choices);
	if (!ballot) return room;
	return { ...room, scriptVote: { ...vote, ballots: { ...vote.ballots, [memberId]: ballot } } };
}

/**
 * Turns the view-only link on (a SHA-256 hex hash) or off (`null`); anything else is ignored.
 * `password` says the key was made from a Grim view password.
 */
export function setViewers(room: RoomState, keyHash: unknown, password?: unknown): RoomState {
	const { viewerKeyHash: _off, viewerPassword: _password, ...rest } = room;
	void _off;
	void _password;
	if (keyHash === null) return rest;
	if (typeof keyHash !== 'string' || !/^[0-9a-f]{64}$/.test(keyHash)) return room;
	return {
		...rest,
		viewerKeyHash: keyHash,
		...(password === true ? { viewerPassword: true } : {})
	};
}

/** A light shape check of a grimoire for viewers: they check the saved game themselves. */
export function isSharedGrimoire(value: unknown): value is SharedGrimoire {
	if (typeof value !== 'object' || value === null) return false;
	const { saved } = value as { saved?: unknown };
	return typeof saved === 'object' && saved !== null && !Array.isArray(saved);
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

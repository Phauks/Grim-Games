/**
 * The live room players join from their phones (07-accounts-and-multi-device.md §4.2):
 * its stored state, the messages devices and the room exchange, and the pure rules the
 * `Room` Durable Object applies. Shared by the Worker and the app so both sides agree.
 *
 * The room holds public state only, unless the Storyteller turns on the view-only grimoire
 * link (`SharedGrimoire`) or players' own characters (`RoomRoles`). Phones ask (a name, a seat); the Storyteller approves, and only
 * then does the grimoire change, through its own commands.
 */
import type { Alignment, Script } from '#lib/core/data/index.ts';
import type { GameFeedback } from '#lib/core/feedback/index.ts';
import { parseAvatarId, type AvatarId } from '#lib/core/avatars/index.ts';
import { parseFrameId, type FrameId } from '#lib/core/frames/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import type { SharedGrimoire } from './shared-grimoire.ts';
import { feedbackView, type FeedbackView, type MemberFeedback } from './room-feedback.ts';
import {
	type ScriptVote,
	type ScriptVoteKind,
	type ScriptVoteOption,
	type ScriptVoteTally
} from './script-vote.ts';
import { closeScriptVote, scriptVoteCount } from './room-script-vote.ts';
import { memberRole, seatsSeen, type RoomRoles, type SeatRole } from './room-roles.ts';

export { isSharedGrimoire, MAX_GRIMOIRE_BYTES, type SharedGrimoire } from './shared-grimoire.ts';

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

/** A name (and seat) waiting for the Storyteller, from before players joined without approval. */
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
	/** Rooms saved before players joined without approval (2026-10-26); `withoutRequests` empties it. */
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
	/** Each seat's own character, for its own phone (Trevor, 2026-10-26); per game. */
	roles?: RoomRoles;
	/** When the Storyteller's app was built (room-version.ts). */
	storytellerBuiltAt?: string;
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

export type ClientMessage =
	/**
	 * First message on every socket. Keys never go in the URL. `protocol` is missing from
	 * apps built before it existed, which speak protocol 1.
	 */
	| {
			type: 'hello';
			/** `town`: a Public Town display (`TownView`); its key is ignored, as it sends nothing. */
			role: 'host' | 'player' | 'viewer' | 'town';
			key: string;
			protocol?: number;
			/** When this app's build was made (ISO); the Storyteller's is passed on to phones. */
			builtAt?: string;
	  }
	// From a player.
	/** The player's name (the Storyteller seats them); older apps also send a seat, ignored. */
	| { type: 'request'; name: string; seatId?: SeatId }
	| { type: 'leave-seat' }
	/** The player's avatar and frame (plan R6); a missing one clears it. */
	| { type: 'look'; avatar?: string; frame?: string }
	/** A spectator's choice in the open vote; a new choice replaces the last. */
	| { type: 'vote'; voteId: string; choice: SeatId }
	/** Feedback on the ended game `gameId`; a new one replaces the member's last. */
	| { type: 'feedback'; gameId: string; feedback: GameFeedback }
	/**
	 * A player's ballot in the script vote; a new one replaces the last, and an empty one
	 * withdraws it (Trevor, 2026-10-26).
	 */
	| { type: 'script-ballot'; voteId: string; choices: string[] }
	| { type: 'role-seen' } // The player held their character to see it (2026-10-26).
	// From the Storyteller.
	| { type: 'publish'; gameId: string; state: PublicGameState }
	/**
	 * The game's script, sent apart from `publish` and only when it changes: phones keep it as
	 * their current script, so players can read it before seats are assigned.
	 */
	| { type: 'script'; script: Script }
	| { type: 'unseat'; memberId: string }
	/** Puts a named member in a seat (players join without approval, Trevor 2026-10-26). */
	| { type: 'seat'; memberId: string; seatId: SeatId }
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
			/** Players see the count too (Trevor, 2026-10-26). */
			showTally?: boolean;
	  }
	/** Shows players the count, or hides it, while the vote is open. */
	| { type: 'script-vote-tally'; show: boolean }
	/** Ends the vote after FINAL_CALL_SECONDS, so phones have a last chance (2026-10-26). */
	| { type: 'end-script-vote' }
	| { type: 'close-script-vote' }
	/** Each seat's own character while players may see them; `show: false` takes them back. */
	| { type: 'roles'; gameId: string; show: boolean; roles?: Record<SeatId, SeatRole> }
	/** Calls every player back to town: their phones sound and vibrate (plan U2). */
	| { type: 'call-town' }
	| { type: 'close' };

export { receiveFeedback, type FeedbackView, type MemberFeedback } from './room-feedback.ts';
export * from './room-preview.ts';
export { roleSeen, setRoles, type RoomRoles } from './room-roles.ts';
export * from './room-version.ts';
export {
	castScriptBallot,
	closeScriptVote,
	endScriptVote,
	openScriptVote,
	showScriptVoteTally
} from './room-script-vote.ts';

/** What the Storyteller's device sees. */
export interface HostView {
	type: 'host-view';
	members: RoomMember[];
	/** Always empty now; kept for Storytellers' apps built while players asked. */
	requests: RoomRequest[];
	/** The open vote's count of spectators' choices; absent when no vote is open. */
	vote?: VoteTally;
	/** Players' feedback on the ended game, once any has come. */
	feedback?: FeedbackView[];
	/** The ended game that feedback is on, so the device saves it with that game. */
	feedbackGameId?: string;
	/** The script vote's count, while one is open. */
	scriptVote?: ScriptVoteTally;
	/**
	 * The members whose phone is connected now. A room keeps every phone that ever joined it,
	 * so lists and counts use this to leave out phones from earlier games (2026-10-25).
	 */
	present?: string[];
	rolesSeen?: SeatId[]; // Seats whose player has seen the character they have now.
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
	/** Seats someone in the room already sits in. */
	takenSeats: SeatId[];
	/** The open vote, shown to spectators only. */
	vote?: { voteId: string; options: SeatId[]; ability?: string; choice?: SeatId };
	/** The game on the table is over, with who won and how. */
	ended?: Omit<GameOver, 'gameId'>;
	/** The feedback this phone sent on the ended game. */
	feedback?: GameFeedback;
	/**
	 * The game that ended, for the feedback a phone sends on it; left out once the Storyteller
	 * is setting up the next game, since that one has nothing to rate yet (Trevor, 2026-10-26).
	 */
	endedGameId?: string;
	/** When the Storyteller's app was built: a phone built earlier looks for the update. */
	storytellerBuiltAt?: string;
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
		/** The Storyteller ended the vote early; it closes at `endsAt`. */
		finalCall?: true;
		/** The count, when the Storyteller lets players see it (Trevor, 2026-10-26). */
		tally?: Pick<
			ScriptVoteTally,
			'points' | 'out' | 'winner' | 'rounds' | 'voted' | 'members' | 'people'
		>;
	};
	role?: SeatRole; // This player's own character, while players may see theirs.
}

/**
 * What a Public Town display sees (Trevor, 2026-10-26): a tablet in the middle of the table
 * showing the town as everyone there knows it, and nothing else. It is not a member, so it
 * takes no seat, casts no vote and is in no count; it is sent only what every phone is.
 */
export interface TownView {
	type: 'town-view';
	public?: PublicGameState;
	gameId?: string;
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
	| TownView
	| ScriptView
	| GrimoireView
	/** To the Storyteller: how many are watching through the view-only link right now. */
	| { type: 'watchers'; count: number }
	/**
	 * To the players: the Storyteller calls everyone back to town (plan U2). Sent once, never
	 * kept, so a phone that joins later doesn't sound; older apps ignore it.
	 */
	| { type: 'call-town' }
	/**
	 * To the Storyteller's device: send the whole grimoire while an admin watches from Live
	 * games (plan J31), or stop. The app shows nothing for it; older apps ignore it.
	 */
	| { type: 'grimoire-wanted'; on: boolean }
	| { type: 'refused'; reason: RefusedReason }
	| { type: 'closed' };

/** Back to town calls closer together than this are dropped, so phones don't keep ringing. */
export const CALL_TOWN_GAP_MS = 5000;

/** Whether a Back to town call at `now` goes out, given when the last one did. */
export function canCallTown(last: number | undefined, now: number): boolean {
	return last === undefined || now - last >= CALL_TOWN_GAP_MS;
}

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
	if (room.feedback?.length && room.ended) {
		view.feedback = room.feedback.map((f) => feedbackView(room, f));
		view.feedbackGameId = room.ended.gameId;
	}
	if (room.scriptVote) view.scriptVote = scriptVoteCount(room, present);
	if (present)
		view.present = room.members.flatMap((m) => (present.has(m.memberId) ? [m.memberId] : []));
	if (room.roles) view.rolesSeen = seatsSeen(room);
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

/**
 * What one player's phone sees. `present` is as for hostView, so a count players are shown
 * matches the Storyteller's.
 */
export function playerView(
	room: RoomState,
	memberId: string,
	present?: ReadonlySet<string>
): PlayerView {
	const me = room.members.find((m) => m.memberId === memberId) ?? { memberId };
	const view: PlayerView = {
		type: 'player-view',
		me,
		takenSeats: room.members.flatMap((m) => (m.seatId ? [m.seatId] : []))
	};
	if (room.public) view.public = room.public;
	if (room.gameId) view.gameId = room.gameId;
	if (room.storytellerBuiltAt) view.storytellerBuiltAt = room.storytellerBuiltAt;
	if (room.ended && room.ended.gameId === room.gameId) {
		const { gameId: _game, ...ended } = room.ended;
		void _game;
		view.ended = ended;
		if (!room.choosing && !room.scriptVote) view.endedGameId = room.ended.gameId;
		const mine = room.feedback?.find((f) => f.memberId === memberId);
		if (mine) view.feedback = mine.feedback;
	}
	if (room.choosing) view.choosing = true;
	const role = memberRole(room, memberId);
	if (role) view.role = role;
	if (room.scriptVote) {
		const { voteId, kind, subject, options, ballots, endsAt, finalCall } = room.scriptVote;
		view.scriptVote = { voteId, kind, options, ...(subject ? { subject } : {}) };
		if (endsAt !== undefined) view.scriptVote.endsAt = endsAt;
		if (finalCall) view.scriptVote.finalCall = true;
		if (ballots[memberId]) view.scriptVote.choices = ballots[memberId];
		if (room.scriptVote.showTally) {
			const { points, out, winner, rounds, voted, members, people } = scriptVoteCount(
				room,
				present
			);
			view.scriptVote.tally = {
				points,
				voted,
				members,
				...(out ? { out } : {}),
				...(winner ? { winner } : {}),
				...(rounds ? { rounds } : {}),
				...(people ? { people } : {})
			};
		}
	}
	if (room.vote && isSpectator(me)) {
		const choice = room.vote.votes[memberId];
		view.vote = { voteId: room.vote.voteId, options: room.vote.options };
		if (room.vote.ability) view.vote.ability = room.vote.ability;
		if (choice !== undefined) view.vote.choice = choice;
	}
	return view;
}

/** What a Public Town display sees: the public table alone (`TownView`). */
export function townView(room: RoomState): TownView {
	const view: TownView = { type: 'town-view' };
	if (room.public) view.public = room.public;
	if (room.gameId) view.gameId = room.gameId;
	return view;
}

/**
 * Adds a member on first hello; `null` when the room is full. A full room first lets go of
 * phones from earlier games: members with no seat whose phone is not connected
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
		members = members.filter((m) => m.seatId !== undefined || present.has(m.memberId));
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

/**
 * A player's name, set straight away: players no longer wait for approval (Trevor, 2026-10-26:
 * "we don't approve anymore"); the Storyteller seats them. Any request of theirs, and any seat
 * an older app asks for, is dropped. Invalid names change nothing.
 */
export function setName(room: RoomState, memberId: string, raw: { name: unknown }): RoomState {
	const name = cleanName(raw.name);
	const member = room.members.find((m) => m.memberId === memberId);
	if (!name || !member) return room;
	const asked = room.requests.some((r) => r.memberId === memberId);
	if (member.name === name && !asked) return room;
	return setMember(cancelRequest(room, memberId), memberId, { name });
}

/** The Storyteller seats a named member, moving anyone else out of that seat. */
export function seat(room: RoomState, memberId: string, seatId: unknown): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member?.name || typeof seatId !== 'string' || !seatExists(room, seatId as SeatId)) {
		return room;
	}
	return setMember(room, memberId, { seatId: seatId as SeatId });
}

/** Rooms saved while players still asked: each request's name becomes the member's name. */
export function withoutRequests(room: RoomState): RoomState {
	if (room.requests.length === 0) return room;
	const named = room.requests.reduce((r, req) => setName(r, req.memberId, req), room);
	return { ...named, requests: [] };
}

function cancelRequest(room: RoomState, memberId: string): RoomState {
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
		)
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

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
import type { AvatarId } from '#lib/core/avatars/index.ts';
import type { FrameId } from '#lib/core/frames/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import { feedbackView, type MemberFeedback } from './room-feedback.ts';
import type { ScriptVote } from './script-vote.ts';
import type { ClientMessage, HostView, PlayerView, TownView, VoteTally } from './room-protocol.ts';
import { closeScriptVote, scriptVoteCount } from './room-script-vote.ts';
import { memberRole, seatsSeen, type RoomRoles } from './room-roles.ts';
import { lookOf } from './room-look.ts';
import {
	pictureReports,
	seatPictures,
	withoutPictureVerdicts,
	type RoomPictures
} from './room-pictures.ts';
import { withoutMessages, type PlayerMessage } from './room-messages.ts';
import { numberedNames, withNumberedNames } from './room-names.ts';
import { MAX_MEMBERS } from './room-presence.ts';
import { seatPresence } from './seat-presence.ts';
import type { RoomTransfer } from './room-transfer.ts';
import { withoutRemoved, type RemovedMember } from './room-removed.ts';
import { setSeatingOpen } from './room-seating-open.ts';
import { countOffView, endCountOff, type CountOff } from './room-count-off.ts';

export {
	isSharedGrimoire,
	MAX_GRIMOIRE_BYTES,
	setViewers,
	type SharedGrimoire
} from './shared-grimoire.ts';
export { join, markHere, MAX_MEMBERS } from './room-presence.ts';
const MAX_PLAYER_NAME_LENGTH = 40;
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
	/** Their own picture in the room (room-pictures.ts), by its hash; initials when absent. */
	picture?: string;
	/**
	 * The game on the table when this phone was last connected. A phone that sleeps or goes to
	 * the background stays in that game's name lists (`HostView.away`) until it comes back.
	 */
	game?: string;
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
	/** The stored shape's version (room-state.ts); missing on rooms from before it. */
	schemaVersion?: number;
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
	/** Reports of players' pictures and the Storyteller's verdicts, this game (room-pictures.ts). */
	pictures?: RoomPictures;
	/** Players' messages to the Storyteller, this game (room-messages.ts). */
	messages?: PlayerMessage[];
	/** The Storyteller's app shows messages, so phones may send them. */
	inbox?: true;
	/** A room transfer the Storyteller has open (room-transfer.ts). */
	transfer?: RoomTransfer;
	/** Phones the Storyteller removed this game (room-removed.ts); a new game clears it. */
	removed?: RemovedMember[];
	/** Phones may move their own seat (room-seating-open.ts, plan J38); a new game locks it. */
	seatingOpen?: true;
	/** A count off the Storyteller has open (room-count-off.ts, plan J40); a new game ends it. */
	countOff?: CountOff;
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
const MAX_END_REASON = 80;

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
const MAX_VOTE_OPTIONS = MAX_MEMBERS;
/** The longest ability text a vote carries. */
const MAX_VOTE_ABILITY = 500;

export { receiveFeedback, type FeedbackView, type MemberFeedback } from './room-feedback.ts';
export * from './room-preview.ts';
export { roleSeen, setRoles, type RoomRoles } from './room-roles.ts';
export * from './room-version.ts';
export * from './room-sound.ts';
export * from './room-push.ts';
export { setLook } from './room-look.ts';
export { judgePicture, reportPicture } from './room-pictures.ts';
export { readMessages, sendMessage, setInbox, type PlayerMessage } from './room-messages.ts';
export {
	castScriptBallot,
	closeScriptVote,
	endScriptVote,
	openScriptVote,
	showScriptVoteTally
} from './room-script-vote.ts';
export type * from './room-protocol.ts';
export * from './room-transfer.ts';
export * from './room-removed.ts';
export * from './room-seating-open.ts';
export * from './room-count-off.ts';

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
	const members = withNumberedNames(room, present);
	const view: HostView = { type: 'host-view', members, requests: room.requests };
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
	if (present) {
		view.present = room.members.flatMap((m) => (present.has(m.memberId) ? [m.memberId] : []));
		view.away = awayInGame(room, present);
	}
	if (room.roles) view.rolesSeen = seatsSeen(room);
	const reports = pictureReports(room);
	if (reports.length) view.pictureReports = reports;
	if (room.messages?.length) view.messages = room.messages;
	if (room.removed?.length) view.removed = room.removed;
	if (room.seatingOpen) view.seatingOpen = true;
	if (room.countOff) view.countOff = countOffView(room, present);
	if (room.transfer) {
		const { endsAt, tries, asking } = room.transfer;
		view.transfer = { endsAt, tries };
		if (asking) view.transfer.asking = asking.name ? { name: asking.name } : {};
	}
	return view;
}

/** Phones not connected now that were in the game on the table: a screen locked or put away. */
function awayInGame(room: RoomState, present: ReadonlySet<string>): string[] {
	return room.members.flatMap((m) =>
		!present.has(m.memberId) && m.game === room.gameId ? [m.memberId] : []
	);
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
		takenSeats: room.members.flatMap((m) => (m.seatId ? [m.seatId] : [])),
		presence: seatPresence(
			room.members,
			(id) => !present || present.has(id),
			present ? awayInGame(room, present) : []
		)
	};
	if (room.public) view.public = room.public;
	if (room.gameId) view.gameId = room.gameId;
	const shownAs = numberedNames(room, present)[memberId];
	if (shownAs) view.shownAs = shownAs;
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
	if (room.seatingOpen) view.seatingOpen = true;
	if (room.countOff) view.countOff = countOffView(room, present, memberId);
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
	const pictures = seatPictures(room.members);
	if (Object.keys(pictures).length) view.pictures = pictures;
	if (room.inbox) view.inbox = true;
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
	if (room.ended && room.ended.gameId === room.gameId) {
		const { gameId: _game, ...ended } = room.ended;
		void _game;
		view.ended = ended;
	}
	const pictures = seatPictures(room.members);
	if (Object.keys(pictures).length) view.pictures = pictures;
	return view;
}

function cleanName(raw: unknown): string | null {
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
					? { memberId: m.memberId, ...nameOf(m), ...lookOf(m), ...gameOf(m) }
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

function gameOf(m: RoomMember): Pick<RoomMember, 'game'> {
	return m.game === undefined ? {} : { game: m.game };
}

export function unseat(room: RoomState, memberId: string): RoomState {
	return setMember(room, memberId, { seatId: undefined });
}

/**
 * New public state from the Storyteller. Seats that no longer exist lose their phone; a
 * different game clears every seat, every seat request and any open vote, but names stay.
 * The phones connected now (`present`) become part of a different game; before the room's
 * first game, every phone that joined does.
 */
export function publish(
	room: RoomState,
	gameId: string,
	state: PublicGameState,
	present?: ReadonlySet<string>
): RoomState {
	const newGame = room.gameId !== undefined && room.gameId !== gameId;
	const joins = (m: RoomMember) =>
		room.gameId !== gameId && (room.gameId === undefined || !!present?.has(m.memberId));
	const seats = new Set(state.seats.map((s) => s.seatId));
	const keep = (seatId?: SeatId) => !newGame && seatId !== undefined && seats.has(seatId);
	// A vote, and the game being over, belong to their game.
	const base = newGame
		? setSeatingOpen(
				withoutRemoved(
					withoutMessages(
						withoutPictureVerdicts(
							closeScriptVote(setChoosing(withoutEnded(closeVote(room)), false))
						)
					)
				),
				false
			)
		: room;
	return {
		...(newGame ? endCountOff(base) : base),
		gameId,
		public: state,
		members: room.members.map((m) => {
			const kept: RoomMember =
				keep(m.seatId) || m.seatId === undefined
					? m
					: { memberId: m.memberId, ...nameOf(m), ...lookOf(m), ...gameOf(m) };
			return joins(m) ? { ...kept, game: gameId } : kept;
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

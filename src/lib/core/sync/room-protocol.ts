/**
 * The messages devices and the live room exchange (room.ts): what each device sends, and the
 * views the room sends back. Shared by the Worker and the app so both sides agree.
 */
import type { Alignment, Script } from '#lib/core/data/index.ts';
import type { GameFeedback } from '#lib/core/feedback/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import type { SharedGrimoire } from './shared-grimoire.ts';
import type { TownSoundCommand } from './room-sound.ts';
import type { FeedbackView } from './room-feedback.ts';
import type {
	ScriptVoteKind,
	ScriptVoteOption,
	StoredVoteSubject,
	ScriptVoteTally
} from './script-vote.ts';
import type { SeatRole } from './room-roles.ts';
import type { SeatPresence } from './seat-presence.ts';
import type { PictureReportView } from './room-pictures.ts';
import type { PlayerMessage } from './room-messages.ts';
import type { GameOver, RoomMember, RoomRequest } from './room.ts';
import type { TransferDetails, TransferStatus } from './room-transfer.ts';
import type { PushAddress } from './web-push.ts';
import type { RemovedMember } from './room-removed.ts';
import type { SitWish } from './room-seating-open.ts';

export type ClientMessage =
	/**
	 * First message on every socket. Keys never go in the URL. `protocol` is missing from
	 * apps built before it existed, which speak protocol 1.
	 */
	| {
			type: 'hello';
			/**
			 * `town`: a Public Town display (`TownView`); its key is ignored, as it sends nothing.
			 * `claim`: a device taking the room over (room-transfer.ts); its key is its new host key.
			 */
			role: 'host' | 'player' | 'viewer' | 'town' | 'claim';
			key: string;
			protocol?: number;
			/** When this app's build was made (ISO); the Storyteller's is passed on to phones. */
			builtAt?: string;
			/** From the Storyteller: its app shows players' messages (room-messages.ts). */
			inbox?: boolean;
	  }
	// From a player.
	/** The player's name (the Storyteller seats them); older apps also send a seat, ignored. */
	| { type: 'request'; name: string; seatId?: SeatId }
	| { type: 'leave-seat' }
	/** The player's avatar, frame and uploaded picture (plan R6); a missing one clears it. */
	| { type: 'look'; avatar?: string; frame?: string; picture?: string }
	/** Reports the picture on another player's seat to the Storyteller (2026-10-27). */
	| { type: 'report-picture'; seatId: SeatId }
	| { type: 'message'; text: string; consult?: boolean } // To the Storyteller (2026-10-27).
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
	/** Seating open (plan J38): the player dragged their disc to just after this seat. */
	| { type: 'sit'; after: SeatId }
	/** Seating locked: a player with no seat tapped this open one to sit in it. */
	| { type: 'claim-seat'; seatId: SeatId }
	/**
	 * Back to town reaches this phone while it is locked or the app is closed (plan U12), at this
	 * push address; none turns that off.
	 */
	| { type: 'push'; address?: PushAddress }
	/** The app is (or no longer is) on this phone's screen, so a call isn't pushed too. */
	| { type: 'showing'; on: boolean }
	// From the Storyteller.
	| { type: 'publish'; gameId: string; state: PublicGameState }
	/**
	 * The game's script, sent apart from `publish` and only when it changes: phones keep it as
	 * their current script, so players can read it before seats are assigned.
	 */
	| { type: 'script'; script: Script }
	| { type: 'unseat'; memberId: string }
	/** Removes a phone from the room for this game, or lets it back in (plan J37). */
	| { type: 'remove'; memberId: string }
	| { type: 'let-back-in'; memberId: string }
	/** Lets phones move their own seat, or locks seating (plan J38). */
	| { type: 'seating'; open: boolean }
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
			/** A vote on the game mode or the special rules; a script vote when absent. */
			subject?: StoredVoteSubject;
			/** Players see the count too (Trevor, 2026-10-26). */
			showTally?: boolean;
	  }
	/** Shows players the count, or hides it, while the vote is open. */
	| { type: 'script-vote-tally'; show: boolean }
	/** Ends the vote at once (Trevor, 2026-10-30: "No 15 second delay"). */
	| { type: 'end-script-vote' }
	| { type: 'close-script-vote' }
	/** Each seat's own character while players may see them; `show: false` takes them back. */
	| { type: 'roles'; gameId: string; show: boolean; roles?: Record<SeatId, SeatRole> }
	/** Calls every player back to town: their phones sound and vibrate (plan U2). */
	| { type: 'call-town' }
	/** Soundboard sounds for the Public Town tablet to play (plan U10). */
	| ({ type: 'town-sound' } & TownSoundCommand)
	/** Lets a reported picture stand, or takes that player's picture away for this game. */
	| { type: 'judge-picture'; hash: string; allow: boolean }
	| { type: 'read-messages'; ids: string[] } // The Storyteller opened these messages.
	/** Opens a room transfer with this code's hash, or changes whether it brings the game. */
	| { type: 'open-transfer'; codeHash: string; bringGame: boolean }
	| { type: 'close-transfer' }
	/** Allows, or turns down, the device asking to take over (`HostView.transfer.asking`). */
	| { type: 'answer-transfer'; allow: boolean }
	// From a device taking the room over (hello role `claim`).
	/** Is this the transfer code? Answered with `transfer` or `transfer-refused`. */
	| { type: 'check-transfer'; code: string }
	/**
	 * Asks to take the room with this transfer code, under this Profile name: the Storyteller's
	 * device allows it (`transferred`) or turns it down (`transfer-denied`).
	 */
	| { type: 'take-room'; code: string; name?: string }
	| { type: 'unread-messages'; ids: string[] } // The Storyteller marked them unread again.
	| { type: 'close' };

/** What the Storyteller's device sees. */
export interface HostView {
	type: 'host-view';
	/** A name another phone at this game already has comes numbered (room-names.ts). */
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
	/**
	 * Members whose phone is not connected now but was during this game: a screen turned off or
	 * the app in the background (bug report #3, 2026-10-27). Name lists keep them.
	 */
	away?: string[];
	rolesSeen?: SeatId[]; // Seats whose player has seen the character they have now.
	pictureReports?: PictureReportView[]; // Pictures other phones reported, for a verdict.
	messages?: PlayerMessage[]; // Players' messages this game, oldest first.
	transfer?: TransferStatus; // The room transfer this device has open.
	removed?: RemovedMember[]; // Phones removed from the room this game (plan J37).
	seatingOpen?: true; // Phones may move their own seat (plan J38).
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
	/** Which seats' phones are connected or away, and the phones with no seat (the candles). */
	presence?: SeatPresence;
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
	/** The name the Storyteller sees for this phone while another player has its name. */
	shownAs?: string;
	/** When the Storyteller's app was built: a phone built earlier looks for the update. */
	storytellerBuiltAt?: string;
	/** The Storyteller is choosing the next script. */
	choosing?: true;
	/** The script vote, while one is open, with this phone's own ballot. */
	scriptVote?: {
		voteId: string;
		kind: ScriptVoteKind;
		subject?: StoredVoteSubject;
		options: ScriptVoteOption[];
		choices?: string[];
		/** When the time limit runs out (epoch ms, the room's clock). */
		endsAt?: number;
		/** The count, when the Storyteller lets players see it (Trevor, 2026-10-26). */
		tally?: Pick<
			ScriptVoteTally,
			'points' | 'out' | 'winner' | 'rounds' | 'voted' | 'members' | 'people'
		>;
	};
	role?: SeatRole; // This player's own character, while players may see theirs.
	pictures?: Partial<Record<SeatId, string>>; // Each seat's player's picture (room-pictures.ts).
	inbox?: true; // The Storyteller's app takes messages, so this phone may send one.
	seatingOpen?: true; // This phone may drag its own disc (plan J38).
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
	/** The current game is over, as phones are told, so the finished grimoire can show. */
	ended?: Omit<GameOver, 'gameId'>;
	pictures?: Partial<Record<SeatId, string>>;
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
	/** To the Public Town: play, stop, pause or resume soundboard sounds (plan U10). */
	| ({ type: 'town-sound' } & TownSoundCommand)
	/**
	 * To the Storyteller's device: send the whole grimoire while an admin watches from Live
	 * games (plan J31), or stop. The app shows nothing for it; older apps ignore it.
	 */
	| { type: 'grimoire-wanted'; on: boolean }
	/** To a device taking over: the code is right, and this comes with the room. */
	| { type: 'transfer'; details: TransferDetails }
	/** To a device taking over: wrong code, or no transfer open (`triesLeft` 0). */
	| { type: 'transfer-refused'; triesLeft: number }
	/** To a device taking over: the Storyteller's device turned it down. */
	| { type: 'transfer-denied' }
	/** To the device that took over: the room is its now, with the game when it came along. */
	| { type: 'transferred'; grimoire?: SharedGrimoire }
	/** To the Storyteller's old device: another device took the room over. */
	| { type: 'handed-over' }
	/**
	 * To the phone that sent a message to the Storyteller: whether the room took it (Trevor,
	 * 2026-10-28). Says nothing of what was sent; older apps ignore it.
	 */
	| { type: 'message-delivered'; delivered: boolean }
	/** To the Storyteller's device: where a phone asks to sit (plan J38); never kept. */
	| SitWish
	| { type: 'refused'; reason: RefusedReason }
	| { type: 'closed' };

/**
 * `too-old`: the app must update before it can use the room; the room itself is fine.
 * `not-viewer`: the view-only link is off, or was replaced by a newer one, or the password
 * was wrong. `too-many-tries`: too many wrong keys lately; watching waits a while.
 * `removed`: the Storyteller removed this phone for the current game (plan J37).
 */
export type RefusedReason =
	'no-room' | 'not-host' | 'room-full' | 'too-old' | 'not-viewer' | 'too-many-tries' | 'removed';

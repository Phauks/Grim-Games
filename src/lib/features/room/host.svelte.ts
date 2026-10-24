/**
 * The Storyteller's side of a live room (07-accounts-and-multi-device.md §4.2). The room
 * belongs to this device, not to a game: its code and host key are kept here, so the same
 * players stay in it from one game to the next.
 *
 * While a game is attached, its public projection is published on every change. Nothing a
 * phone sends changes the grimoire until the Storyteller approves it, and approving runs an
 * ordinary command, so it shows in History and can be rolled back. The one exception is a
 * seated player's avatar and frame (plan R6), which are decorative and go on their seat as
 * they pick them, also as an ordinary command.
 */
import { publicTravellerTest } from '#lib/features/player/travellers-in-play.ts';
import type { Script } from '#lib/core/data/index.ts';
import { toSavedGame } from '#lib/core/engine/index.ts';
import type { GameId, SeatId } from '#lib/core/model/index.ts';
import {
	publicProjection,
	type PublicCorner,
	type PublicGameState
} from '#lib/core/sync/public-projection.ts';
import {
	MAX_GRIMOIRE_BYTES,
	ROOM_PROTOCOL,
	type RoomMember,
	type RoomRequest,
	type ServerMessage,
	type SharedGrimoire,
	type VoteTally
} from '#lib/core/sync/room.ts';
import type {
	ScriptVoteKind,
	ScriptVoteOption,
	ScriptVoteTally,
	VoteSubject
} from '#lib/core/sync/script-vote.ts';
import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import {
	reminderCopyIds,
	reminderSpots,
	seatLayouts
} from '#lib/features/grimoire/device-notes.ts';
import { parseSeatLayout } from '#lib/ui/seating/seat-layout.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { randomKey, RoomSocket, sha256Hex } from './room-socket.svelte.ts';
import { viewerKeyFromPassword } from './viewer.svelte.ts';
import { gameSheetRules } from '#lib/features/modes/sheet-rules.ts';

const STORAGE_KEY = 'grim-games-room-host';

interface StoredRoom {
	code: string;
	key: string;
	/** The key in the view-only grimoire link, while it is on. */
	viewerKey?: string;
	/** The Grim view password that key was made from, if the Storyteller set one. */
	viewerPassword?: string;
}

/** The board's own notes a viewer needs to draw the grimoire as this device does. */
export type BoardNotes = Pick<SharedGrimoire, 'layout' | 'reminderSpots' | 'copies'>;

function storedNotes(gameId: GameId): BoardNotes {
	return {
		layout: seatLayouts.read(gameId),
		reminderSpots: reminderSpots.read(gameId),
		copies: [...reminderCopyIds.read(gameId)]
	};
}

/** Changes are gathered for this long before the grimoire is sent to viewers again. */
const GRIMOIRE_DELAY_MS = 300;

export class RoomHost {
	code = $state<string>();
	members = $state.raw<RoomMember[]>([]);
	requests = $state.raw<RoomRequest[]>([]);
	/** The spectators' open vote and its count (Specters), if one is open. */
	vote = $state.raw<VoteTally>();
	/** The room's vote on the next script and its count (plan R1), if one is open. */
	scriptVote = $state.raw<ScriptVoteTally>();
	/** True when opening a room failed, e.g. offline. */
	problem = $state(false);
	/** True while a room is being opened. */
	opening = $state(false);
	/**
	 * The key in the view-only grimoire link while the Storyteller has it on (Specters,
	 * Trevor 2026-10-18). Viewers see everything, so it is off until turned on, and turning
	 * it on again makes a new link.
	 */
	viewerKey = $state<string>();
	/** The Grim view password, while the link is on with one (plan D1). */
	viewerPassword = $state<string>();
	/** True when the grimoire is too large to send to viewers. */
	grimoireTooLarge = $state(false);
	/** How many are watching through the view-only link now (Trevor, 2026-10-20). */
	watchers = $state(0);
	#viewerKeyHash: string | undefined;
	#grimoire: SharedGrimoire | undefined;
	#grimoireTimer: ReturnType<typeof setTimeout> | undefined;
	#openingRoom: Promise<void> | undefined;
	#choosing = false;
	/** What the open board's corner shows, for the phones' corners (showCorner). */
	#corner = $state<{ gameId: string; corner: PublicCorner }>();
	#ended:
		| { gameId: GameId; ended: { winner?: 'good' | 'evil'; reason?: string } | undefined }
		| undefined;
	#socket = $state.raw<RoomSocket>();
	#game: OpenGame | undefined;
	#stopWatching: (() => void) | undefined;
	#published: { gameId: string; state: PublicGameState } | undefined;
	#script: Script | undefined;

	constructor() {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (stored?.code && stored.key) {
			this.viewerPassword = stored.viewerKey ? stored.viewerPassword : undefined;
			if (stored.viewerKey) void this.#useViewerKey(stored.viewerKey);
			this.#connect(stored);
		}
	}

	get status() {
		return this.#socket?.status;
	}

	get refusedReason() {
		return this.#socket?.refusedReason;
	}

	/** Opens a new room for this device. */
	open(): Promise<void> {
		this.#openingRoom ??= this.#open().finally(() => {
			this.#openingRoom = undefined;
			this.opening = false;
		});
		return this.#openingRoom;
	}

	/**
	 * Opens a room unless this device already has one or is opening one. Called as soon as the
	 * Storyteller points at, focuses or presses "Players' phones", so the code and QR are ready
	 * by the time the panel shows.
	 */
	prepare(): void {
		if (!this.code && !this.#openingRoom) void this.open();
	}

	async #open(): Promise<void> {
		this.opening = true;
		this.problem = false;
		const key = randomKey();
		try {
			const response = await fetch('/api/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hostKeyHash: await sha256Hex(key) })
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const { code } = (await response.json()) as { code: string };
			const room = { code, key };
			writeStored(STORAGE_KEY, room);
			this.#connect(room);
		} catch {
			this.problem = true;
		}
	}

	/** Turns the view-only grimoire link on, with a new key, or off for every viewer. */
	async setViewers(on: boolean): Promise<void> {
		if (on === !!this.viewerKey) return;
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored) return;
		if (on) {
			const key = randomKey();
			writeStored(STORAGE_KEY, { ...stored, viewerKey: key });
			await this.#useViewerKey(key);
		} else {
			const { viewerKey: _off, viewerPassword: _password, ...rest } = stored;
			void _off;
			void _password;
			writeStored(STORAGE_KEY, rest);
			this.viewerKey = undefined;
			this.viewerPassword = undefined;
			this.#viewerKeyHash = undefined;
			this.#socket?.send({ type: 'viewers', keyHash: null });
		}
	}

	/**
	 * A new view-only link in one step (Trevor, 2026-10-20): the old one stops working and
	 * anyone watching with it is let go.
	 */
	async refreshViewers(): Promise<void> {
		await this.setViewerPassword('');
	}

	/**
	 * Makes the link's key from a Grim view password (plan D1), so the room code and the
	 * password open the grimoire too; '' goes back to a random key. Either way the old link
	 * stops working and anyone watching with it is let go.
	 */
	async setViewerPassword(password: string): Promise<void> {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored || !this.viewerKey) return;
		const clean = password.trim();
		const key = clean ? await viewerKeyFromPassword(stored.code, clean) : randomKey();
		const { viewerPassword: _old, ...rest } = stored;
		void _old;
		writeStored(STORAGE_KEY, {
			...rest,
			viewerKey: key,
			...(clean ? { viewerPassword: clean } : {})
		});
		this.viewerPassword = clean || undefined;
		await this.#useViewerKey(key);
	}

	async #useViewerKey(key: string): Promise<void> {
		this.viewerKey = key;
		const hash = await sha256Hex(key);
		if (this.viewerKey !== key) return;
		this.#viewerKeyHash = hash;
		this.#sendViewers();
		this.#sendGrimoire();
	}

	/**
	 * A new code (Trevor, 2026-10-20): the old room is deleted, its phones and viewers let go,
	 * and a new one opened. A view-only link that was on is on again, with a new key.
	 */
	async refreshRoom(): Promise<void> {
		const watching = !!this.viewerKey;
		// The password stays; its key is made with the new code.
		const password = this.viewerPassword;
		this.close();
		await this.open();
		if (watching && this.code) {
			await this.setViewers(true);
			if (password) await this.setViewerPassword(password);
		}
	}

	/** Deletes the room for everyone in it. */
	close(): void {
		this.#socket?.send({ type: 'close' });
		this.#forget();
	}

	/**
	 * Publishes this game's public state, and its script, to the room while it is open on this
	 * device. Any open game will do, including one still in setup: phones get the script as
	 * soon as they join, before anyone has a seat.
	 */
	attach(game: OpenGame, notes?: () => BoardNotes): void {
		if (this.#game === game) return;
		this.#stopWatching?.();
		this.#game = game;
		this.#stopWatching = $effect.root(() => {
			// The whole grimoire, for the view-only link while it is on.
			$effect(() => {
				if (!this.viewerKey) return;
				const saved = toSavedGame(game.session, Date.now());
				this.#queueGrimoire({
					saved: saved as unknown as Record<string, unknown>,
					...(notes?.() ?? storedNotes(game.game.gameId)),
					timer: liveDayTimer.shared
				});
			});
			$effect(() => {
				// Where the board draws the seats, so phones draw the town the same way (plan J13).
				const layout = notes ? parseSeatLayout(notes().layout) : seatLayouts.read(game.game.gameId);
				const corner = this.#corner?.gameId === game.game.gameId ? this.#corner.corner : undefined;
				const state = publicProjection(
					game.game,
					publicTravellerTest(game.game.gameId, game.characters),
					layout,
					corner,
					game.characters,
					gameSheetRules(game.game.gameId)
				);
				this.#publish({ gameId: game.game.gameId, state });
			});
			$effect(() => {
				const script = $state.snapshot(game.game.script) as Script;
				if (JSON.stringify(script) === JSON.stringify(this.#script)) return;
				this.#script = script;
				this.#socket?.send({ type: 'script', script });
			});
		});
	}

	/**
	 * The lines the board's corner shows now (corner-lines.ts), so each phone's grim shows the
	 * same corner (Trevor, 2026-10-24). Sent with the game's public state.
	 */
	showCorner(gameId: string, corner: PublicCorner): void {
		const shown = { gameId, corner: $state.snapshot(corner) as PublicCorner };
		if (JSON.stringify(shown) !== JSON.stringify(this.#corner)) this.#corner = shown;
	}

	/** Approves a request, optionally into a different seat, naming that seat in the grimoire. */
	approve(request: RoomRequest, seatId: SeatId | undefined = request.seatId): void {
		if (seatId && this.#game) {
			this.#game.run({ type: 'RenameSeat', seatId, playerName: request.name });
		}
		this.#socket?.send({ type: 'resolve', requestId: request.requestId, accept: true, seatId });
	}

	decline(request: RoomRequest): void {
		this.#socket?.send({ type: 'resolve', requestId: request.requestId, accept: false });
	}

	unseat(member: RoomMember): void {
		this.#socket?.send({ type: 'unseat', memberId: member.memberId });
	}

	/** Opens a spectators' vote on these seats, replacing any open one. False when offline. */
	openVote(options: SeatId[], ability?: string): boolean {
		return (
			this.#socket?.send({
				type: 'open-vote',
				voteId: crypto.randomUUID(),
				options,
				...(ability ? { ability } : {})
			}) ?? false
		);
	}

	closeVote(): void {
		this.#socket?.send({ type: 'close-vote' });
	}

	/** The game that is over (End game), so its grimoire can be shared (Share grim, R5). */
	endedGame = $state<string>();
	/** The game whose final grimoire the room's phones were sent (Share grim, R5). */
	revealedGame = $state<string>();

	/**
	 * Share grim (R5): sends the whole grimoire to the room's phones once the game is over.
	 * False when it is too large or the room is offline.
	 */
	reveal(game: OpenGame, notes?: BoardNotes): boolean {
		const gameId = game.game.gameId;
		const saved = toSavedGame(game.session, Date.now());
		const message = {
			type: 'reveal',
			gameId,
			grimoire: {
				saved: saved as unknown as Record<string, unknown>,
				...(notes ?? storedNotes(gameId))
			}
		} as const;
		if (JSON.stringify(message).length > MAX_GRIMOIRE_BYTES) return false;
		if (!this.#socket?.send(message)) return false;
		this.revealedGame = gameId;
		return true;
	}

	/**
	 * Phones show the Storyteller is choosing the next script while New game is open, once
	 * the game on the table is over (or before there is one), never in the middle of one.
	 */
	setChoosing(on: boolean): void {
		const between =
			!this.#published || (this.#ended?.gameId === this.#published.gameId && !!this.#ended.ended);
		if (on && !between) return;
		this.#choosing = on;
		this.#socket?.send({ type: 'choosing', on });
	}

	/**
	 * Opens a vote on the next script, replacing any open one, with a time limit in minutes
	 * if given. False when offline.
	 */
	openScriptVote(
		kind: ScriptVoteKind,
		options: ScriptVoteOption[],
		minutes?: number,
		subject: VoteSubject = 'script'
	): boolean {
		return (
			this.#socket?.send({
				type: 'open-script-vote',
				voteId: crypto.randomUUID(),
				kind,
				options,
				...(minutes !== undefined ? { minutes } : {}),
				...(subject === 'mode' ? { subject } : {})
			}) ?? false
		);
	}

	closeScriptVote(): void {
		this.#socket?.send({ type: 'close-script-vote' });
	}

	/**
	 * Tells the room the game is over (End game), or running again (`undefined`, Reopen). The
	 * room stays open, so its phones see the end; kept and sent again after a reconnect.
	 */
	setEnded(gameId: GameId, ended: { winner?: 'good' | 'evil'; reason?: string } | undefined): void {
		this.#ended = { gameId, ended };
		this.endedGame = ended ? gameId : undefined;
		// Reopen takes the shared grimoire back (the room drops it too).
		if (!ended && this.revealedGame === gameId) this.revealedGame = undefined;
		this.#sendEnded();
	}

	#sendEnded(): void {
		if (!this.#ended || this.#ended.gameId !== this.#published?.gameId) return;
		const { gameId, ended } = this.#ended;
		this.#socket?.send(
			ended ? { type: 'game-over', gameId, ...ended } : { type: 'reopen-game', gameId }
		);
	}

	#connect(room: StoredRoom): void {
		this.#socket?.stop();
		this.code = room.code;
		this.#socket = new RoomSocket(
			room.code,
			{ type: 'hello', role: 'host', key: room.key, protocol: ROOM_PROTOCOL },
			(m) => this.#receive(m),
			() => this.#resend()
		);
	}

	#receive(message: ServerMessage): void {
		if (message.type === 'host-view') {
			this.#applyLooks(this.members, message.members);
			this.members = message.members;
			this.requests = message.requests;
			this.vote = message.vote;
			this.scriptVote = message.scriptVote;
		} else if (message.type === 'watchers') {
			this.watchers = message.count;
		} else if (message.type === 'refused' && message.reason === 'too-old') {
			// The room is still this device's: keep it for after the update.
		} else if (message.type === 'refused' || message.type === 'closed') {
			// The room expired or this device no longer owns it.
			this.#forget();
		}
	}

	/**
	 * Puts each seated player's avatar and frame on their seat (plan R6). They are decorative,
	 * so they need no approval, but only a change is applied: a seat the Storyteller has since
	 * changed back (by undoing) stays as it is until the player picks again or moves seat.
	 */
	#applyLooks(before: RoomMember[], after: RoomMember[]): void {
		const game = this.#game;
		if (!game) return;
		const key = (m: RoomMember) => `${m.seatId}|${m.avatar ?? ''}|${m.frame ?? ''}`;
		const was: Record<string, string> = Object.fromEntries(before.map((m) => [m.memberId, key(m)]));
		for (const member of after) {
			const seat = member.seatId && game.game.seats[member.seatId];
			if (!seat || was[member.memberId] === key(member)) continue;
			if (seat.avatar === member.avatar && seat.frame === member.frame) continue;
			game.run({
				type: 'SetSeatLook',
				seatId: seat.seatId,
				...(member.avatar ? { avatar: member.avatar } : {}),
				...(member.frame ? { frame: member.frame } : {})
			});
		}
	}

	#queueGrimoire(grimoire: SharedGrimoire): void {
		this.#grimoire = grimoire;
		clearTimeout(this.#grimoireTimer);
		this.#grimoireTimer = setTimeout(() => this.#sendGrimoire(), GRIMOIRE_DELAY_MS);
	}

	#sendGrimoire(): void {
		if (!this.#grimoire || !this.#viewerKeyHash) return;
		const message = { type: 'grimoire', grimoire: this.#grimoire } as const;
		this.grimoireTooLarge = JSON.stringify(message).length > MAX_GRIMOIRE_BYTES;
		if (!this.grimoireTooLarge) this.#socket?.send(message);
	}

	#publish(published: { gameId: string; state: PublicGameState }): void {
		// The board's notes change with every reminder moved; the table only when it does.
		if (JSON.stringify(published) === JSON.stringify(this.#published)) return;
		this.#published = published;
		this.#resend();
	}

	#resend(): void {
		if (this.#published) this.#socket?.send({ type: 'publish', ...this.#published });
		this.#sendEnded();
		if (this.#choosing) this.#socket?.send({ type: 'choosing', on: true });
		if (this.#script) this.#socket?.send({ type: 'script', script: this.#script });
		// While a stored key's hash is still being worked out, say nothing about viewers.
		if (!this.viewerKey) this.#socket?.send({ type: 'viewers', keyHash: null });
		else if (this.#viewerKeyHash) {
			this.#sendViewers();
			this.#sendGrimoire();
		}
	}

	#sendViewers(): void {
		if (!this.#viewerKeyHash) return;
		this.#socket?.send({
			type: 'viewers',
			keyHash: this.#viewerKeyHash,
			...(this.viewerPassword ? { password: true } : {})
		});
	}

	#forget(): void {
		this.#socket?.stop();
		this.#socket = undefined;
		this.watchers = 0;
		this.code = undefined;
		this.members = [];
		this.requests = [];
		this.vote = undefined;
		this.scriptVote = undefined;
		this.viewerKey = undefined;
		this.viewerPassword = undefined;
		this.revealedGame = undefined;
		this.#viewerKeyHash = undefined;
		this.#grimoire = undefined;
		clearTimeout(this.#grimoireTimer);
		writeStored(STORAGE_KEY, undefined);
	}
}

let host: RoomHost | undefined;

/** This device's room, if it has opened one; created on first use. */
export function roomHost(): RoomHost {
	host ??= new RoomHost();
	return host;
}

/** Starts opening this device's room early; see `RoomHost.prepare`. */
export function prepareRoom(): void {
	roomHost().prepare();
}

/** Called wherever a game is open on the Storyteller's device, so phones follow it live. */
export function attachRoom(game: OpenGame, notes?: () => BoardNotes): void {
	roomHost().attach(game, notes);
}

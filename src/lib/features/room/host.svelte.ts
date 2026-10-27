/**
 * The Storyteller's side of a live room (07-accounts-and-multi-device.md §4.2). The room
 * belongs to this device, not to a game: its code and host key are kept here, so the same
 * players stay in it from one game to the next.
 *
 * While a game is attached, its public projection is published on every change. Nothing a
 * phone sends changes the grimoire until the Storyteller seats it by naming a seat on the board
 * with the phone's name (an ordinary command, in History). After that, a seated player's name,
 * avatar and frame (plan R6) go on their seat as they change them, also as ordinary commands.
 */
import { publicTravellerTest } from '#lib/features/player/travellers-in-play.ts';
import type { Script } from '#lib/core/data/index.ts';
import { buildInfo } from '#lib/build-info.ts';
import { toSavedGame } from '#lib/core/engine/index.ts';
import type { GameId, SeatId } from '#lib/core/model/index.ts';
import type { GamePhase, PlayersPhase } from '#lib/core/rules/game-phase.ts';
import {
	publicProjection,
	type PublicCorner,
	type PublicLook,
	type PublicGameState
} from '#lib/core/sync/public-projection.ts';
import { seatChanges } from '#lib/core/sync/room-seating.ts';
import {
	MAX_GRIMOIRE_BYTES,
	ROOM_PROTOCOL,
	type RoomMember,
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
import { gameFeedback } from './game-feedback.svelte.ts';
import { randomKey, RoomSocket, sha256Hex } from './room-socket.svelte.ts';
import { uploadRoomImage } from './room-images.ts';
import { viewerKeyFromPassword } from './viewer.svelte.ts';
import { gameSheetRules } from '#lib/features/modes/sheet-rules.ts';
import { seatRoles, type SeatRole } from '#lib/core/sync/seat-roles.ts';
import { newGrimViewPassword } from '#lib/core/sync/grim-view-password.ts';

const STORAGE_KEY = 'grim-games-room-host';

interface StoredRoom {
	code: string;
	key: string;
	/** The key Grim view's password makes, while Grim view is on. */
	viewerKey?: string;
	/** The Grim view password that key was made from. */
	viewerPassword?: string;
	/** The game that password was made for: the next game gets a new one (2026-10-26). */
	viewerGame?: string;
	/** The game whose players may see their own characters now (Trevor, 2026-10-26). */
	rolesShown?: string;
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
	/**
	 * The members whose phone is connected now; undefined from a room that doesn't say, when
	 * every member counts as here. The room keeps phones from earlier games (2026-10-25).
	 */
	present = $state.raw<readonly string[]>();
	/** The spectators' open vote and its count (Specters), if one is open. */
	vote = $state.raw<VoteTally>();
	/** The room's vote on the next script and its count (plan R1), if one is open. */
	scriptVote = $state.raw<ScriptVoteTally>();
	/** True when opening a room failed, e.g. offline. */
	problem = $state(false);
	/** True while a room is being opened. */
	opening = $state(false);
	/**
	 * The key Grim view's password makes, while the Storyteller has it on (Specters, Trevor
	 * 2026-10-18). Viewers see everything, so it is off until turned on.
	 */
	viewerKey = $state<string>();
	/**
	 * Grim view's password, while it is on (Trevor, 2026-10-26: "access password locked by
	 * storyteller ... default to a new password per game (that can be customizable)").
	 */
	viewerPassword = $state<string>();
	/** True when the grimoire is too large to send to viewers. */
	grimoireTooLarge = $state(false);
	/** How many are watching through the view-only link now (Trevor, 2026-10-20). */
	watchers = $state(0);
	/**
	 * The game whose players may see their own character on their phone (Trevor, 2026-10-26:
	 * "can turn on and off when ppl can see it"). Off until turned on, and per game.
	 */
	rolesShown = $state<string>();
	/** Seats whose player has held their character to see it (Trevor, 2026-10-26). */
	rolesSeen = $state.raw<readonly SeatId[]>([]);
	#roles: { gameId: string; show: boolean; roles: Record<SeatId, SeatRole> } | undefined;
	/**
	 * An admin is watching from Live games (plan J31): the whole grimoire goes to the room as
	 * for the view-only link, but nothing on this device says so, and the room keeps no copy.
	 */
	#grimoireWanted = $state(false);
	#viewerKeyHash: string | undefined;
	#grimoire: SharedGrimoire | undefined;
	#grimoireTimer: ReturnType<typeof setTimeout> | undefined;
	#openingRoom: Promise<void> | undefined;
	#choosing = false;
	/** Where the open board's game is up to (showPhase): players see it, and the day's timer. */
	#phase = $state.raw<{ gameId: string; phase: GamePhase }>();
	/** The day the Storyteller called Back to town in, which is Town until it ends. */
	#town = $state.raw<{ gameId: string; number: number }>();
	/** What the open board's corner shows, for the phones' corners (showCorner). */
	#corner = $state<{ gameId: string; corner: PublicCorner }>();
	/** The open board's background, vignette and logo, for every shared grim (showLook). */
	#look = $state<{ gameId: string; look: PublicLook }>();
	/** The board's own picture while its look has one, and its name in the room once uploaded. */
	#picture = $state.raw<Blob>();
	#uploaded = $state.raw<{ picture: Blob; code: string; hash: string }>();
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
			this.rolesShown = stored.rolesShown;
			this.viewerPassword = stored.viewerKey ? stored.viewerPassword : undefined;
			if (stored.viewerKey) void this.#useViewerKey(stored.viewerKey);
			this.#connect(stored);
			// Grim view from before passwords were all there was: the link is gone, so a password.
			if (stored.viewerKey && !stored.viewerPassword)
				void this.setViewerPassword(newGrimViewPassword());
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

	/** Turns Grim view on, with a new password, or off for every viewer. */
	async setViewers(on: boolean): Promise<void> {
		if (on === !!this.viewerKey) return;
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored) return;
		if (on) {
			// Set first, so the password below has a Grim view to change.
			this.viewerKey = randomKey();
			await this.setViewerPassword(newGrimViewPassword());
		} else {
			const { viewerKey: _off, viewerPassword: _password, viewerGame: _game, ...rest } = stored;
			void _off;
			void _password;
			void _game;
			writeStored(STORAGE_KEY, rest);
			this.viewerKey = undefined;
			this.viewerPassword = undefined;
			this.#viewerKeyHash = undefined;
			this.#socket?.send({ type: 'viewers', keyHash: null });
		}
	}

	/**
	 * A new password in one step (Trevor, 2026-10-20): the old one stops working and anyone
	 * watching with it is let go.
	 */
	async refreshViewers(): Promise<void> {
		await this.setViewerPassword(newGrimViewPassword());
	}

	/**
	 * Grim view's password (plan D1): the room code and it open the grimoire. One the
	 * Storyteller types lasts for this game; '' makes a new one. Either way the old one stops
	 * working and anyone watching with it is let go.
	 */
	async setViewerPassword(password: string): Promise<void> {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored || !this.viewerKey) return;
		const clean = password.trim() || newGrimViewPassword();
		const key = await viewerKeyFromPassword(stored.code, clean);
		const game = this.#game?.game.gameId ?? stored.viewerGame;
		writeStored(STORAGE_KEY, {
			...stored,
			viewerKey: key,
			viewerPassword: clean,
			...(game ? { viewerGame: game } : {})
		});
		this.viewerPassword = clean;
		await this.#useViewerKey(key);
	}

	/** Each game gets a new Grim view password (Trevor, 2026-10-26), once it opens here. */
	#newGameViewers(gameId: string): void {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored?.viewerKey || stored.viewerGame === gameId) return;
		if (stored.viewerGame) void this.refreshViewers();
		else writeStored(STORAGE_KEY, { ...stored, viewerGame: gameId });
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
	 * and a new one opened. Grim view that was on is on again, with the same password.
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
		this.#newGameViewers(game.game.gameId);
		this.#stopWatching = $effect.root(() => {
			// The whole grimoire, for Grim view while it is on.
			$effect(() => {
				if (!this.viewerKey && !this.#grimoireWanted) return;
				const saved = toSavedGame(game.session, Date.now());
				this.#queueGrimoire({
					saved: saved as unknown as Record<string, unknown>,
					...(notes?.() ?? storedNotes(game.game.gameId)),
					timer: liveDayTimer.shared,
					...this.#lookOf(game.game.gameId)
				});
			});
			$effect(() => {
				// Where the board draws the seats, so phones draw the town the same way (plan J13).
				const layout = notes ? parseSeatLayout(notes().layout) : seatLayouts.read(game.game.gameId);
				const corner = this.#corner?.gameId === game.game.gameId ? this.#corner.corner : undefined;
				const now = this.#playersPhase(game.game.gameId);
				const state = publicProjection(
					game.game,
					publicTravellerTest(game.game.gameId, game.characters),
					layout,
					corner,
					game.characters,
					gameSheetRules(game.game.gameId),
					now?.kind === 'day' ? liveDayTimer.forPlayers : undefined,
					now,
					this.#lookOf(game.game.gameId).look
				);
				this.#publish({ gameId: game.game.gameId, state });
			});
			// Each seat's own character, for its own phone, while players may see theirs.
			$effect(() => {
				const gameId = game.game.gameId;
				const show = this.rolesShown === gameId;
				const roles = show ? seatRoles(game.game, game.characters) : {};
				const next = { gameId, show, roles };
				if (JSON.stringify(next) === JSON.stringify(this.#roles)) return;
				this.#roles = next;
				this.#sendRoles();
			});
			$effect(() => {
				// Phones sit where their name is on the board (no seat picking, Trevor 2026-10-26).
				if (this.status !== 'open') return;
				const seats = game.game.seating.map((id) => game.game.seats[id]);
				for (const change of seatChanges(this.members, seats, (id) => this.isHere(id))) {
					this.#socket?.send(
						change.seatId
							? { type: 'seat', memberId: change.memberId, seatId: change.seatId }
							: { type: 'unseat', memberId: change.memberId }
					);
				}
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

	/**
	 * The board's background as it shows now, so the players' grim, Public Town and Grim view
	 * draw the town on the same one, whatever each device's own settings (Trevor, 2026-10-26).
	 */
	showLook(gameId: string, look: PublicLook, picture?: Blob): void {
		const shown = { gameId, look: $state.snapshot(look) as PublicLook };
		if (JSON.stringify(shown) !== JSON.stringify(this.#look)) this.#look = shown;
		this.#picture = look.background === 'image' ? picture : undefined;
		this.#uploadPicture();
	}

	/** Uploads the board's picture to the open room, once, so the table's grims show it too. */
	#uploadPicture(): void {
		const picture = this.#picture;
		const code = this.code;
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!picture || !code || stored?.code !== code) return;
		if (this.#uploaded?.picture === picture && this.#uploaded.code === code) return;
		uploadRoomImage(code, stored.key, picture)
			.then((hash) => {
				if (this.#picture === picture && this.code === code)
					this.#uploaded = { picture, code, hash };
			})
			// Not shared until the next try (a new look, or the room again): no background.
			.catch(() => undefined);
	}

	#lookOf(gameId: string): { look?: PublicLook } {
		if (this.#look?.gameId !== gameId) return {};
		const { look } = this.#look;
		const uploaded = this.#uploaded;
		const named =
			look.background === 'image' &&
			uploaded?.picture === this.#picture &&
			uploaded?.code === this.code;
		return { look: named ? { ...look, image: uploaded!.hash } : look };
	}

	/** Lets the players of game `gameId` see their own characters, or hides them again. */
	showRoles(gameId: GameId, on: boolean): void {
		this.rolesShown = on ? gameId : undefined;
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored) return;
		const { rolesShown: _old, ...rest } = stored;
		void _old;
		writeStored(STORAGE_KEY, on ? { ...rest, rolesShown: gameId } : rest);
	}

	#sendRoles(): void {
		const roles = this.#roles;
		// Sent after the game's public state, which the room checks the seats against.
		if (!roles || roles.gameId !== this.#published?.gameId) return;
		this.#socket?.send({
			type: 'roles',
			gameId: roles.gameId,
			show: roles.show,
			...(roles.show ? { roles: roles.roles } : {})
		});
	}

	/**
	 * Where the open board's game is up to, or nothing once it has ended (Trevor, 2026-10-26):
	 * players' phones show it as their status line, with the day timer during the day.
	 */
	showPhase(gameId: string, phase: GamePhase | undefined): void {
		if (!phase) {
			if (this.#phase?.gameId === gameId) this.#phase = undefined;
			return;
		}
		const next = { gameId, phase: $state.snapshot(phase) as GamePhase };
		if (JSON.stringify(next) !== JSON.stringify(this.#phase)) this.#phase = next;
	}

	/** The board's phase, with a day called Back to town shown as Town (plan J29). */
	#playersPhase(gameId: string): PlayersPhase | undefined {
		const phase = this.#phase?.gameId === gameId ? this.#phase.phase : undefined;
		if (phase?.kind !== 'day') return phase;
		const town = this.#town?.gameId === gameId && this.#town.number === phase.number;
		return town ? { kind: 'town', number: phase.number } : phase;
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

	/**
	 * Calls every player back to town (plan U2): each phone in the room sounds and vibrates.
	 * False when the room can't be reached.
	 */
	callTown(): boolean {
		const sent = this.#socket?.send({ type: 'call-town' }) ?? false;
		// The rest of the day is Town on players' phones (Trevor, 2026-10-26).
		const day = this.#phase?.phase;
		if (sent && day?.kind === 'day')
			this.#town = { gameId: this.#phase!.gameId, number: day.number };
		return sent;
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
				...(notes ?? storedNotes(gameId)),
				...this.#lookOf(gameId)
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
	 * if given, and the count shown to players when `showTally`. False when offline.
	 */
	openScriptVote(
		kind: ScriptVoteKind,
		options: ScriptVoteOption[],
		minutes?: number,
		subject: VoteSubject = 'script',
		showTally = false
	): boolean {
		return (
			this.#socket?.send({
				type: 'open-script-vote',
				voteId: crypto.randomUUID(),
				kind,
				options,
				...(minutes !== undefined ? { minutes } : {}),
				...(subject !== 'script' ? { subject } : {}),
				...(showTally ? { showTally } : {})
			}) ?? false
		);
	}

	/** Shows players the open script vote's count, or hides it (Trevor, 2026-10-26). */
	showScriptVoteTally(show: boolean): void {
		this.#socket?.send({ type: 'script-vote-tally', show });
	}

	/** Ends the script vote after a final call to phones (Trevor, 2026-10-26). */
	endScriptVote(): void {
		this.#socket?.send({ type: 'end-script-vote' });
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
		this.#uploadPicture();
		this.#socket = new RoomSocket(
			room.code,
			{
				type: 'hello',
				role: 'host',
				key: room.key,
				protocol: ROOM_PROTOCOL,
				builtAt: buildInfo.builtAt
			},
			(m) => this.#receive(m),
			() => this.#resend()
		);
	}

	/** Whether this member's phone is connected now (every member, from a room that doesn't say). */
	isHere(memberId: string): boolean {
		return this.present?.includes(memberId) ?? true;
	}

	/** Members with no seat whose phone is connected now: spectators, or players yet to sit. */
	get connectedUnseated(): RoomMember[] {
		return this.members.filter((m) => m.seatId === undefined && this.isHere(m.memberId));
	}

	#receive(message: ServerMessage): void {
		if (message.type === 'host-view') {
			this.#applySeats(this.members, message.members);
			this.members = message.members;
			this.present = message.present;
			this.vote = message.vote;
			this.scriptVote = message.scriptVote;
			this.rolesSeen = message.rolesSeen ?? [];
			// Saved with the ended game, as the room forgets it once a game runs again.
			if (message.feedback && message.feedbackGameId) {
				gameFeedback.save(message.feedbackGameId, message.feedback);
			}
		} else if (message.type === 'watchers') {
			this.watchers = message.count;
		} else if (message.type === 'grimoire-wanted') {
			this.#grimoireWanted = message.on;
			// After a reconnect it may already be on, with the grimoire made: send it again.
			if (message.on) this.#sendGrimoire();
		} else if (message.type === 'refused' && message.reason === 'too-old') {
			// The room is still this device's: keep it for after the update.
		} else if (message.type === 'refused' || message.type === 'closed') {
			// The room expired or this device no longer owns it.
			this.#forget();
		}
	}

	/**
	 * Puts each seated player's name, avatar and frame on their seat (plan R6). Only a change is
	 * applied: a seat the Storyteller has since changed back (by renaming or undoing) stays as it
	 * is until the player changes it again or moves seat.
	 */
	#applySeats(before: RoomMember[], after: RoomMember[]): void {
		const game = this.#game;
		if (!game) return;
		const look = (m: RoomMember) => `${m.seatId}|${m.avatar ?? ''}|${m.frame ?? ''}`;
		const was: Record<string, RoomMember> = Object.fromEntries(before.map((m) => [m.memberId, m]));
		for (const member of after) {
			const seat = member.seatId && game.game.seats[member.seatId];
			if (!seat) continue;
			const old = was[member.memberId] as RoomMember | undefined;
			const renamed = !!old && old.seatId === member.seatId && old.name !== member.name;
			if (renamed && member.name && seat.playerName !== member.name) {
				game.run({ type: 'RenameSeat', seatId: seat.seatId, playerName: member.name });
			}
			if (old && look(old) === look(member)) continue;
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
		if (!this.#grimoire || (!this.#viewerKeyHash && !this.#grimoireWanted)) return;
		const message = { type: 'grimoire', grimoire: this.#grimoire } as const;
		const tooLarge = JSON.stringify(message).length > MAX_GRIMOIRE_BYTES;
		// Said only for the view-only link: an admin's watching shows nowhere here.
		if (this.#viewerKeyHash) this.grimoireTooLarge = tooLarge;
		if (!tooLarge) this.#socket?.send(message);
	}

	#publish(published: { gameId: string; state: PublicGameState }): void {
		// The board's notes change with every reminder moved; the table only when it does.
		if (JSON.stringify(published) === JSON.stringify(this.#published)) return;
		this.#published = published;
		this.#resend();
	}

	#resend(): void {
		if (this.#published) this.#socket?.send({ type: 'publish', ...this.#published });
		this.#sendRoles();
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
		this.#grimoireWanted = false;
		this.code = undefined;
		this.members = [];
		this.present = undefined;
		this.vote = undefined;
		this.scriptVote = undefined;
		this.viewerKey = undefined;
		this.viewerPassword = undefined;
		this.revealedGame = undefined;
		this.rolesShown = undefined;
		this.rolesSeen = [];
		this.#roles = undefined;
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

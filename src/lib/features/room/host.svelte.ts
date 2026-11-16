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
import type { Script } from '#lib/core/data/index.ts';
import { buildInfo } from '#lib/build-info.ts';
import {
	DEFAULT_SHARE_CHOICES as GRIM_CHOICES,
	sharedSave,
	toSavedGame,
	type SavedGame,
	type ShareChoices
} from '#lib/core/engine/index.ts';
import type { GameId, SeatId } from '#lib/core/model/index.ts';
import type { GamePhase, PlayersPhase } from '#lib/core/rules/game-phase.ts';
import type {
	PublicCorner,
	PublicLook,
	PublicGameState
} from '#lib/core/sync/public-projection.ts';
import { seatChanges } from '#lib/core/sync/room-seating.ts';
import { seatPictures } from '#lib/core/sync/room-pictures.ts';
import { watchedParts } from '#lib/core/sync/watched-table.ts';
import {
	isNewerBuild,
	MAX_GRIMOIRE_BYTES,
	ROOM_PROTOCOL,
	type ClientMessage,
	type CountOffView,
	type RemovedMember,
	type RoomMember,
	type ServerMessage,
	type TransferStatus,
	type SharedGrimoire,
	type TownSoundCommand,
	type TravellerPickHostView,
	type VoteTally
} from '#lib/core/sync/room.ts';
import { lookForNewerBuild } from './newer-build.ts';
import type {
	ScriptVoteKind,
	ScriptVoteOption,
	ScriptVoteTally,
	VoteSubject
} from '#lib/core/sync/script-vote.ts';
import type { SoundOutput } from '#lib/core/sound/soundboard.ts';
import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { seatLayouts } from '#lib/features/board/device-notes.ts';
import { storedNotes, type BoardNotes } from './board-notes.ts';
import { parseSeatLayout } from '#lib/ui/seating/seat-layout.ts';
import { fetchWithTimeout } from '#lib/ui/fetch.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { gameFeedback } from './game-feedback.svelte.ts';
import { sha256Hex } from '#lib/core/codes/hash.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';
import { BoardLook } from './board-look.svelte.ts';
import { roomImagePath } from '#lib/core/sync/room-images.ts';
import { RoomInbox } from './inbox.svelte.ts';
import { tableState } from './table-state.svelte.ts';
import { seatRoles, type SeatRole } from '#lib/core/sync/seat-roles.ts';
import { seatPresence, type SeatPresence } from '#lib/core/sync/seat-presence.ts';
import { applyTravellerPicks } from './host-traveller-pick.ts';
import { STORAGE_KEY, type StoredRoom } from './host-storage.ts';
import { RolesShown } from './roles-shown.svelte.ts';
import { SeatLooks } from './seat-looks.svelte.ts';
import { applySeats, boardPlaces, grantSit } from './host-seating.ts';

/** Changes are gathered for this long before the grimoire is sent to Grim view again. */
const GRIMOIRE_DELAY_MS = 300;

export class RoomHost {
	code = $state<string>();
	members = $state.raw<RoomMember[]>([]);
	/**
	 * The members whose phone is connected now; undefined from a room that doesn't say, when
	 * every member counts as here. The room keeps phones from earlier games (2026-10-25).
	 */
	present = $state.raw<readonly string[]>();
	away = $state.raw<readonly string[]>([]); // Phones asleep or in the background this game.
	vote = $state.raw<VoteTally>(); // The spectators' open vote and its count (Specters).
	scriptVote = $state.raw<ScriptVoteTally>(); // The vote on the next script (plan R1).
	problem = $state(false); // Opening a room failed, e.g. offline.
	opening = $state(false); // A room is being opened.
	removed = $state.raw<readonly RemovedMember[]>([]); // Phones removed this game (plan J37).
	/**
	 * Members the Storyteller gave Grim view (Trevor, 2026-11-16: a switch per person on
	 * Players), and what of the game goes to them (`ShareChoices`, as Share grim's).
	 */
	grimViewers = $state.raw<readonly string[]>([]);
	grimChoices = $state.raw<ShareChoices>(GRIM_CHOICES);
	grimoireTooLarge = $state(false); // Too large to send to Grim view.
	watchers = $state(0); // Phones with Grim view connected now (Trevor, 2026-10-20).
	readonly rolesShown = new RolesShown(); // Players may see their own character, for a minute.
	rolesSeen = $state.raw<readonly SeatId[]>([]); // Their player held the character to see it.
	seatingOpen = $state(false); // Phones may move their own seat (plan J38).
	countOff = $state.raw<CountOffView>(); // The count off, while one is open (plan J40).
	travellerPick = $state.raw<TravellerPickHostView>(); // Travellers choosing on their phones.
	transfer = $state.raw<TransferStatus>(); // The open Room transfer (room-transfer.svelte.ts).
	sendingGame = $state(false); // The grimoire goes to the room: a Room transfer brings it.
	onMessage: ((message: ServerMessage) => void) | undefined; // Hears the room first (transfer).
	/** Players' messages and reported pictures, for the Storyteller's Messages. */
	readonly inbox = new RoomInbox((m) => this.#socket?.send(m) ?? false);
	#roles:
		| {
				gameId: string;
				show: boolean;
				roles: Record<SeatId, SeatRole>;
				open: SeatId[];
				until?: number;
		  }
		| undefined;
	readonly seatLooks = new SeatLooks(); // A seat given to a spectator: its own character.
	/**
	 * An admin is watching from Live games (plan J31): the whole grimoire goes to the room,
	 * but nothing on this device says so, and the room keeps no copy.
	 */
	#grimoireWanted = $state(false);
	#grimoire: { whole: SharedGrimoire; shared: SharedGrimoire } | undefined;
	#grimoireTimer: ReturnType<typeof setTimeout> | undefined;
	#openingRoom: Promise<void> | undefined;
	#choosing = false;
	/** Where the open board's game is up to (showPhase): players see it, and the day's timer. */
	#phase = $state.raw<{ gameId: string; phase: GamePhase }>();
	#town = $state.raw<{ gameId: string; number: number }>(); // Back to town's day, Town till over.
	#corner = $state<{ gameId: string; corner: PublicCorner }>(); // For phones' corners (showCorner).
	#board = new BoardLook(); // The open board's look and shape, for every shared grim.
	#ended:
		| { gameId: GameId; ended: { winner?: 'good' | 'evil'; reason?: string } | undefined }
		| undefined;
	#result: { gameId: GameId; result: string } | undefined;
	#socket = $state.raw<RoomSocket>();
	#game: OpenGame | undefined;
	#stopWatching: (() => void) | undefined;
	#published: { gameId: string; state: PublicGameState } | undefined;
	/** The same, for the grimoire sent to other devices to follow; only #publish writes it. */
	#table = $state.raw<{ gameId: string; state: PublicGameState }>();
	#script: Script | undefined;

	constructor() {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (stored?.code && stored.key) {
			this.rolesShown.restore(stored);
			if (stored.grimChoices) this.grimChoices = stored.grimChoices;
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
			const response = await fetchWithTimeout('/api/rooms', {
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

	/**
	 * Gives one member Grim view, sending `choices` of the game to everyone who has it, or
	 * takes it away (Trevor, 2026-11-16: a switch per person on Players). False when offline.
	 */
	setGrimView(memberId: string, on: boolean, choices?: ShareChoices): boolean {
		const others = this.grimViewers.filter((id) => id !== memberId);
		const members = on ? [...others, memberId] : others;
		if (!this.#socket?.send({ type: 'grim-viewers', members })) return false;
		this.grimViewers = members;
		if (choices) this.setGrimChoices(choices);
		return true;
	}

	/** A new code (Trevor, 2026-10-20): the old room is deleted, its phones let go, and a new one opened. */
	async refreshRoom(): Promise<void> {
		this.close();
		await this.open();
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
			// The whole grimoire, for Grim view while anyone has it, an admin or a transfer.
			$effect(() => {
				if (!this.grimViewers.length && !this.#grimoireWanted && !this.sendingGame) return;
				const { gameId } = game.game;
				const saved = toSavedGame(game.session, Date.now());
				const board = notes?.() ?? storedNotes(gameId);
				const timer = liveDayTimer.shared;
				this.#queueGrimoire({
					whole: { ...this.#drawn(gameId, saved, board), timer },
					shared: { ...this.#drawn(gameId, sharedSave(saved, this.grimChoices), board), timer }
				});
			});
			$effect(() => {
				// Where the board draws the seats, so phones draw the town the same way (plan J13).
				const layout = notes ? parseSeatLayout(notes().layout) : seatLayouts.read(game.game.gameId);
				const corner = this.#corner?.gameId === game.game.gameId ? this.#corner.corner : undefined;
				const state = tableState(
					this,
					game.game,
					game.characters,
					{ ...layout, ...this.#board.aspectOf(game.game.gameId) },
					corner
				);
				this.#publish({ gameId: game.game.gameId, state });
			});
			// Each seat's own character, for its own phone, while players may see theirs.
			$effect(() => {
				const gameId = game.game.gameId;
				const show = this.rolesShown.gameId === gameId;
				const seatOf = (id: string) => this.members.find((m) => m.memberId === id)?.seatId;
				const open = show ? [] : this.seatLooks.open(gameId, seatOf);
				const all = show || open.length ? seatRoles(game.game, game.characters) : {};
				const roles = show
					? all
					: Object.fromEntries(open.flatMap((id) => (all[id] ? [[id, all[id]]] : [])));
				const next = { gameId, show, roles, open, until: show ? this.rolesShown.until : undefined };
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
		this.#board.show(gameId, look, picture, this.code);
	}

	/** The board's look, while it is this game's (showLook). */
	lookOf(gameId: string): { look?: PublicLook } {
		return this.#board.lookOf(gameId, this.code);
	}

	/**
	 * The board's shape as it shows now (width ÷ height, boardAspect), so every shared grim
	 * keeps each seat at the board's place round the ring (Trevor, 2026-10-27).
	 */
	showAspect(gameId: string, aspect: number | undefined): void {
		this.#board.showAspect(gameId, aspect);
	}

	/** A grimoire drawn on another device: the game, its notes, look and shape, and watchedParts. */
	#drawn(gameId: string, saved: SavedGame, notes: BoardNotes): SharedGrimoire {
		const table = this.#table?.gameId === gameId ? this.#table.state : undefined;
		const over = this.ended?.gameId === gameId ? this.ended : undefined;
		return {
			saved: saved as unknown as Record<string, unknown>,
			...notes,
			...this.lookOf(gameId),
			...this.#board.aspectOf(gameId),
			...watchedParts(seatPictures(this.members), table, over)
		};
	}

	/** Lets the players of game `gameId` see their own characters, or hides them again. */
	showRoles(gameId: GameId, on: boolean): void {
		this.rolesShown.set(on ? gameId : undefined);
	}

	#sendRoles(): void {
		const roles = this.#roles;
		// Sent after the game's public state, which the room checks the seats against.
		if (!roles || roles.gameId !== this.#published?.gameId) return;
		this.#socket?.send({
			type: 'roles',
			gameId: roles.gameId,
			show: roles.show,
			...(roles.show || roles.open.length ? { roles: roles.roles } : {}),
			...(roles.open.length ? { open: roles.open } : {}),
			...(roles.until !== undefined ? { until: roles.until } : {})
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
	playersPhase(gameId: string): PlayersPhase | undefined {
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
	 * Calls every player back to town (plan U2): each phone sounds `sound`, the Storyteller's
	 * pick, and vibrates. False when the room can't be reached.
	 */
	callTown(sound?: string): boolean {
		const sent = this.#socket?.send({ type: 'call-town', ...(sound ? { sound } : {}) }) ?? false;
		// The rest of the day is Town on players' phones (Trevor, 2026-10-26).
		const day = this.#phase?.phase;
		if (sent && day?.kind === 'day')
			this.#town = { gameId: this.#phase!.gameId, number: day.number };
		return sent;
	}

	/** Soundboard sounds on the devices Play on names, never this one; false when offline. */
	townSound(command: TownSoundCommand, to: SoundOutput): boolean {
		return this.#socket?.send({ type: 'town-sound', to, ...command }) ?? false;
	}

	/** The game that is over (End game), with how, as phones are told (Share grim, R5). */
	ended = $state.raw<{ gameId: GameId; winner?: 'good' | 'evil'; reason?: string }>();
	/**
	 * The final grimoire the room's phones were sent (Share grim, R5), for the player view too,
	 * and what went with it, for changing that live (Trevor, 2026-11-16, option B).
	 */
	revealed = $state.raw<{ gameId: string; grimoire: SharedGrimoire; choices: ShareChoices }>();

	/**
	 * Share grim (R5): sends the whole grimoire to the room's phones once the game is over.
	 * False when it is too large or the room is offline. `choices` picks what else goes
	 * (`sharedSave`; Trevor, 2026-11-15: "we don't always want to share everything").
	 */
	reveal(game: OpenGame, choices: ShareChoices, notes?: BoardNotes): boolean {
		const gameId = game.game.gameId;
		const saved = sharedSave(toSavedGame(game.session, Date.now()), choices);
		const message = {
			type: 'reveal',
			gameId,
			grimoire: this.#drawn(gameId, saved, notes ?? storedNotes(gameId))
		} as const;
		if (JSON.stringify(message).length > MAX_GRIMOIRE_BYTES) return false;
		if (!this.#socket?.send(message)) return false;
		this.revealed = { gameId, grimoire: message.grimoire, choices };
		return true;
	}

	/**
	 * Stops sharing the final grimoire (Trevor, 2026-11-16, option B: "allow for letting more or
	 * less"): the room drops it and its phones stop showing it. False when offline.
	 */
	unreveal(gameId: GameId): boolean {
		if (!this.#socket?.send({ type: 'unreveal', gameId })) return false;
		if (this.revealed?.gameId === gameId) this.revealed = undefined;
		return true;
	}

	/** Changes what goes to everyone with Grim view, sent at once, and remembers it. */
	setGrimChoices(choices: ShareChoices): void {
		this.grimChoices = choices;
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (stored) writeStored(STORAGE_KEY, { ...stored, grimChoices: choices });
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

	/** Ends the script vote at once (Trevor, 2026-10-30). */
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
		this.ended = ended ? { gameId, ...ended } : undefined;
		// Reopen takes the shared grimoire back (the room drops it too).
		if (!ended && this.revealed?.gameId === gameId) this.revealed = undefined;
		// and its result, which a new End game shares again.
		if (!ended && this.#result?.gameId === gameId) this.#result = undefined;
		this.#sendEnded();
	}

	/**
	 * The ended game's name-free result page (plan R4, game-result.ts), for phones to share;
	 * it goes with the game-over, now and after a reconnect.
	 */
	setResult(gameId: GameId, result: string): void {
		this.#result = { gameId, result };
		this.#sendEnded();
	}

	#sendEnded(): void {
		if (!this.#ended || this.#ended.gameId !== this.#published?.gameId) return;
		const { gameId, ended } = this.#ended;
		const result = this.#result?.gameId === gameId ? { result: this.#result.result } : {};
		this.#socket?.send(
			ended ? { type: 'game-over', gameId, ...ended, ...result } : { type: 'reopen-game', gameId }
		);
	}

	#connect(room: StoredRoom): void {
		this.#socket?.stop();
		this.code = room.code;
		this.#board.upload(room.code);
		this.#socket = new RoomSocket(
			room.code,
			{
				type: 'hello',
				role: 'host',
				key: room.key,
				protocol: ROOM_PROTOCOL,
				builtAt: buildInfo.builtAt,
				inbox: true
			},
			(m) => this.#receive(m),
			() => this.#resend()
		);
	}

	/** Whether this member's phone is connected now (every member, from a room that doesn't say). */
	isHere(memberId: string): boolean {
		return this.present?.includes(memberId) ?? true;
	}

	/** Where to load the picture of the player seated at `seatId`, if they have one. */
	pictureOf(seatId: SeatId): string | undefined {
		const hash = this.members.find((m) => m.seatId === seatId)?.picture;
		return hash && this.code ? roomImagePath(this.code, hash) : undefined;
	}

	/** Who is connected, for the candles beside Setup: away phones from this game count too. */
	get seatPresence(): SeatPresence {
		return seatPresence(this.members, (id) => this.isHere(id), this.away);
	}

	/** Members with no seat whose phone is connected now: spectators, or players yet to sit. */
	get connectedUnseated(): RoomMember[] {
		return this.members.filter((m) => m.seatId === undefined && this.isHere(m.memberId));
	}

	/**
	 * Members with no seat who are at the table: connected now, or away during this game (a
	 * screen turned off, bug report #3), never phones from earlier games. Name lists use it.
	 */
	get unseatedInGame(): RoomMember[] {
		return this.members.filter(
			(m) => m.seatId === undefined && (this.isHere(m.memberId) || this.away.includes(m.memberId))
		);
	}

	/** Sends to the room now; false when offline. */
	send(message: ClientMessage): boolean {
		return this.#socket?.send(message) ?? false;
	}

	/** Makes the room `code` this device's, with its new host key (Room transfer). */
	adopt(code: string, key: string): void {
		writeStored(STORAGE_KEY, { code, key });
		this.#connect({ code, key });
	}

	#receive(message: ServerMessage): void {
		this.onMessage?.(message);
		if (message.type === 'host-view') {
			// A phone runs a newer build: offer it here too, through the update card.
			if (isNewerBuild(message.newestBuiltAt, buildInfo.builtAt)) lookForNewerBuild();
			this.transfer = message.transfer;
			if (this.#game) applySeats(this.#game, this.members, message.members);
			this.members = message.members;
			this.present = message.present;
			this.away = message.away ?? [];
			this.removed = message.removed ?? [];
			this.grimViewers = message.grimViewers ?? [];
			this.seatingOpen = !!message.seatingOpen;
			this.countOff = message.countOff;
			applyTravellerPicks(this.#game, this.travellerPick, message.travellerPick);
			this.travellerPick = message.travellerPick;
			this.vote = message.vote;
			this.scriptVote = message.scriptVote;
			this.rolesSeen = message.rolesSeen ?? [];
			this.inbox.receive(message);
			// Saved with the ended game, as the room forgets it once a game runs again.
			if (message.feedback && message.feedbackGameId) {
				gameFeedback.save(message.feedbackGameId, message.feedback);
			}
		} else if (message.type === 'sit') {
			if (this.#game) grantSit(this.#game, this.members, message, boardPlaces(this.#game));
		} else if (message.type === 'watchers') {
			this.watchers = message.count;
		} else if (message.type === 'grimoire-wanted') {
			this.#grimoireWanted = message.on;
			// After a reconnect it may already be on, with the grimoire made: send it again.
			if (message.on) this.#sendGrimoire();
		} else if (message.type === 'refused' && message.reason === 'too-old') {
			// The room is still this device's: keep it for after the update.
		} else if (['refused', 'closed', 'handed-over'].includes(message.type)) {
			// The room expired, or this device no longer owns it (another took it over).
			this.#forget();
		}
	}

	#queueGrimoire(grimoire: { whole: SharedGrimoire; shared: SharedGrimoire }): void {
		this.#grimoire = grimoire;
		clearTimeout(this.#grimoireTimer);
		this.#grimoireTimer = setTimeout(() => this.#sendGrimoire(), GRIMOIRE_DELAY_MS);
	}

	#sendGrimoire(): void {
		if (!this.#grimoire) return;
		const fits = (m: unknown) => JSON.stringify(m).length <= MAX_GRIMOIRE_BYTES;
		if (this.#grimoireWanted || this.sendingGame) {
			const whole = { type: 'grimoire', grimoire: this.#grimoire.whole } as const;
			if (fits(whole)) this.#socket?.send(whole);
		}
		if (!this.grimViewers.length) return;
		const shared = { type: 'grim-view', grimoire: this.#grimoire.shared } as const;
		// Said only for Grim view: an admin's watching shows nowhere here.
		this.grimoireTooLarge = !fits(shared);
		if (!this.grimoireTooLarge) this.#socket?.send(shared);
	}

	#publish(published: { gameId: string; state: PublicGameState }): void {
		// The board's notes change with every reminder moved; the table only when it does.
		if (JSON.stringify(published) === JSON.stringify(this.#published)) return;
		this.#published = published;
		this.#table = published;
		this.#resend();
	}

	#resend(): void {
		if (this.#published) this.#socket?.send({ type: 'publish', ...this.#published });
		this.#sendRoles();
		this.#sendEnded();
		if (this.#choosing) this.#socket?.send({ type: 'choosing', on: true });
		if (this.#script) this.#socket?.send({ type: 'script', script: this.#script });
		this.#sendGrimoire();
	}

	#forget(): void {
		this.#socket?.stop();
		this.#socket = undefined;
		this.watchers = 0;
		this.#grimoireWanted = false;
		this.code = undefined;
		this.members = [];
		this.present = undefined;
		this.away = [];
		this.removed = [];
		this.seatingOpen = false;
		this.countOff = this.travellerPick = undefined;
		this.vote = undefined;
		this.scriptVote = undefined;
		this.grimViewers = [];
		this.revealed = undefined;
		this.rolesShown.stop();
		this.rolesSeen = [];
		this.transfer = undefined;
		this.sendingGame = false;
		this.inbox.clear();
		this.#roles = undefined;
		this.seatLooks.clear();
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

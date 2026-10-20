/**
 * The Storyteller's side of a live room (07-accounts-and-multi-device.md §4.2). The room
 * belongs to this device, not to a game: its code and host key are kept here, so the same
 * players stay in it from one game to the next.
 *
 * While a game is attached, its public projection is published on every change. Nothing a
 * phone sends changes the grimoire until the Storyteller approves it, and approving runs an
 * ordinary command, so it shows in History and can be rolled back.
 */
import { publicTravellerTest } from '#lib/features/player/travellers-in-play.ts';
import type { Script } from '#lib/core/data/index.ts';
import { toSavedGame } from '#lib/core/engine/index.ts';
import type { GameId, SeatId } from '#lib/core/model/index.ts';
import { publicProjection, type PublicGameState } from '#lib/core/sync/public-projection.ts';
import {
	MAX_GRIMOIRE_BYTES,
	ROOM_PROTOCOL,
	type RoomMember,
	type RoomRequest,
	type ServerMessage,
	type SharedGrimoire,
	type VoteTally
} from '#lib/core/sync/room.ts';
import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import {
	reminderCopyIds,
	reminderSpots,
	seatLayouts
} from '#lib/features/grimoire/device-notes.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { randomKey, RoomSocket, sha256Hex } from './room-socket.svelte.ts';

const STORAGE_KEY = 'grim-games-room-host';

interface StoredRoom {
	code: string;
	key: string;
	/** The key in the view-only grimoire link, while it is on. */
	viewerKey?: string;
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
	/** True when the grimoire is too large to send to viewers. */
	grimoireTooLarge = $state(false);
	/** How many are watching through the view-only link now (Trevor, 2026-10-20). */
	watchers = $state(0);
	#viewerKeyHash: string | undefined;
	#grimoire: SharedGrimoire | undefined;
	#grimoireTimer: ReturnType<typeof setTimeout> | undefined;
	#openingRoom: Promise<void> | undefined;
	#socket = $state.raw<RoomSocket>();
	#game: OpenGame | undefined;
	#stopWatching: (() => void) | undefined;
	#published: { gameId: string; state: PublicGameState } | undefined;
	#script: Script | undefined;

	constructor() {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (stored?.code && stored.key) {
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
			const { viewerKey: _off, ...rest } = stored;
			void _off;
			writeStored(STORAGE_KEY, rest);
			this.viewerKey = undefined;
			this.#viewerKeyHash = undefined;
			this.#socket?.send({ type: 'viewers', keyHash: null });
		}
	}

	/**
	 * A new view-only link in one step (Trevor, 2026-10-20): the old one stops working and
	 * anyone watching with it is let go.
	 */
	async refreshViewers(): Promise<void> {
		const stored = readStored<StoredRoom>(STORAGE_KEY);
		if (!stored || !this.viewerKey) return;
		const key = randomKey();
		writeStored(STORAGE_KEY, { ...stored, viewerKey: key });
		await this.#useViewerKey(key);
	}

	async #useViewerKey(key: string): Promise<void> {
		this.viewerKey = key;
		const hash = await sha256Hex(key);
		if (this.viewerKey !== key) return;
		this.#viewerKeyHash = hash;
		this.#socket?.send({ type: 'viewers', keyHash: hash });
		this.#sendGrimoire();
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
				const state = publicProjection(
					game.game,
					publicTravellerTest(game.game.gameId, game.characters)
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
			this.members = message.members;
			this.requests = message.requests;
			this.vote = message.vote;
		} else if (message.type === 'watchers') {
			this.watchers = message.count;
		} else if (message.type === 'refused' && message.reason === 'too-old') {
			// The room is still this device's: keep it for after the update.
		} else if (message.type === 'refused' || message.type === 'closed') {
			// The room expired or this device no longer owns it.
			this.#forget();
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
		this.#published = published;
		this.#resend();
	}

	#resend(): void {
		if (this.#published) this.#socket?.send({ type: 'publish', ...this.#published });
		if (this.#script) this.#socket?.send({ type: 'script', script: this.#script });
		// While a stored key's hash is still being worked out, say nothing about viewers.
		if (!this.viewerKey) this.#socket?.send({ type: 'viewers', keyHash: null });
		else if (this.#viewerKeyHash) {
			this.#socket?.send({ type: 'viewers', keyHash: this.#viewerKeyHash });
			this.#sendGrimoire();
		}
	}

	#forget(): void {
		this.#socket?.stop();
		this.#socket = undefined;
		this.watchers = 0;
		this.code = undefined;
		this.members = [];
		this.requests = [];
		this.vote = undefined;
		this.viewerKey = undefined;
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

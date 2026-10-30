/**
 * A fake Storyteller (scripts/room-bots.ts `--storyteller`, the Test room page): opens a room the way the app does
 * (`POST /api/rooms` with the host key's hash, then `hello` as host; worker/room.ts) and plays
 * a whole game through it with the bots, checking at each step that every phone got there.
 * It sends only what the room accepts from a Storyteller (`ClientMessage`); the board, the
 * engine and the night order are the real app's, so this tests the room, not the rules.
 */
import { sha256Hex } from '#lib/core/codes/hash.ts';
import type { PublicGameState, PublicSeat } from '#lib/core/sync/public-projection.ts';
import type { ClientMessage, HostView, ServerMessage } from '#lib/core/sync/room-protocol.ts';
import type { SitWish } from '#lib/core/sync/room-seating-open.ts';
import { fetchWithTimeout } from '#lib/ui/fetch.ts';
import { JoinQueue, newKey, RoomSocket } from './socket.ts';

export interface Step {
	name: string;
	ok: boolean;
	ms: number;
	detail?: string;
}

export class FakeStoryteller {
	code = '';
	host: HostView | undefined;
	readonly steps: Step[] = [];
	/** Wishes to sit the phones have sent, granted or not. */
	wishes = 0;
	readonly #key = newKey();
	#socket: RoomSocket | undefined;
	#seats: PublicSeat[] = [];
	#gameId = `bots-${Date.now().toString(36)}`;
	#now: PublicGameState['now'] = { kind: 'setup' };
	#today: PublicGameState['today'] = { nominations: [], executions: [] };
	#waiters = new Set<() => void>();

	private readonly site: string;
	private readonly queue: JoinQueue;
	private readonly log: (line: string) => void;
	private readonly timeoutMs: number;

	constructor(site: string, queue: JoinQueue, log: (line: string) => void, timeoutMs: number) {
		this.site = site;
		this.queue = queue;
		this.log = log;
		this.timeoutMs = timeoutMs;
	}

	/** Opens a new room and connects to it as its Storyteller. */
	async open(): Promise<string> {
		const response = await fetchWithTimeout(new URL('/api/rooms', this.site), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ hostKeyHash: await sha256Hex(this.#key) })
		});
		if (!response.ok)
			throw new Error(`opening a room: ${response.status} ${await response.text()}`);
		this.code = ((await response.json()) as { code: string }).code;
		this.#socket = new RoomSocket(
			this.site,
			this.code,
			'host',
			this.#key,
			{
				message: (m) => this.#receive(m),
				closed: (code, reason) => this.log(`Storyteller: disconnected (${code} ${reason})`)
			},
			this.queue,
			{ inbox: true }
		);
		await this.#socket.connect();
		await this.#until('the room answers', () => !!this.host);
		return this.code;
	}

	send(message: ClientMessage): void {
		this.#socket?.send(message);
	}

	close(): void {
		this.send({ type: 'close' });
	}

	#receive(message: ServerMessage | SitWish): void {
		if (message.type === 'host-view') this.host = message;
		else if (message.type === 'sit') {
			this.wishes++;
			this.#sit(message);
		}
		for (const wake of this.#waiters) wake();
	}

	/** Waits until `ready` holds, re-checked on every message and every half second. */
	#until(name: string, ready: () => boolean): Promise<boolean> {
		if (ready()) return Promise.resolve(true);
		return new Promise((resolve) => {
			const done = (ok: boolean) => {
				this.#waiters.delete(check);
				clearInterval(poll);
				clearTimeout(timer);
				resolve(ok);
			};
			const check = () => ready() && done(true);
			const poll = setInterval(check, 500);
			const timer = setTimeout(() => {
				this.log(`Storyteller: gave up waiting for ${name}`);
				done(false);
			}, this.timeoutMs);
			this.#waiters.add(check);
		});
	}

	/** One step of the game: does it, then waits until it shows everywhere it should. */
	async step(name: string, act: () => void, ready: () => boolean, detail?: () => string) {
		const start = Date.now();
		act();
		const ok = await this.#until(name, ready);
		const step: Step = { name, ok, ms: Date.now() - start };
		if (!ok && detail) step.detail = detail();
		this.steps.push(step);
		this.log(
			`${ok ? '✓' : '✗'} ${name} (${(step.ms / 1000).toFixed(1)} s)${step.detail ? `: ${step.detail}` : ''}`
		);
		return ok;
	}

	members() {
		const present = new Set(this.host?.present ?? []);
		return (this.host?.members ?? []).filter((m) => present.has(m.memberId));
	}

	seats(): readonly PublicSeat[] {
		return this.#seats;
	}

	/** A new game with `count` empty seats. */
	setUp(count: number): void {
		this.#gameId = `bots-${Date.now().toString(36)}`;
		this.#seats = Array.from({ length: count }, (_, i) => ({
			seatId: `seat-${i + 1}`,
			seatNumber: i + 1,
			dead: false
		}));
		this.#now = { kind: 'setup' };
		this.publish();
	}

	get gameId(): string {
		return this.#gameId;
	}

	publish(): void {
		this.#seats = this.#seats.map((s, i) => ({ ...s, seatNumber: i + 1 }));
		const state: PublicGameState = { seats: this.#seats, today: this.#today, now: this.#now };
		this.send({ type: 'publish', gameId: this.#gameId, state });
	}

	/** The town's phase, with a fresh day's nominations at each new day. */
	phase(kind: 'night' | 'day', number: number): void {
		this.#now = { kind, number };
		if (kind === 'day') this.#today = { nominations: [], executions: [] };
		this.publish();
	}

	kill(seatId: string): void {
		this.#seats = this.#seats.map((s) =>
			s.seatId === seatId ? { ...s, dead: true, ghostVote: 'unused' } : s
		);
	}

	execute(nominator: string, nominee: string): void {
		this.#today = {
			nominations: [...this.#today.nominations, { nominator, nominee }],
			executions: [...this.#today.executions, nominee]
		};
		this.kill(nominee);
		this.publish();
	}

	/**
	 * A phone's wish to sit (room-seating-open.ts), granted the way the app's board does: the
	 * seat takes the phone's name, and the room puts the phone in it.
	 */
	#sit(wish: SitWish): void {
		const member = this.host?.members.find((m) => m.memberId === wish.memberId);
		if (!member?.name) return;
		if (wish.seatId) {
			const seat = this.#seats.find((s) => s.seatId === wish.seatId);
			if (!seat || (seat.playerName && !/^Seat \d+$/.test(seat.playerName))) return;
			this.#seats = this.#seats.map((s) => (s === seat ? { ...s, playerName: member.name } : s));
			this.publish();
			this.send({ type: 'seat', memberId: member.memberId, seatId: seat.seatId });
			return;
		}
		const own = this.#seats.find((s) => s.playerName === member.name);
		if (!own || own.seatId === wish.after) return;
		const rest = this.#seats.filter((s) => s !== own);
		const at = rest.findIndex((s) => s.seatId === wish.after);
		rest.splice(at + 1, 0, own);
		this.#seats = rest;
		this.publish();
	}

	/** Puts the count off's order on the board: number 1 in the first seat, and so on. */
	seatByCount(): void {
		const byName = new Map(this.#seats.map((s) => [s.playerName, s]));
		const order = (this.host?.countOff?.tokens ?? [])
			.toSorted((a, b) => a.number - b.number)
			.flatMap((t) => byName.get(t.name) ?? []);
		const left = this.#seats.filter((s) => !order.includes(s));
		this.#seats = [...order, ...left];
		this.publish();
	}
}

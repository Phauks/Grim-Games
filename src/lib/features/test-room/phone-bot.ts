/**
 * A fake player's phone (scripts/room-bots.ts, the Test room page): joins the room, keeps its
 * latest view and, while `auto`, answers it as brain.ts decides, after a pause like a person's.
 * `act` makes one tap now (the Test room's fast tools). `lock` drops it as a phone does when its
 * screen locks, and `unlock` brings it back with the same key; `flaky` does that now and then.
 */
import type { PlayerView, ServerMessage } from '#lib/core/sync/room-protocol.ts';
import {
	action,
	replies,
	type BotAction,
	type BotMemory,
	type BotSelf
} from '#lib/core/sync/room-bots/brain.ts';
import { JoinQueue, newKey, RoomSocket } from './socket.ts';

export interface PhoneBotOptions {
	site: string;
	code: string;
	queue: JoinQueue;
	/** The longest pause before answering, in ms; each answer waits a random part of it. */
	thinkMs: number;
	flaky: boolean;
	/** This phone's own key, to be the same player as before (a new one when missing). */
	key?: string;
	/** Answers by itself (the default); otherwise it only names itself and waits for `act`. */
	auto?: boolean;
	log: (line: string) => void;
	/** Something changed for this bot (a view, a close), for the runner's checks. */
	changed: () => void;
}

export class PhoneBot {
	view: PlayerView | undefined;
	/** Every phase the phone was shown, such as `night 1`, in order. */
	readonly phases: string[] = [];
	/** Why the room shut this phone out, if it did; it then stays out. */
	refused: string | undefined;
	sent = 0;
	auto: boolean;
	readonly #socket: RoomSocket;
	#memory: BotMemory = {};
	#thinking: ReturnType<typeof setTimeout> | undefined;
	#stopped = false;
	#flaking: ReturnType<typeof setTimeout> | undefined;
	#locked = false;

	readonly self: BotSelf;
	private readonly options: PhoneBotOptions;

	constructor(self: BotSelf, options: PhoneBotOptions) {
		this.self = self;
		this.options = options;
		this.auto = options.auto ?? true;
		this.#socket = new RoomSocket(
			options.site,
			options.code,
			'player',
			options.key ?? newKey(),
			{ message: (m) => this.#receive(m), closed: (code, reason) => this.#closed(code, reason) },
			options.queue
		);
	}

	get name(): string {
		return this.self.name;
	}

	get connected(): boolean {
		return this.#socket.open;
	}

	/** The phone's key: a phone frame given it is this same player (features/test-room). */
	get key(): string {
		return this.#socket.key;
	}

	get locked(): boolean {
		return this.#locked;
	}

	/** One tap now; false when the view offers nothing to tap or the phone is offline. */
	act(kind: BotAction): boolean {
		const message = this.view && action(kind, this.view, this.self);
		if (!message || !this.#socket.send(message)) return false;
		this.sent++;
		return true;
	}

	/** The screen locks: the phone drops out of the room until `unlock`. */
	lock(): void {
		if (this.#stopped || this.#locked) return;
		this.#locked = true;
		this.options.log(`${this.name}: screen locked`);
		this.#socket.drop();
		this.options.changed();
	}

	unlock(): void {
		if (this.#stopped || !this.#locked) return;
		this.#locked = false;
		this.options.log(`${this.name}: back`);
		void this.start().catch((e: Error) => this.options.log(`${this.name}: ${e.message}`));
	}

	async start(): Promise<void> {
		await this.#socket.connect();
		if (this.options.flaky) this.#flake();
	}

	stop(): void {
		this.#stopped = true;
		clearTimeout(this.#thinking);
		clearTimeout(this.#flaking);
		this.#socket.drop();
	}

	#receive(message: ServerMessage): void {
		if (message.type === 'refused') {
			this.refused = message.reason;
			this.options.log(`${this.name}: refused (${message.reason})`);
			return;
		}
		if (message.type === 'closed') return;
		if (message.type !== 'player-view') return;
		this.view = message;
		const now = message.public?.now;
		const phase = now ? (now.kind === 'setup' ? 'setup' : `${now.kind} ${now.number}`) : '';
		if (phase && this.phases.at(-1) !== phase) this.phases.push(phase);
		this.options.changed();
		// Even a bot that waits to be told names itself, as every phone in a room has a name.
		if (!this.auto && !message.me.name) {
			this.#socket.send({ type: 'request', name: this.name });
			return;
		}
		if (!this.auto) return;
		// One answer to the latest view, after a pause; a newer view replaces the plan.
		clearTimeout(this.#thinking);
		this.#thinking = setTimeout(() => this.#answer(), Math.random() * this.options.thinkMs);
	}

	#answer(): void {
		if (!this.view || this.#stopped || !this.auto) return;
		const { send, memory } = replies(this.view, this.#memory, this.self);
		for (const message of send) {
			if (this.#socket.send(message)) this.sent++;
		}
		// Kept only when sent, so a phone that was offline tries again on its next view.
		if (this.#socket.open) this.#memory = memory;
	}

	#closed(code: number, reason: string): void {
		this.options.changed();
		if (this.#stopped || this.refused || this.#locked) return;
		if (code === 1000 && reason === 'Room closed') {
			this.options.log(`${this.name}: the room was closed`);
			this.#stopped = true;
			return;
		}
		this.options.log(`${this.name}: disconnected (${code} ${reason}), reconnecting`);
		setTimeout(() => void this.start().catch(() => this.#closed(0, 'no connection')), 2000);
	}

	/** Now and then, a locked screen for a few seconds. */
	#flake(): void {
		clearTimeout(this.#flaking);
		const later = 60_000 + Math.random() * 120_000;
		this.#flaking = setTimeout(() => {
			if (this.#stopped || !this.#socket.open) return;
			this.lock();
			setTimeout(() => this.unlock(), 3000 + Math.random() * 10_000);
		}, later);
	}
}

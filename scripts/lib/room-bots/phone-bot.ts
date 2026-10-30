/**
 * A fake player's phone (room-bots.ts): joins the room, keeps its latest view, and answers it
 * as brain.ts decides, after a pause like a person's. With `flaky` it drops now and then and
 * comes back with the same key, as a phone does when its screen locks.
 */
import type { PlayerView, ServerMessage } from '#lib/core/sync/room-protocol.ts';
import { replies, type BotMemory, type BotSelf } from './brain.ts';
import { JoinQueue, newKey, RoomSocket } from './socket.ts';

export interface PhoneBotOptions {
	site: string;
	code: string;
	queue: JoinQueue;
	/** The longest pause before answering, in ms; each answer waits a random part of it. */
	thinkMs: number;
	flaky: boolean;
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
	readonly #socket: RoomSocket;
	#memory: BotMemory = {};
	#thinking: ReturnType<typeof setTimeout> | undefined;
	#stopped = false;
	#flaking: ReturnType<typeof setTimeout> | undefined;

	readonly self: BotSelf;
	private readonly options: PhoneBotOptions;

	constructor(self: BotSelf, options: PhoneBotOptions) {
		this.self = self;
		this.options = options;
		this.#socket = new RoomSocket(
			options.site,
			options.code,
			'player',
			newKey(),
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
		// One answer to the latest view, after a pause; a newer view replaces the plan.
		clearTimeout(this.#thinking);
		this.#thinking = setTimeout(() => this.#answer(), Math.random() * this.options.thinkMs);
	}

	#answer(): void {
		if (!this.view || this.#stopped) return;
		const { send, memory } = replies(this.view, this.#memory, this.self);
		for (const message of send) {
			if (this.#socket.send(message)) this.sent++;
		}
		// Kept only when sent, so a phone that was offline tries again on its next view.
		if (this.#socket.open) this.#memory = memory;
	}

	#closed(code: number, reason: string): void {
		this.options.changed();
		if (this.#stopped || this.refused) return;
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
			this.options.log(`${this.name}: screen locked`);
			this.#socket.drop();
			this.options.changed();
			setTimeout(
				() => {
					if (this.#stopped) return;
					this.options.log(`${this.name}: back`);
					void this.start();
				},
				3000 + Math.random() * 10_000
			);
		}, later);
	}
}

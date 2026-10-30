/**
 * The Test room (Trevor, 2026-10-30): real phone frames beside bots in one live room. The bots
 * and the fake Storyteller are the same ones scripts/room-bots.ts runs, here in the page.
 */
import { MAX_MEMBERS } from '#lib/core/sync/room-presence.ts';
import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { DEFAULT_FRAMES, deviceById } from './devices.ts';
import { botProblems, playGame } from './game.ts';
import { PhoneBot } from './phone-bot.ts';
import { FakeStoryteller } from './storyteller.ts';
import { JoinQueue } from './socket.ts';

const STORAGE_KEY = 'grim-games:test-room:v1';
/** The longest pause before a bot answers, as a person reading their phone. */
const THINK_MS = 1500;
const STEP_TIMEOUT_MS = 60_000;
/** Each step of a game stays this long, so the frames can be watched. */
const STEP_PAUSE_MS = 3000;
const MAX_LOG = 500;
const TIME = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium', hour12: false });

export const ZOOMS = ['0.5', '0.75', '1'] as const;
export type Zoom = (typeof ZOOMS)[number];

/** A phone frame: which device it is, and its own number, which keeps its data apart. */
export interface Frame {
	n: number;
	device: string;
}

interface Saved {
	frames: Frame[];
	zoom: Zoom;
	bots: number;
}

function load(): Saved {
	const raw = readStored<Partial<Saved>>(STORAGE_KEY);
	const frames = Array.isArray(raw?.frames)
		? raw.frames.filter((f) => Number.isInteger(f?.n) && deviceById(f?.device))
		: DEFAULT_FRAMES.map((device, n) => ({ n, device }));
	const zoom = ZOOMS.includes(raw?.zoom as Zoom) ? (raw!.zoom as Zoom) : '0.75';
	const bots = Number.isInteger(raw?.bots) ? Math.max(0, Math.min(MAX_MEMBERS, raw!.bots!)) : 8;
	return { frames, zoom, bots };
}

export class TestRoom {
	frames = $state<Frame[]>([]);
	zoom = $state<Zoom>('0.75');
	/** How many bots to have in the room. */
	botCount = $state(8);
	/** The room the frames and bots are in. */
	code = $state<string>();
	/** This page opened the room and plays its Storyteller. */
	storytelling = $state(false);
	playing = $state(false);
	log = $state<string[]>([]);
	/** Bumped when any bot's view or connection changes, so counts redraw. */
	#tick = $state(0);
	#bots: PhoneBot[] = [];
	#st: FakeStoryteller | undefined;
	readonly #queue = new JoinQueue();
	#checkSoon: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		const saved = load();
		this.frames = saved.frames;
		this.zoom = saved.zoom;
		this.botCount = saved.bots;
	}

	/** Bots connected now, of those asked for. */
	get connected(): number {
		void this.#tick;
		return this.#bots.filter((b) => b.connected).length;
	}

	/** The most bots there can be beside the frames, since a room holds MAX_MEMBERS phones. */
	get maxBots(): number {
		return MAX_MEMBERS - this.frames.length;
	}

	#save(): void {
		writeStored(STORAGE_KEY, { frames: this.frames, zoom: this.zoom, bots: this.botCount });
	}

	#say = (line: string): void => {
		const time = TIME.format(Date.now());
		this.log = [...this.log.slice(-(MAX_LOG - 1)), `${time} ${line}`];
	};

	addFrame(device: string): void {
		if (!deviceById(device) || this.frames.length >= MAX_MEMBERS) return;
		const n = Math.max(-1, ...this.frames.map((f) => f.n)) + 1;
		this.frames = [...this.frames, { n, device }];
		this.botCount = Math.min(this.botCount, this.maxBots);
		this.#save();
		void this.#fitBots();
	}

	removeFrame(n: number): void {
		this.frames = this.frames.filter((f) => f.n !== n);
		this.#save();
	}

	setZoom(zoom: Zoom): void {
		this.zoom = zoom;
		this.#save();
	}

	setBots(count: number): void {
		this.botCount = Math.max(0, Math.min(this.maxBots, count));
		this.#save();
		void this.#fitBots();
	}

	/** Joins a room someone else is storytelling, from its code. */
	async join(raw: string): Promise<boolean> {
		const code = normaliseRoomCode(raw);
		if (!code) return false;
		this.leave();
		this.code = code;
		this.#say(`Joining room ${code}`);
		await this.#fitBots();
		return true;
	}

	/** Opens a new room, with this page as its Storyteller. */
	async open(): Promise<void> {
		this.leave();
		const st = new FakeStoryteller(location.origin, this.#queue, this.#say, STEP_TIMEOUT_MS);
		try {
			this.code = await st.open();
		} catch (e) {
			this.#say(`Could not open a room: ${(e as Error).message}`);
			return;
		}
		this.#st = st;
		this.storytelling = true;
		this.#say(`Opened room ${this.code}`);
		await this.#fitBots();
	}

	/**
	 * The fake Storyteller plays a whole game, with every phone in the room: the frames' players
	 * as well as the bots, so a frame left alone holds a step up until it times out.
	 */
	async play(): Promise<void> {
		const st = this.#st;
		if (!st || this.playing) return;
		this.playing = true;
		const seats = Math.max(1, this.#bots.length + this.frames.length);
		const passed = await playGame(st, this.#bots, seats, this.#say, STEP_PAUSE_MS);
		this.#say(passed ? 'Every step passed.' : 'A step failed.');
		this.playing = false;
	}

	/** Every bot leaves, and the room this page opened closes. */
	leave(): void {
		for (const bot of this.#bots) bot.stop();
		this.#bots = [];
		this.#st?.close();
		this.#st = undefined;
		this.storytelling = false;
		this.playing = false;
		this.code = undefined;
		this.#tick++;
	}

	/** Starts or stops bots until the room has as many as asked for. */
	async #fitBots(): Promise<void> {
		const code = this.code;
		if (!code) return;
		while (this.#bots.length > this.botCount) this.#bots.pop()?.stop();
		const added: PhoneBot[] = [];
		for (let i = this.#bots.length; i < this.botCount; i++) {
			const bot = new PhoneBot(
				{ index: i, name: `Bot ${i + 1}`, random: Math.random },
				{
					site: location.origin,
					code,
					queue: this.#queue,
					thinkMs: THINK_MS,
					flaky: false,
					log: this.#say,
					changed: this.#changed
				}
			);
			this.#bots.push(bot);
			added.push(bot);
		}
		this.#tick++;
		await Promise.all(added.map((b) => b.start().catch((e: Error) => this.#say(e.message))));
	}

	#changed = (): void => {
		this.#tick++;
		// Views arrive one phone at a time, so checks wait for the room to go quiet.
		clearTimeout(this.#checkSoon);
		this.#checkSoon = setTimeout(() => {
			for (const problem of botProblems(this.#bots)) this.#say(`! ${problem}`);
		}, 3000);
	};
}

/**
 * The Test room (Trevor, 2026-10-30: "a place where i fully control the fake game, and have
 * access to a certain number of fake players, along with perhaps some fast tools"). The
 * Storyteller is the real app in a frame; the players are bots (phone-bot.ts) that follow its
 * room, each on a device of its own, and any of them can be shown as that device's real screen.
 */
import { MAX_MEMBERS } from '#lib/core/sync/room-presence.ts';
import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
import type { BotAction } from '#lib/core/sync/room-bots/brain.ts';
import { STORAGE_KEY as HOST_KEY, type StoredRoom } from '#lib/features/room/host-storage.ts';
import { PHONE_FRAME_PREFIX, readStored, writeStored } from '#lib/ui/stored.ts';
import { deviceById, mixedDevices, STORYTELLER_SCREENS } from './devices.ts';
import { botProblems } from './game.ts';
import { PhoneBot } from './phone-bot.ts';
import { closeRoom, JoinQueue } from './socket.ts';

const STORAGE_KEY = 'grim-games:test-room:v2';
/** Where the player app keeps a phone's key and name (features/room/player.svelte.ts). */
const PLAYER_KEY = 'grim-games-room-player';
const NAME_KEY = 'grim-games-room-name';
/** The longest pause before a bot answers by itself, as a person reading their phone. */
const THINK_MS = 1500;
const MAX_LOG = 500;
/**
 * At most this often the players' rows redraw for news from the room. With 20 players every
 * change in the room is 20 messages here, all on the Storyteller screen's thread, so a redraw
 * for each made its taps lag on Trevor's Pixel (2026-10-31).
 */
const REDRAW_MS = 250;
const TIME = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium', hour12: false });

export const ZOOMS = ['0.5', '0.75', '1'] as const;
export type Zoom = (typeof ZOOMS)[number];

/** One fake player: its key (so it is the same player after a reload) and its device. */
export interface Player {
	key: string;
	device: string;
	/** Its phone's real screen is shown. */
	shown: boolean;
}

interface Saved {
	players: Player[];
	auto: boolean;
	zoom: Zoom;
	screen: string;
}

const isPlayer = (p: Partial<Player> | undefined): p is Player =>
	typeof p?.key === 'string' && /^[0-9a-f]{64}$/.test(p.key) && !!deviceById(p.device ?? '');

function load(): Saved {
	const raw = readStored<Partial<Saved>>(STORAGE_KEY);
	return {
		players: Array.isArray(raw?.players) ? raw.players.filter(isPlayer).slice(0, MAX_MEMBERS) : [],
		auto: raw?.auto !== false,
		zoom: ZOOMS.includes(raw?.zoom as Zoom) ? (raw!.zoom as Zoom) : '0.5',
		screen: STORYTELLER_SCREENS.some((s) => s.id === raw?.screen) ? raw!.screen! : 'ipad-landscape'
	};
}

/** The frame name that keeps phone `i`'s data apart (ui/stored.ts). */
export const frameName = (i: number) => `${PHONE_FRAME_PREFIX}${i}`;
export const botName = (i: number) => `Bot ${i + 1}`;

export class TestRoom {
	players = $state<Player[]>([]);
	auto = $state(true);
	zoom = $state<Zoom>('0.5');
	/** The Storyteller frame's screen (STORYTELLER_SCREENS). */
	screen = $state('ipad-landscape');
	/** The room the players are in: the Storyteller frame's, unless a code was typed. */
	code = $state<string>();
	/** A code typed in, for a room storytold on another device. */
	typedCode = $state<string>();
	log = $state<string[]>([]);
	/** Bumped when any bot's view or connection changes, so the rows redraw. */
	#tick = $state(0);
	#bots: PhoneBot[] = [];
	readonly #queue = new JoinQueue();
	#checkSoon: ReturnType<typeof setTimeout> | undefined;
	/** A redraw is due: every bot hears every change in the room, so redraws wait for a few. */
	#redraw: ReturnType<typeof setTimeout> | undefined;
	#follow: ReturnType<typeof setInterval> | undefined;

	constructor() {
		const saved = load();
		this.players = saved.players;
		this.auto = saved.auto;
		this.zoom = saved.zoom;
		this.screen = saved.screen;
	}

	/** Follows the Storyteller frame's room (host-storage.ts) and starts the players in it. */
	start(): void {
		const follow = () => this.#useRoom(this.typedCode ?? this.#storytellerRoom());
		follow();
		this.#follow = setInterval(follow, 1000);
	}

	stop(): void {
		clearInterval(this.#follow);
		clearTimeout(this.#checkSoon);
		clearTimeout(this.#redraw);
		this.#redraw = undefined;
		for (const bot of this.#bots) bot.stop();
		this.#bots = [];
	}

	/** The Storyteller screen's own room, which Close room can delete. */
	get ownRoom(): boolean {
		return !!this.code && !this.typedCode;
	}

	/**
	 * Ends the test (Trevor, 2026-10-31: "need a way to close a test room"): the Storyteller
	 * screen's room is deleted for everyone in it, as its own Close does, and the players leave.
	 * A room storytold on another device is only left, as only its Storyteller can delete it.
	 */
	async close(): Promise<void> {
		const stored = this.ownRoom ? readStored<StoredRoom>(HOST_KEY) : undefined;
		const code = this.code;
		this.typedCode = undefined;
		for (const bot of this.#bots) bot.stop();
		this.#bots = [];
		this.code = undefined;
		this.#tick++;
		if (stored && stored.code === code) {
			// Forgotten first, so following the screen's room doesn't bring the players back;
			// the screen's app forgets it too once the room tells it it's closed.
			writeStored(HOST_KEY, undefined);
			await closeRoom(location.origin, stored.code, stored.key, this.#queue).catch((e: Error) =>
				this.#say(e.message)
			);
		}
		if (code) this.#say(`Room ${code} closed`);
	}

	#storytellerRoom(): string | undefined {
		return readStored<StoredRoom>(HOST_KEY)?.code;
	}

	/** Player `i` answers by itself only while its phone is hidden: a shown phone is yours. */
	#autoFor(i: number): boolean {
		return this.auto && !this.players[i]?.shown;
	}

	/** The bot playing player `i`, while there is a room. */
	bot(i: number): PhoneBot | undefined {
		void this.#tick;
		return this.#bots[i];
	}

	get connected(): number {
		void this.#tick;
		return this.#bots.filter((b) => b.connected).length;
	}

	#save(): void {
		writeStored(STORAGE_KEY, {
			players: this.players,
			auto: this.auto,
			zoom: this.zoom,
			screen: this.screen
		} satisfies Saved);
	}

	#say = (line: string): void => {
		this.log = [...this.log.slice(-(MAX_LOG - 1)), `${TIME.format(Date.now())} ${line}`];
	};

	/** How many fake players there are: new ones take the next devices in turn. */
	setCount(count: number): void {
		const n = Math.max(0, Math.min(MAX_MEMBERS, count));
		const devices = mixedDevices(Math.max(0, n - this.players.length), this.players.length);
		this.players = [
			...this.players.slice(0, n),
			...devices.map((device) => ({ key: newPlayerKey(), device, shown: false }))
		];
		this.#save();
		this.#fitBots();
	}

	setDevice(i: number, device: string): void {
		if (!deviceById(device)) return;
		this.players = this.players.map((p, j) => (j === i ? { ...p, device } : p));
		this.#save();
	}

	/** Every player on a different kind of device, in turn. */
	mixDevices(): void {
		const devices = mixedDevices(this.players.length);
		this.players = this.players.map((p, i) => ({ ...p, device: devices[i] }));
		this.#save();
	}

	/** Every player on the same device. */
	allOn(device: string): void {
		if (!deviceById(device)) return;
		this.players = this.players.map((p) => ({ ...p, device }));
		this.#save();
	}

	/** Shows or hides player `i`'s phone: the real app, as that same player. */
	showPhone(i: number, shown: boolean): void {
		const player = this.players[i];
		if (!player) return;
		if (shown) {
			// The frame reads these under its own name (stored.ts), so it is this bot's phone.
			writeStored(`${frameName(i)}:${PLAYER_KEY}`, { key: player.key });
			writeStored(`${frameName(i)}:${NAME_KEY}`, botName(i));
		}
		this.players = this.players.map((p, j) => (j === i ? { ...p, shown } : p));
		const bot = this.#bots[i];
		if (bot) bot.auto = this.#autoFor(i);
		this.#save();
	}

	showAll(shown: boolean): void {
		this.players.forEach((_, i) => this.showPhone(i, shown));
	}

	setAuto(auto: boolean): void {
		this.auto = auto;
		this.#bots.forEach((bot, i) => (bot.auto = this.#autoFor(i)));
		this.#save();
	}

	setZoom(zoom: Zoom): void {
		this.zoom = zoom;
		this.#save();
	}

	setScreen(screen: string): void {
		if (!STORYTELLER_SCREENS.some((s) => s.id === screen)) return;
		this.screen = screen;
		this.#save();
	}

	/** Players join a room storytold elsewhere; an empty code follows the frame's room again. */
	joinCode(raw: string | undefined): boolean {
		const code = raw ? normaliseRoomCode(raw) : undefined;
		if (raw && !code) return false;
		this.typedCode = code ?? undefined;
		this.#useRoom(this.typedCode ?? this.#storytellerRoom());
		return true;
	}

	/** A fast tool: every player makes this tap now. Says how many could. */
	everyone(kind: BotAction): number {
		const done = this.#bots.filter((b) => b.act(kind)).length;
		this.#say(`${kind}: ${done} of ${this.#bots.length} players`);
		return done;
	}

	lock(i: number, locked: boolean): void {
		const bot = this.#bots[i];
		if (locked) bot?.lock();
		else bot?.unlock();
		this.#tick++;
	}

	lockAll(locked: boolean): void {
		this.#bots.forEach((_, i) => this.lock(i, locked));
	}

	/** Moves every player to `code`, keeping their keys, so they are the same players there. */
	#useRoom(code: string | undefined): void {
		if (code === this.code) return;
		for (const bot of this.#bots) bot.stop();
		this.#bots = [];
		this.code = code;
		if (code) this.#say(`Players join room ${code}`);
		this.#fitBots();
	}

	/** Starts or stops bots until every player has one in the room. */
	#fitBots(): void {
		const code = this.code;
		if (!code) return;
		while (this.#bots.length > this.players.length) this.#bots.pop()?.stop();
		for (let i = this.#bots.length; i < this.players.length; i++) {
			const bot = new PhoneBot(
				{ index: i, name: botName(i), random: Math.random },
				{
					site: location.origin,
					code,
					queue: this.#queue,
					thinkMs: THINK_MS,
					flaky: false,
					key: this.players[i].key,
					auto: this.#autoFor(i),
					log: this.#say,
					changed: this.#changed
				}
			);
			this.#bots.push(bot);
			void bot.start().catch((e: Error) => this.#say(`${bot.name}: ${e.message}`));
		}
		this.#tick++;
	}

	#changed = (): void => {
		this.#redraw ??= setTimeout(() => {
			this.#redraw = undefined;
			this.#tick++;
		}, REDRAW_MS);
		// Views arrive one phone at a time, so checks wait for the room to go quiet.
		clearTimeout(this.#checkSoon);
		this.#checkSoon = setTimeout(() => {
			for (const problem of botProblems(this.#bots)) this.#say(`! ${problem}`);
		}, 3000);
	};
}

function newPlayerKey(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
		b.toString(16).padStart(2, '0')
	).join('');
}

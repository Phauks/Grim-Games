/**
 * Small things the grimoire keeps on this device, outside the game's event log:
 * - player names used before, offered as suggestions when naming a seat;
 * - where seats are drawn on this screen (oval or circle, gaps, seats placed by hand). The
 *   seating order is game state; how it is laid out on one device is not.
 *
 * All live in localStorage with a version in the key, and anything unreadable is ignored.
 */
import type { GameId } from '#lib/core/model/index.ts';
import {
	DEFAULT_SEAT_LAYOUT,
	isDefaultLayout,
	parseSeatLayout,
	type SeatLayout,
	type SeatPoint
} from '#lib/ui/seating/seat-layout.ts';

const NAMES_KEY = 'grim-games:player-names:v1';
const FLIPPED_PREFIX = 'grim-games:upside-down:v1:';
const LAYOUT_KEY = (gameId: GameId) => `grim-games:seat-layout:v1:${gameId}`;
/** How many past names are remembered. */
export const MAX_NAMES = 60;

function readList(key: string): string[] {
	try {
		const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]');
		return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

function writeList(key: string, list: readonly string[]): void {
	try {
		if (list.length === 0) globalThis.localStorage?.removeItem(key);
		else globalThis.localStorage?.setItem(key, JSON.stringify(list));
	} catch {
		// Storage full or blocked: suggestions are a convenience.
	}
}

/** Adds a name to the front of a recent-names list (case-insensitive, no duplicates). */
export function rememberName(list: readonly string[], name: string): string[] {
	const trimmed = name.trim();
	if (!trimmed) return [...list];
	const key = trimmed.toLocaleLowerCase();
	return [trimmed, ...list.filter((n) => n.toLocaleLowerCase() !== key)].slice(0, MAX_NAMES);
}

/**
 * Names to suggest while typing: past names starting with what is typed (then containing
 * it), leaving out names already on another seat.
 */
export function suggestNames(
	list: readonly string[],
	typed: string,
	taken: readonly string[],
	limit = 6
): string[] {
	const query = typed.trim().toLocaleLowerCase();
	const used = new Set(taken.map((n) => n.toLocaleLowerCase()));
	const open = list.filter(
		(n) => !used.has(n.toLocaleLowerCase()) && n.toLocaleLowerCase() !== query
	);
	const starts = open.filter((n) => n.toLocaleLowerCase().startsWith(query));
	const contains = query
		? open.filter((n) => !starts.includes(n) && n.toLocaleLowerCase().includes(query))
		: [];
	return [...starts, ...contains].slice(0, limit);
}

export const pastNames = {
	read: (): string[] => readList(NAMES_KEY),
	remember(name: string): void {
		writeList(NAMES_KEY, rememberName(readList(NAMES_KEY), name));
	}
};

/**
 * Earlier builds kept a device-only "upside down" mark per seat. An upside-down token means
 * the player's alignment changed, which the seat's alignment now shows, so the old marks are
 * removed without touching any alignment.
 */
export function forgetUpsideDownMarks(): void {
	try {
		const storage = globalThis.localStorage;
		if (!storage) return;
		const old = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
			(key): key is string => key?.startsWith(FLIPPED_PREFIX) ?? false
		);
		for (const key of old) storage.removeItem(key);
	} catch {
		// Storage blocked: the old marks are unused anyway.
	}
}

const RECENT_REMINDERS_KEY = 'grim-games:recent-reminders:v1';
/** How many recently placed reminders are offered first. */
export const MAX_RECENT_REMINDERS = 8;

/** Reminders placed recently on this device (as `reminderKey`s), newest first. */
export const recentReminders = {
	read: (): string[] => readList(RECENT_REMINDERS_KEY),
	remember(key: string): void {
		const list = readList(RECENT_REMINDERS_KEY).filter((k) => k !== key);
		writeList(RECENT_REMINDERS_KEY, [key, ...list].slice(0, MAX_RECENT_REMINDERS));
	}
};

/** Where this device draws each game's seats. */
export const seatLayouts = {
	read(gameId: GameId): SeatLayout {
		try {
			const raw = globalThis.localStorage?.getItem(LAYOUT_KEY(gameId));
			return raw ? parseSeatLayout(JSON.parse(raw)) : DEFAULT_SEAT_LAYOUT;
		} catch {
			return DEFAULT_SEAT_LAYOUT;
		}
	},
	write(gameId: GameId, layout: SeatLayout): void {
		try {
			if (isDefaultLayout(layout)) globalThis.localStorage?.removeItem(LAYOUT_KEY(gameId));
			else globalThis.localStorage?.setItem(LAYOUT_KEY(gameId), JSON.stringify(layout));
		} catch {
			// Storage full or blocked: the layout lasts until the page is closed.
		}
	},
	forget(gameId: GameId): void {
		this.write(gameId, DEFAULT_SEAT_LAYOUT);
	}
};

const SPOTS_KEY = (gameId: GameId) => `grim-games:reminder-spots:v1:${gameId}`;

/**
 * Where reminders were dropped on this device, by reminder id, in % of the board, for
 * reminders that stay where they are dropped (board looks, Trevor 2026-10-17).
 */
export const reminderSpots = {
	read(gameId: GameId): Record<string, SeatPoint> {
		try {
			const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(SPOTS_KEY(gameId)) ?? '{}');
			if (!raw || typeof raw !== 'object') return {};
			const out: Record<string, SeatPoint> = {};
			for (const [id, p] of Object.entries(raw as Record<string, unknown>)) {
				const { x, y } = (p ?? {}) as Record<string, unknown>;
				if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y))
					out[id] = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
			}
			return out;
		} catch {
			return {};
		}
	},
	write(gameId: GameId, spots: Readonly<Record<string, SeatPoint>>): void {
		try {
			if (Object.keys(spots).length === 0) globalThis.localStorage?.removeItem(SPOTS_KEY(gameId));
			else globalThis.localStorage?.setItem(SPOTS_KEY(gameId), JSON.stringify(spots));
		} catch {
			// Storage full or blocked: the spots last until the page is closed.
		}
	}
};

const NIGHT_KEY = (gameId: GameId) => `grim-games:night:v1:${gameId}`;

/**
 * Where the Storyteller is in the night on this device, so a reload or an app update opens
 * it again (Trevor, 2026-10-16): the steps ticked off, and which night order view was open.
 */
export interface NightView {
	/** Ticked steps (`<day>:<night>:<step id>`). */
	done: string[];
	/** The night being run, by the number of days before it (it ends when Dawn is ticked). */
	day?: number;
	/** The night order sheet was open. */
	sheet?: boolean;
	/** The walk-through under the board: which night and which step. */
	walk?: { night: 'first' | 'other'; index: number };
	/** The step dialog: which night and which step. */
	guided?: { night: 'first' | 'other'; stepId: string };
}

const isNight = (v: unknown): v is 'first' | 'other' => v === 'first' || v === 'other';

export function parseNightView(raw: unknown): NightView {
	const view: NightView = { done: [] };
	if (typeof raw !== 'object' || raw === null) return view;
	const r = raw as Record<string, unknown>;
	if (Array.isArray(r.done)) view.done = r.done.filter((v): v is string => typeof v === 'string');
	if (r.sheet === true) view.sheet = true;
	if (Number.isInteger(r.day) && (r.day as number) >= 0) view.day = r.day as number;
	const walk = r.walk as Record<string, unknown> | undefined;
	if (walk && isNight(walk.night) && Number.isInteger(walk.index) && (walk.index as number) >= 0)
		view.walk = { night: walk.night, index: walk.index as number };
	const guided = r.guided as Record<string, unknown> | undefined;
	if (guided && isNight(guided.night) && typeof guided.stepId === 'string')
		view.guided = { night: guided.night, stepId: guided.stepId };
	return view;
}

export const nightViews = {
	read(gameId: GameId): NightView {
		try {
			return parseNightView(
				JSON.parse(globalThis.localStorage?.getItem(NIGHT_KEY(gameId)) ?? '{}')
			);
		} catch {
			return { done: [] };
		}
	},
	write(gameId: GameId, view: NightView): void {
		try {
			const empty = view.done.length === 0 && !view.sheet && !view.walk && !view.guided;
			if (empty) globalThis.localStorage?.removeItem(NIGHT_KEY(gameId));
			else globalThis.localStorage?.setItem(NIGHT_KEY(gameId), JSON.stringify(view));
		} catch {
			// Storage full or blocked: the night lasts until the page is closed.
		}
	}
};

const ENDED_KEY = 'grim-games:ended-games:v1';

/** A game the Storyteller ended (Trevor, 2026-10-16), and which team won if recorded. */
export interface EndedGame {
	endedAt: number;
	winner?: 'good' | 'evil';
}

function readEnded(): Record<string, EndedGame> {
	try {
		const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(ENDED_KEY) ?? '{}');
		if (typeof raw !== 'object' || raw === null) return {};
		const out: Record<string, EndedGame> = {};
		for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
			const e = v as Record<string, unknown> | null;
			if (!e || typeof e.endedAt !== 'number') continue;
			out[id] = { endedAt: e.endedAt };
			if (e.winner === 'good' || e.winner === 'evil') out[id].winner = e.winner;
		}
		return out;
	} catch {
		return {};
	}
}

function writeEnded(all: Record<string, EndedGame>): void {
	try {
		globalThis.localStorage?.setItem(ENDED_KEY, JSON.stringify(all));
	} catch {
		// Storage blocked: the game stays in the active list.
	}
}

/**
 * Ended games: moved out of Continue and Resume into History on this device. The game
 * itself stays saved, so reopening it puts it back.
 */
export const endedGames = {
	read: readEnded,
	end(gameId: GameId, winner?: 'good' | 'evil'): void {
		writeEnded({
			...readEnded(),
			[gameId]: { endedAt: Date.now(), ...(winner ? { winner } : {}) }
		});
	},
	reopen(gameId: GameId): void {
		const all = readEnded();
		delete all[gameId];
		writeEnded(all);
	}
};

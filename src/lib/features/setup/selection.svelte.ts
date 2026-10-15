/**
 * The character selection being prepared for the bag: player count, copies of each
 * character, the Storyteller's stand-in choices and the two view switches. Kept on this
 * device (localStorage) so leaving the page or reloading never loses it; another game
 * starts a fresh selection.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { MAX_SEATS } from '#lib/core/engine/index.ts';

export const MIN_SELECT_PLAYERS = 5;
/** Fifteen dealt players plus up to five Travellers, as on the setup sheet. */
export const MAX_SELECT_PLAYERS = Math.min(20, MAX_SEATS);
const DEFAULT_PLAYERS = 8;
const KEY = 'grim-games:setup-selection';

export interface SelectionState {
	/** The game this selection is for. */
	gameId: string;
	players: number;
	selection: Record<CharacterId, number>;
	standIns: Record<CharacterId, CharacterId>;
	showAbilities: boolean;
	allowDuplicates: boolean;
}

function fresh(gameId: string, players = DEFAULT_PLAYERS): SelectionState {
	return {
		gameId,
		players,
		selection: {},
		standIns: {},
		showAbilities: false,
		allowDuplicates: false
	};
}

function read(): SelectionState | undefined {
	try {
		const raw = localStorage.getItem(KEY);
		const value: unknown = raw ? JSON.parse(raw) : undefined;
		if (!value || typeof value !== 'object') return undefined;
		const v = value as Partial<SelectionState>;
		if (typeof v.gameId !== 'string' || typeof v.players !== 'number') return undefined;
		return {
			...fresh(v.gameId, v.players),
			selection: { ...v.selection },
			standIns: { ...v.standIns },
			showAbilities: v.showAbilities === true,
			allowDuplicates: v.allowDuplicates === true
		};
	} catch {
		return undefined;
	}
}

let state = $state<SelectionState>(fresh(''));
let loaded = false;

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// Storage blocked or full: the selection still works for this visit.
	}
}

function clampPlayers(n: number): number {
	return Math.min(MAX_SELECT_PLAYERS, Math.max(MIN_SELECT_PLAYERS, Math.round(n)));
}

export const setupSelection = {
	get state(): SelectionState {
		return state;
	},
	/** Loads the saved selection for the game, or starts a fresh one for `players`. */
	open(gameId: string, players: number) {
		if (!loaded) {
			loaded = true;
			const saved = typeof localStorage === 'undefined' ? undefined : read();
			if (saved) state = saved;
		}
		if (state.gameId !== gameId) {
			state = fresh(gameId, clampPlayers(players));
			save();
		}
	},
	setPlayers(n: number) {
		state.players = clampPlayers(n);
		save();
	},
	copies(id: CharacterId): number {
		return state.selection[id] ?? 0;
	},
	setCopies(id: CharacterId, n: number) {
		if (n <= 0) {
			delete state.selection[id];
			delete state.standIns[id];
		} else state.selection[id] = n;
		save();
	},
	replace(selection: Record<CharacterId, number>) {
		state.selection = { ...selection };
		for (const id of Object.keys(state.standIns)) {
			if (!state.selection[id]) delete state.standIns[id];
		}
		save();
	},
	setStandIn(id: CharacterId, shows: CharacterId) {
		state.standIns[id] = shows;
		save();
	},
	clear() {
		state.selection = {};
		state.standIns = {};
		save();
	},
	setShowAbilities(on: boolean) {
		state.showAbilities = on;
		save();
	},
	setAllowDuplicates(on: boolean) {
		state.allowDuplicates = on;
		save();
	}
};

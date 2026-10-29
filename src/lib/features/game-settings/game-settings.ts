/**
 * Settings for one game (Trevor, 2026-10-28: "pre-game settings ... like if they want
 * nomination tracking on or off for a game"): the few settings that change what the table
 * sees, or what the game records, so two games on one device may want them different. Each
 * one's value in Settings is the default a new game starts with.
 *
 * Kept on this device beside the game (like its game mode, game-mode-store.ts), so the game's
 * event log and saved format don't change. A game keeps every value, not only the changed
 * ones, so a later change in Settings never alters it. A value missing or unreadable (a game
 * from before a setting was added, or from before this record existed) is read from Settings,
 * which is how such a game always played.
 */
import { SETUP_LOOKS, type SetupLook } from '#lib/core/rules/game-phase.ts';
import { DAY_SECONDS_PER_ALIVE_MAX, DAY_SECONDS_PER_ALIVE_MIN } from '#lib/core/rules/day-timer.ts';
import { TIMER_FOR_PLAYERS, type Preferences, type TimerForPlayers } from '#lib/ui/preferences.ts';

export interface GameSettings {
	/** Who each player nominated today, and who nominated them. */
	trackNominations: boolean;
	/** How players' phones show the day timer. */
	timerForPlayers: TimerForPlayers;
	/** What players' phones show beside Setup, before the first night. */
	setupForPlayers: SetupLook;
	/** The day timer's starting seconds per living player. */
	timerPerPlayer: number;
	/** The bag draw's choices. */
	requireName: boolean;
	holdToReveal: boolean;
	tileOrderRandom: boolean;
	slotMachine: boolean;
}

export type GameSettingKey = keyof GameSettings;

/** The key a game's settings are stored under; the version goes up when a value's meaning changes. */
export const gameSettingsKey = (gameId: string) => `grim-games:game-settings:v1:${gameId}`;

/** The values a new game starts with: Settings' (or a profile's). */
export function settingsFrom(prefs: Preferences): GameSettings {
	return {
		trackNominations: prefs.assistance.trackNominations,
		timerForPlayers: prefs.timerForPlayers,
		setupForPlayers: prefs.setupForPlayers,
		timerPerPlayer: prefs.timerPerPlayer,
		requireName: prefs.requireName,
		holdToReveal: prefs.holdToReveal,
		tileOrderRandom: prefs.tileOrderRandom,
		slotMachine: prefs.slotMachine
	};
}

/** The same change as Settings stores it. */
export function asPreferences(
	change: Partial<GameSettings>,
	prefs: Preferences
): Partial<Preferences> {
	const { trackNominations, ...rest } = change;
	return {
		...rest,
		...(trackNominations === undefined
			? {}
			: { assistance: { ...prefs.assistance, trackNominations } })
	};
}

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** A stored record read leniently: each value checked on its own, `fallback`'s where it fails. */
export function parseGameSettings(raw: unknown, fallback: GameSettings): GameSettings {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const seconds = r.timerPerPlayer;
	return {
		trackNominations: bool(r.trackNominations, fallback.trackNominations),
		timerForPlayers: (TIMER_FOR_PLAYERS as readonly unknown[]).includes(r.timerForPlayers)
			? (r.timerForPlayers as TimerForPlayers)
			: fallback.timerForPlayers,
		setupForPlayers: (SETUP_LOOKS as readonly unknown[]).includes(r.setupForPlayers)
			? (r.setupForPlayers as SetupLook)
			: fallback.setupForPlayers,
		timerPerPlayer:
			Number.isInteger(seconds) &&
			(seconds as number) >= DAY_SECONDS_PER_ALIVE_MIN &&
			(seconds as number) <= DAY_SECONDS_PER_ALIVE_MAX
				? (seconds as number)
				: fallback.timerPerPlayer,
		requireName: bool(r.requireName, fallback.requireName),
		holdToReveal: bool(r.holdToReveal, fallback.holdToReveal),
		tileOrderRandom: bool(r.tileOrderRandom, fallback.tileOrderRandom),
		slotMachine: bool(r.slotMachine, fallback.slotMachine)
	};
}

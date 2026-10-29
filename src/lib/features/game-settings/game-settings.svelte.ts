import { page } from '$app/state';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import type { Preferences } from '#lib/ui/preferences.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import {
	asPreferences,
	gameSettingsKey,
	parseGameSettings,
	settingsFrom,
	type GameSettings
} from './game-settings.ts';

/**
 * Each game's own settings (game-settings.ts), read by everything those settings change. The
 * game on screen is the route's; off a game's screens, and for a game with no record, the
 * values are Settings'.
 */
class GameSettingsStore {
	/** What each game has stored, read once; null when it has nothing. Filled while reading,
	 * so a plain map, with `#changes` telling readers when a write lands. */
	#stored = new Map<string, unknown>();
	#changes = $state(0);

	#raw(gameId: string): unknown {
		void this.#changes;
		if (!this.#stored.has(gameId))
			this.#stored.set(gameId, readStored(gameSettingsKey(gameId)) ?? null);
		return this.#stored.get(gameId);
	}

	#write(gameId: string, settings: GameSettings | undefined): void {
		this.#stored.set(gameId, settings ?? null);
		writeStored(gameSettingsKey(gameId), settings);
		this.#changes++;
	}

	/** The game on screen, if any. */
	get gameId(): string | undefined {
		return page.params.gameId;
	}

	/** A game's settings: its own, else Settings'. */
	of(gameId: string | undefined): GameSettings {
		const fallback = settingsFrom(preferences.current);
		return gameId ? parseGameSettings(this.#raw(gameId), fallback) : fallback;
	}

	/** The settings of the game on screen. */
	get current(): GameSettings {
		return this.of(this.gameId);
	}

	/** Whether the game keeps settings of its own. */
	has(gameId: string): boolean {
		return this.#raw(gameId) !== null;
	}

	/** A new game's settings, from `prefs` (the profile it starts with); kept if it has some. */
	seed(gameId: string, prefs: Preferences): void {
		if (!this.has(gameId)) this.#write(gameId, settingsFrom(prefs));
	}

	/** Starts a game's settings over from `prefs` (another profile chosen before it begins). */
	reseed(gameId: string, prefs: Preferences): void {
		this.#write(gameId, settingsFrom(prefs));
	}

	/** Changes one game only: its Game settings and each setting's place of use. */
	set(gameId: string | undefined, change: Partial<GameSettings>): void {
		if (!gameId) {
			this.setDefault(change);
			return;
		}
		this.#write(gameId, { ...this.of(gameId), ...change });
	}

	/** Settings' change: the default for new games, and the game on screen too. */
	setDefault(change: Partial<GameSettings>): void {
		preferences.update(asPreferences(change, preferences.current));
		if (this.gameId) this.#write(this.gameId, { ...this.of(this.gameId), ...change });
	}

	forget(gameId: string): void {
		this.#write(gameId, undefined);
	}
}

export const gameSettings = new GameSettingsStore();

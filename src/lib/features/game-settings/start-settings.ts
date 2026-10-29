import { settingsProfiles } from '#lib/features/settings/profiles/settings-profiles.svelte.ts';
import { gameSettings } from './game-settings.svelte.ts';

/**
 * A game reaching the start flow's character screens (Character selection, a rule's hidden
 * characters, a mode's deal): it starts with the default profile and that profile's game
 * settings, unless it has its own already. Kept as the game is made, so Back and a reload
 * don't start it over.
 */
export function seedStartSettings(gameId: string): void {
	const profile = settingsProfiles.profileOfGame(gameId);
	settingsProfiles.chooseForGame(gameId, profile);
	gameSettings.seed(gameId, settingsProfiles.preferencesOf(profile));
}

/**
 * Another profile for a game that hasn't begun (Trevor, 2026-10-29: chosen in Game settings
 * on Character selection): the game starts with it, and its game settings start over from it.
 */
export function chooseStartProfile(gameId: string, profileId: string): void {
	settingsProfiles.chooseForGame(gameId, profileId);
	gameSettings.reseed(gameId, settingsProfiles.preferencesOf(profileId));
}

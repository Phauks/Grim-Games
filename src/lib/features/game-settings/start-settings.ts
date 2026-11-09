import { preferences } from '#lib/ui/preferences.svelte.ts';
import { gameSettings } from './game-settings.svelte.ts';

/**
 * A game reaching the start flow's character screens (Character selection, a rule's hidden
 * characters, a mode's deal): it starts with the game settings in Settings, unless it has its
 * own already. Kept as the game is made, so Back and a reload don't start it over.
 */
export function seedStartSettings(gameId: string): void {
	gameSettings.seed(gameId, preferences.current);
}

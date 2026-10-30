/**
 * The Storyteller's name (Trevor, 2026-10-19), saved with each game (`Game.storytellerName`)
 * so the places that show a game can name who runs it. It is the Profile's name and is set
 * nowhere else (Trevor, 2026-10-30: "No longer allow setting storyteller name from app. All
 * connected to profile name"): a new game starts with it, and the board keeps its game's name
 * in step with it while the game is in play. Empty means none.
 */
import { savedPlayerName } from '#lib/features/room/player.svelte.ts';

export const storytellerName = {
	get current(): string {
		return savedPlayerName().trim();
	}
};

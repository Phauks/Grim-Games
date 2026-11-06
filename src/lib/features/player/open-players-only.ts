/**
 * Opens a players-only game (plan M55): the script becomes /play's, on its Grim tab where the
 * player's own town is. From New game's Players only switch and from Join game's list.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { LoadedScript } from '#lib/core/data/index.ts';
import { leaveLastRoom } from '#lib/features/room/player.svelte.ts';
import { chooseScript } from '#lib/features/scripts/current-script.svelte.ts';
import type { ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
import { openOnGrim } from './local-town.svelte.ts';

export async function openPlayersOnly(script: LoadedScript, source: ScriptSource): Promise<void> {
	// A room's town would take the Grim tab's place, so the phone stops following it (it
	// stays in Join game's As player).
	leaveLastRoom();
	await chooseScript(script, source);
	openOnGrim.request();
	await goto(resolve('/play'));
}

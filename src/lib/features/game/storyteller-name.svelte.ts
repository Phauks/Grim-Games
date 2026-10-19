/**
 * The Storyteller's name on New game (Trevor, 2026-10-19: "put in the storyteller name"),
 * saved with each game it starts (`Game.storytellerName`) so the places that show a game can
 * name who runs it. It starts as the name typed last on this device, else the signed-in
 * account's username; empty means none.
 */
import { account } from '#lib/features/account/account.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:storyteller-name';
/** The longest name the field takes. */
export const MAX_STORYTELLER_NAME = 40;

let typed = $state<string | undefined>(
	(() => {
		const stored = readStored<unknown>(KEY);
		return typeof stored === 'string' ? stored : undefined;
	})()
);

export const storytellerName = {
	/** The name New game shows: the last one typed, else the account's username. */
	get current(): string {
		return typed ?? account.user?.username ?? '';
	},
	set(name: string) {
		typed = name;
		writeStored(KEY, name);
	}
};

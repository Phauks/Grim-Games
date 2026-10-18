import { account } from '#lib/features/account/account.svelte.ts';
import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
import { forgetScript } from '#lib/features/scripts/current-script.svelte.ts';
import { sameScript } from '#lib/features/scripts/saved-scripts.ts';
import type { ScriptListing } from '#lib/features/scripts/script-providers.ts';

/** Takes a script out of the Library: off this device, and off the signed-in profile. */
export async function removeScript(listing: ScriptListing): Promise<void> {
	const { identity, saved } = listing;
	if (saved) await forgetScript(saved.scriptId);
	if (account.user && identity) {
		for (const entry of profileScripts.list) {
			if (sameScript({ json: entry.script.json }, identity)) await profileScripts.remove(entry);
		}
	}
}

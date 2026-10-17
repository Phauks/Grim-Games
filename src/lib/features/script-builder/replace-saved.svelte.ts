import { account } from '#lib/features/account/account.svelte.ts';
import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
import { libraryKey } from '#lib/features/library/library-labels.ts';
import { libraryLabels } from '#lib/features/library/library-labels.svelte.ts';
import { forgetScript } from '#lib/features/scripts/current-script.svelte.ts';
import { sameScript, type SavedScript } from '#lib/features/scripts/saved-scripts.ts';

/**
 * After saving a new version of a script made in the builder: the old version goes, and its
 * Library folder and tags move to the new one. Labels are keyed by the script's JSON
 * (`libraryKey`), so without the move an edit would leave them behind. The account's copy
 * of the old version goes too, so a signed-in Library doesn't list both.
 */
export async function replaceBuilt(old: SavedScript, saved: SavedScript): Promise<void> {
	const from = libraryKey(old);
	const to = libraryKey(saved);
	if (from !== to) {
		const labels = libraryLabels.for(from);
		const kept = libraryLabels.for(to);
		if (labels.folder && !kept.folder) libraryLabels.setFolder(to, labels.folder);
		for (const tag of labels.tags) if (!kept.tags.includes(tag)) libraryLabels.toggleTag(to, tag);
		libraryLabels.setFolder(from, undefined);
		for (const tag of labels.tags) libraryLabels.toggleTag(from, tag);
	}
	await forgetScript(old.scriptId);
	if (!account.user) return;
	for (const entry of profileScripts.list) {
		if (sameScript({ json: entry.script.json }, old)) await profileScripts.remove(entry);
	}
}

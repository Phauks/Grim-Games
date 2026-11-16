/**
 * Players' feedback kept on the Storyteller's account (Trevor, 2026-11-16: "Server should save
 * because it can tie to an account or accounts"): the room writes each game's into every
 * Storyteller account in it, one document per game, and this lays the account's copy over the
 * one on this device (game-feedback.svelte.ts), so History shows it on every device signed in.
 * Only the room writes these documents; a device only removes one when its game is deleted.
 */
import { mergeFeedback, parseSavedFeedback, savedFeedback } from '#lib/core/feedback/index.ts';
import { account } from '#lib/features/account/account.svelte.ts';
import { accountSync } from '#lib/features/account/sync/sync.svelte.ts';
import { gameFeedback } from './game-feedback.svelte.ts';

const KIND = 'feedback';

accountSync.register(KIND, {
	merge: (_base, mine, theirs) =>
		savedFeedback(mergeFeedback(parseSavedFeedback(mine), parseSavedFeedback(theirs)))
});

if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			if (!account.user || !accountSync.ready || !accountSync.enabled(KIND)) return;
			for (const doc of accountSync.docs(KIND)) {
				const entries = parseSavedFeedback(doc.body);
				if (entries.length > 0) gameFeedback.save(doc.id, entries);
			}
		});
	});
}

/** Deleting a game on this device takes its feedback off the account too. */
export function forgetAccountFeedback(gameId: string): void {
	if (account.user && accountSync.enabled(KIND)) void accountSync.remove(KIND, gameId);
}

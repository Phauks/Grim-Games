/**
 * Another device in the room runs a newer build than this one (Trevor, 2026-10-26: nudge an
 * older app to update, never block it). Looks for that build now, so the usual update card
 * offers Refresh while the game goes on.
 */
import { updateCheck } from '#lib/features/about/update-check.svelte.ts';

/** A grimoire arrives every few seconds; one look in a while is enough. */
const AGAIN_AFTER_MS = 5 * 60 * 1000;
let lookedAt = -Infinity;

export function lookForNewerBuild(now = Date.now()): void {
	if (now - lookedAt < AGAIN_AFTER_MS) return;
	lookedAt = now;
	void updateCheck.check().catch(() => {});
}

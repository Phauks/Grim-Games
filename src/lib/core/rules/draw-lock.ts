/**
 * The locked pass-the-phone draw's timing rules (Trevor, 2026-10-19; plan in
 * derivative-works-review/pass-the-phone-draw.md). A Storyteller PIN keeps players from
 * leaving the draw; these make guessing it slow without ever locking the Storyteller out.
 */

/** Wrong PINs allowed before entry has to wait. */
const FREE_TRIES = 3;
/** The first wait, after the third wrong PIN in a row. */
const FIRST_WAIT_MS = 30_000;
/** Each further wrong PIN doubles the wait, up to this. */
export const MAX_WAIT_MS = 5 * 60_000;
/** "Forgot PIN" unlocks after this long, counting down where everyone can see it. */
export const FORGOT_WAIT_MS = 60_000;

/** How long entry waits after `fails` wrong PINs in a row: none for the first two. */
export function waitAfter(fails: number): number {
	if (fails < FREE_TRIES) return 0;
	return Math.min(MAX_WAIT_MS, FIRST_WAIT_MS * 2 ** (fails - FREE_TRIES));
}

/** Whole seconds left until `until` (rounded up), or 0 once it has passed. */
export function secondsLeft(until: number, now: number): number {
	return Math.max(0, Math.ceil((until - now) / 1000));
}

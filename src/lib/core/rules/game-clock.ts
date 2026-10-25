/**
 * How long a game has run (Trevor, 2026-10-23: "a timer on the grim that shows how long a
 * game has been playing (starts when first night begins)"). Wall clock time from the first
 * night's start, stopping when the game ends. Pure: callers pass the times (ms since epoch).
 */

/** Time played: from `startedAt` to the end, or to `now` while the game runs. */
export function gameLength(startedAt: number, now: number, endedAt?: number): number {
	return Math.max(0, (endedAt ?? now) - startedAt);
}

/** "h:mm:ss" from an hour on, "m:ss" before, rounded down like a stopwatch. */
export function formatGameLength(ms: number): string {
	const total = Math.floor(Math.max(0, ms) / 1000);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = String(total % 60).padStart(2, '0');
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
		: `${minutes}:${seconds}`;
}

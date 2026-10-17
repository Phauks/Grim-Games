/**
 * The day's discussion timer (Trevor, 2026-10-17: "usually 30 seconds per living
 * character"). The Storyteller starts it by hand; the app does not track day and night.
 * Pure state: callers pass the clock (`now`, in ms) so the countdown survives a slow tick or
 * a tab in the background.
 */

/** Trevor's rule of thumb: 30 seconds of discussion per living player. */
export const DAY_SECONDS_PER_ALIVE = 30;
/** What one tap on "more" or "less" changes, and the shortest timer. */
export const DAY_TIMER_STEP_MS = 30_000;

export interface DayTimer {
	/** The full length, which Reset returns to. */
	durationMs: number;
	/** Time used before the current run. */
	elapsedMs: number;
	/** When the current run started; unset while paused or not started. */
	startedAt?: number;
}

/** A new timer: 30 seconds per living player (at least one step). */
export function dayTimer(alive: number): DayTimer {
	return {
		durationMs: Math.max(DAY_TIMER_STEP_MS, alive * DAY_SECONDS_PER_ALIVE * 1000),
		elapsedMs: 0
	};
}

export const isRunning = (t: DayTimer): boolean => t.startedAt !== undefined;

/** Time used so far. */
export function elapsed(t: DayTimer, now: number): number {
	return t.elapsedMs + (t.startedAt === undefined ? 0 : Math.max(0, now - t.startedAt));
}

/** Time left, never below 0. */
export function remaining(t: DayTimer, now: number): number {
	return Math.max(0, t.durationMs - elapsed(t, now));
}

/** Untouched: never started and its length not changed by hand. */
export const isFresh = (t: DayTimer): boolean => t.elapsedMs === 0 && !isRunning(t);

export function start(t: DayTimer, now: number): DayTimer {
	if (isRunning(t) || remaining(t, now) === 0) return t;
	return { ...t, startedAt: now };
}

export function pause(t: DayTimer, now: number): DayTimer {
	if (!isRunning(t)) return t;
	return { durationMs: t.durationMs, elapsedMs: elapsed(t, now) };
}

/** Back to the full length, stopped. */
export function reset(t: DayTimer): DayTimer {
	return { durationMs: t.durationMs, elapsedMs: 0 };
}

/**
 * Lengthens or shortens the timer by whole steps, before or while it runs. The length never
 * drops below one step, nor below the time already used (so it can end now, not in the past).
 */
export function adjust(t: DayTimer, steps: number, now: number): DayTimer {
	const used = elapsed(t, now);
	const durationMs = Math.max(DAY_TIMER_STEP_MS, used, t.durationMs + steps * DAY_TIMER_STEP_MS);
	return { ...t, durationMs };
}

/** "m:ss", rounding up so the display reads 0:00 only when time is up. */
export function formatClock(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

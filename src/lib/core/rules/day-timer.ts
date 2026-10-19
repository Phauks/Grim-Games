/**
 * The day's discussion timer (Trevor, 2026-10-17: "usually 30 seconds per living
 * character"). The Storyteller starts it by hand; the app does not track day and night.
 * Pure state: callers pass the clock (`now`, in ms) so the countdown survives a slow tick or
 * a tab in the background.
 */

/** Trevor's rule of thumb: 30 seconds of discussion per living player, the default. */
export const DAY_SECONDS_PER_ALIVE = 30;
/** The setting's range (Trevor, 2026-10-19: "amount of time ... based upon player count"). */
export const DAY_SECONDS_PER_ALIVE_MIN = 5;
export const DAY_SECONDS_PER_ALIVE_MAX = 300;
/**
 * Counting down shows the time left and stops at 0:00; counting up shows the time used
 * from 0:00 and keeps going past the target (Trevor, 2026-10-17: "count up or down").
 */
export const DAY_TIMER_MODES = ['down', 'up'] as const;
export type DayTimerMode = (typeof DAY_TIMER_MODES)[number];

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

/** A new timer: by default 30 seconds per living player (at least one step). */
export function dayTimer(alive: number, secondsPerAlive = DAY_SECONDS_PER_ALIVE): DayTimer {
	return {
		durationMs: Math.max(DAY_TIMER_STEP_MS, alive * secondsPerAlive * 1000),
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

/** Starts or resumes; counting down, not once time is up. */
export function start(t: DayTimer, now: number, mode: DayTimerMode = 'down'): DayTimer {
	if (isRunning(t) || (mode === 'down' && remaining(t, now) === 0)) return t;
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

/** The target has been reached. */
export function isOver(t: DayTimer, now: number): boolean {
	return elapsed(t, now) >= t.durationMs;
}

/** What the clock shows: time left counting down, time used counting up. */
export function shown(t: DayTimer, now: number, mode: DayTimerMode): string {
	return mode === 'down' ? formatClock(remaining(t, now)) : formatClock(elapsed(t, now), 'down');
}

/**
 * "m:ss". Time left rounds up, so it reads 0:00 only when time is up; time used rounds
 * down, like a stopwatch.
 */
export function formatClock(ms: number, round: 'up' | 'down' = 'up'): string {
	const total = round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The Storyteller's timer as spectators get it (Trevor, 2026-10-19: "it should sync to the
 * storyteller timer"). `startedAt` is the Storyteller's clock, so a viewer who joins mid-run
 * still shows the right time, off only by how far apart the two devices' clocks are.
 */
export interface SharedDayTimer extends DayTimer {
	mode: DayTimerMode;
}

/** A shared timer from the room, or undefined when it is missing or malformed. */
export function parseSharedTimer(value: unknown): SharedDayTimer | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const { durationMs, elapsedMs, startedAt, mode } = value as Record<string, unknown>;
	const time = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
	if (!time(durationMs) || !time(elapsedMs)) return undefined;
	if (startedAt !== undefined && !time(startedAt)) return undefined;
	if (!DAY_TIMER_MODES.includes(mode as DayTimerMode)) return undefined;
	return {
		durationMs,
		elapsedMs,
		...(startedAt === undefined ? {} : { startedAt }),
		mode: mode as DayTimerMode
	};
}

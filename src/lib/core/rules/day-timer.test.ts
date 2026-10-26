/**
 * The day timer: Trevor's rule of thumb (2026-10-17), 30 seconds per living player.
 */
import { describe, expect, it } from 'vitest';
import {
	adjust,
	dayTimer,
	elapsed,
	formatClock,
	isFresh,
	isOver,
	isRunning,
	parseSharedTimer,
	parsePublicTimer,
	dayLeft,
	pause,
	remaining,
	reset,
	shown,
	start
} from './day-timer.ts';

describe('day timer', () => {
	it('starts at 30 seconds per living player', () => {
		expect(dayTimer(7).durationMs).toBe(210_000);
		expect(formatClock(dayTimer(7).durationMs)).toBe('3:30');
		expect(dayTimer(0).durationMs).toBe(30_000);
	});

	it('starts at the chosen time per living player (Trevor, 2026-10-19)', () => {
		expect(dayTimer(10, 45).durationMs).toBe(450_000);
		expect(formatClock(dayTimer(10, 45).durationMs)).toBe('7:30');
		// Never shorter than one step.
		expect(dayTimer(1, 5).durationMs).toBe(30_000);
	});

	it('counts down while running, holds while paused, and resets', () => {
		let t = start(dayTimer(2), 1_000);
		expect(isRunning(t)).toBe(true);
		expect(remaining(t, 11_000)).toBe(50_000);
		t = pause(t, 11_000);
		expect(remaining(t, 99_000)).toBe(50_000);
		t = start(t, 100_000);
		expect(remaining(t, 150_000)).toBe(0);
		expect(remaining(t, 999_000)).toBe(0);
		t = reset(t);
		expect(isFresh(t)).toBe(true);
		expect(remaining(t, 0)).toBe(60_000);
	});

	it('does not start once time is up', () => {
		const done = pause(start(dayTimer(1), 0), 40_000);
		expect(start(done, 50_000)).toBe(done);
	});

	it('changes length by 30 seconds, never below one step or the time used', () => {
		expect(adjust(dayTimer(2), 1, 0).durationMs).toBe(90_000);
		expect(adjust(dayTimer(2), -5, 0).durationMs).toBe(30_000);
		const running = start(dayTimer(4), 0);
		expect(adjust(running, -10, 100_000).durationMs).toBe(100_000);
		expect(remaining(adjust(running, -10, 100_000), 100_000)).toBe(0);
	});

	it('counting up, changes the time used by 30 seconds, never below 0:00', () => {
		const t = dayTimer(4);
		expect(elapsed(adjust(t, 1, 0, 'up'), 0)).toBe(30_000);
		expect(adjust(t, 1, 0, 'up').durationMs).toBe(t.durationMs);
		expect(elapsed(adjust(t, -1, 0, 'up'), 0)).toBe(0);
		const running = start(t, 0, 'up');
		const later = adjust(running, 2, 10_000, 'up');
		expect(isRunning(later)).toBe(true);
		expect(elapsed(later, 10_000)).toBe(70_000);
		expect(elapsed(later, 15_000)).toBe(75_000);
		expect(elapsed(adjust(running, -1, 10_000, 'up'), 10_000)).toBe(0);
	});

	it('shows m:ss, rounding up', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(1)).toBe('0:01');
		expect(formatClock(59_001)).toBe('1:00');
		expect(formatClock(605_000)).toBe('10:05');
	});

	// Trevor, 2026-10-17: the timer can count up instead.
	it('counts up from 0:00 past the target, which it still marks', () => {
		let t = start(dayTimer(1), 0, 'up');
		expect(shown(t, 10_400, 'up')).toBe('0:10');
		expect(shown(t, 10_400, 'down')).toBe('0:20');
		expect(isOver(t, 29_000)).toBe(false);
		expect(isOver(t, 30_000)).toBe(true);
		expect(shown(t, 95_000, 'up')).toBe('1:35');
		t = pause(t, 95_000);
		// Counting up resumes past the target; counting down does not.
		expect(start(t, 100_000, 'up').startedAt).toBe(100_000);
		expect(start(t, 100_000, 'down')).toBe(t);
	});
});

describe('the timer spectators see (Trevor, 2026-10-19)', () => {
	it('keeps a running or paused timer and its mode', () => {
		expect(
			parseSharedTimer({ durationMs: 60_000, elapsedMs: 5_000, startedAt: 9, mode: 'up' })
		).toEqual({ durationMs: 60_000, elapsedMs: 5_000, startedAt: 9, mode: 'up' });
		expect(parseSharedTimer({ durationMs: 60_000, elapsedMs: 0, mode: 'down' })).toEqual({
			durationMs: 60_000,
			elapsedMs: 0,
			mode: 'down'
		});
	});

	it('drops anything malformed', () => {
		expect(parseSharedTimer(undefined)).toBeUndefined();
		expect(parseSharedTimer({ durationMs: -1, elapsedMs: 0, mode: 'down' })).toBeUndefined();
		expect(parseSharedTimer({ durationMs: 1, elapsedMs: 0, mode: 'sideways' })).toBeUndefined();
		expect(
			parseSharedTimer({ durationMs: 1, elapsedMs: 0, startedAt: 'soon', mode: 'down' })
		).toBeUndefined();
	});
});

describe("players' day timer (Trevor, 2026-10-26: sun or timer for players)", () => {
	it('keeps the timer and how it looks', () => {
		expect(
			parsePublicTimer({
				durationMs: 60_000,
				elapsedMs: 0,
				startedAt: 9,
				mode: 'down',
				look: 'sun'
			})
		).toEqual({ durationMs: 60_000, elapsedMs: 0, startedAt: 9, mode: 'down', look: 'sun' });
	});

	it('drops a timer with no look, or a malformed one', () => {
		expect(parsePublicTimer({ durationMs: 60_000, elapsedMs: 0, mode: 'down' })).toBeUndefined();
		expect(
			parsePublicTimer({ durationMs: 60_000, elapsedMs: 0, mode: 'down', look: 'moon' })
		).toBeUndefined();
		expect(parsePublicTimer(undefined)).toBeUndefined();
	});

	it("says how much of the day's time is left, from 1 down to 0", () => {
		const t = start(dayTimer(2), 0);
		expect(dayLeft(dayTimer(2), 99_000)).toBe(1);
		expect(dayLeft(t, 15_000)).toBe(0.75);
		expect(dayLeft(t, 60_000)).toBe(0);
		expect(dayLeft(t, 90_000)).toBe(0);
	});
});

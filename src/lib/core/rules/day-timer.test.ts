/**
 * The day timer: Trevor's rule of thumb (2026-10-17), 30 seconds per living player.
 */
import { describe, expect, it } from 'vitest';
import {
	adjust,
	dayTimer,
	formatClock,
	isFresh,
	isOver,
	isRunning,
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

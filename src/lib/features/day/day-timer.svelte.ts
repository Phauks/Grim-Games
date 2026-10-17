import { dayTimers } from '#lib/core/rules/index.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { playTimerSound, unlockTimerSound } from './timer-sound.ts';

const { adjust, dayTimer, isFresh, isRunning, pause, remaining, start } = dayTimers;
type DayTimer = dayTimers.DayTimer;

/**
 * The day timer's live state (Trevor, 2026-10-17). One timer for the app, kept outside the
 * day sheet so closing and reopening it doesn't stop the countdown, and so the board can
 * show it too (`DayTimer.svelte`, or read `running`, `remaining` and `done`). Until it is
 * started or changed by hand its length follows the living players (`follow`). When time
 * is up the device vibrates where it can, plays the chosen sound (`timerSound`), and `done`
 * turns on.
 */
class LiveDayTimer {
	#timer = $state<DayTimer>(dayTimer(0));
	now = $state(Date.now());
	#ticker: ReturnType<typeof setInterval> | undefined;
	#signalled = false;
	/** The length was changed by hand, so it no longer follows the living players. */
	#adjusted = false;

	get remaining(): number {
		return remaining(this.#timer, this.now);
	}
	get running(): boolean {
		return isRunning(this.#timer);
	}
	get done(): boolean {
		return this.remaining === 0;
	}
	get fresh(): boolean {
		return isFresh(this.#timer);
	}

	/** Matches the length to the living players while the timer is untouched. */
	follow(alive: number): void {
		const next = dayTimer(alive);
		if (this.fresh && !this.#adjusted && next.durationMs !== this.#timer.durationMs) {
			this.#timer = next;
		}
	}

	toggle(): void {
		this.now = Date.now();
		if (this.running) {
			this.#timer = pause(this.#timer, this.now);
			this.#stop();
			return;
		}
		this.#timer = start(this.#timer, this.now);
		if (!this.running) return;
		unlockTimerSound();
		this.#signalled = false;
		this.#ticker = setInterval(() => this.#tick(), 250);
	}

	/** Stopped, at 30 seconds per living player again. */
	reset(alive: number): void {
		this.#stop();
		this.#adjusted = false;
		this.#timer = dayTimer(alive);
		this.now = Date.now();
	}

	adjust(steps: number): void {
		this.now = Date.now();
		this.#adjusted = true;
		this.#timer = adjust(this.#timer, steps, this.now);
	}

	#tick(): void {
		this.now = Date.now();
		if (this.remaining > 0) return;
		this.#timer = pause(this.#timer, this.now);
		this.#stop();
		if (!this.#signalled) {
			this.#signalled = true;
			navigator.vibrate?.([300, 150, 300, 150, 300]);
			playTimerSound(preferences.current.timerSound);
		}
	}

	#stop(): void {
		if (this.#ticker !== undefined) clearInterval(this.#ticker);
		this.#ticker = undefined;
	}
}

export const liveDayTimer = new LiveDayTimer();

import { dayTimers } from '#lib/core/rules/index.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { playTimerSound, unlockTimerSound, vibrateTimer } from './timer-sound.ts';
import { keepScreenAwake } from './timer-wake-lock.ts';

const { adjust, dayTimer, elapsed, isFresh, isOver, isRunning, pause, remaining, shown, start } =
	dayTimers;
type DayTimer = dayTimers.DayTimer;

/**
 * The day timer's live state (Trevor, 2026-10-17). One timer for the app, kept outside the
 * day sheet so closing and reopening it doesn't stop it, and so the board can show it too
 * (`DayTimer.svelte`, or read `clock`, `running`, `done`). Until it is started or changed by
 * hand its length follows the living players (`follow`). It counts down, stopping at 0:00,
 * or up past the target, by the `timerMode` setting. When the target is reached the device
 * vibrates where it can, plays the chosen sound (`timerSound`), and `done` turns on. While it
 * runs the screen stays on (`timerKeepAwake`), so the phone doesn't lock mid-day.
 */
class LiveDayTimer {
	#timer = $state<DayTimer>(dayTimer(0));
	now = $state(Date.now());
	#ticker: ReturnType<typeof setInterval> | undefined;
	/** The target was signalled; set again only once it is moved past the time used. */
	#signalled = false;
	/** The length was changed by hand, so it no longer follows the living players. */
	#adjusted = false;

	get mode(): dayTimers.DayTimerMode {
		return preferences.current.timerMode;
	}
	/** What the clock shows, "m:ss", in the current mode. */
	get clock(): string {
		return shown(this.#timer, this.now, this.mode);
	}
	get remaining(): number {
		return remaining(this.#timer, this.now);
	}
	get elapsed(): number {
		return elapsed(this.#timer, this.now);
	}
	get running(): boolean {
		return isRunning(this.#timer);
	}
	/** The target is reached (0:00 counting down; past it counting up). */
	get done(): boolean {
		return isOver(this.#timer, this.now);
	}
	get fresh(): boolean {
		return isFresh(this.#timer);
	}
	/** Start is possible: not running, and counting up or with time left. */
	get startable(): boolean {
		return !this.running && (this.mode === 'up' || !this.done);
	}

	/** Matches the length to the living players, and the time each, while untouched. */
	follow(alive: number): void {
		const next = dayTimer(alive, preferences.current.timerPerPlayer);
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
		this.#timer = start(this.#timer, this.now, this.mode);
		if (!this.running) return;
		unlockTimerSound();
		this.#signalled = this.done;
		this.#ticker = setInterval(() => this.#tick(), 250);
		keepScreenAwake(preferences.current.timerKeepAwake);
	}

	/** Stopped, at the time per living player again. */
	reset(alive: number): void {
		this.#stop();
		this.#adjusted = false;
		this.#signalled = false;
		this.#timer = dayTimer(alive, preferences.current.timerPerPlayer);
		this.now = Date.now();
	}

	adjust(steps: number): void {
		this.now = Date.now();
		this.#adjusted = true;
		this.#timer = adjust(this.#timer, steps, this.now);
		this.#signalled = this.done;
	}

	/** Turns `timerKeepAwake` on or off, taking effect at once if the timer is running. */
	setKeepAwake(timerKeepAwake: boolean): void {
		preferences.update({ timerKeepAwake });
		keepScreenAwake(timerKeepAwake && this.running);
	}

	#tick(): void {
		this.now = Date.now();
		if (!this.done) return;
		// Counting down stops at 0:00; counting up keeps going.
		if (this.mode === 'down') {
			this.#timer = pause(this.#timer, this.now);
			this.#stop();
		}
		if (!this.#signalled) {
			this.#signalled = true;
			if (preferences.current.timerVibrate) vibrateTimer();
			playTimerSound(preferences.current.timerSound);
		}
	}

	#stop(): void {
		if (this.#ticker !== undefined) clearInterval(this.#ticker);
		this.#ticker = undefined;
		keepScreenAwake(false);
	}
}

export const liveDayTimer = new LiveDayTimer();

import { dayTimers } from '#lib/core/rules/index.ts';

const { dayLeft, isFresh, isOver, isRunning, shown } = dayTimers;

/**
 * The Storyteller's day timer on a spectator's board (Trevor, 2026-10-19: "it should sync
 * to the storyteller timer"). It only shows: each copy from the room replaces the last, and
 * while it runs the clock ticks here between copies.
 */
export class WatchedTimer {
	#timer = $state<dayTimers.SharedDayTimer>();
	now = $state(Date.now());
	#ticker: ReturnType<typeof setInterval> | undefined;

	/** False until the Storyteller's device has sent a timer. */
	get known(): boolean {
		return this.#timer !== undefined;
	}
	get mode(): dayTimers.DayTimerMode {
		return this.#timer?.mode ?? 'down';
	}
	get clock(): string {
		return this.#timer ? shown(this.#timer, this.now, this.mode) : '';
	}
	get running(): boolean {
		return !!this.#timer && isRunning(this.#timer);
	}
	get done(): boolean {
		return !!this.#timer && isOver(this.#timer, this.now);
	}
	/** The share of the day's time still to come, 1 to 0, for the players' sun. */
	get left(): number {
		return this.#timer ? dayLeft(this.#timer, this.now) : 1;
	}
	get fresh(): boolean {
		return !this.#timer || isFresh(this.#timer);
	}
	get startable(): boolean {
		return false;
	}

	/** The latest copy from the room, or undefined from a Storyteller whose app sends none. */
	set(timer: dayTimers.SharedDayTimer | undefined): void {
		this.#timer = timer;
		this.now = Date.now();
		if (this.running && this.#ticker === undefined)
			this.#ticker = setInterval(() => (this.now = Date.now()), 250);
		else if (!this.running) this.stop();
	}

	stop(): void {
		if (this.#ticker !== undefined) clearInterval(this.#ticker);
		this.#ticker = undefined;
	}
}

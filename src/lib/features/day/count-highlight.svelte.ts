/**
 * A day count shown on the board (Trevor, 2026-11-18: "clicking the pills is not highlighting
 * the board, it still opens modals"): tapping a count beside the board marks the seats behind
 * it as a reminder in hand marks the seats it fits, and fades the rest. Tapped again, or the
 * Day tab left, it stops.
 */
import type { DayCount } from '#lib/core/rules/day/voting.ts';

class CountHighlight {
	/** The count whose seats the board marks, if any. */
	current = $state<DayCount>();

	toggle(count: DayCount): void {
		this.current = this.current === count ? undefined : count;
	}

	clear(): void {
		this.current = undefined;
	}
}

export const countHighlight = new CountHighlight();

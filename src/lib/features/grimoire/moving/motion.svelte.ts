import { parseMovingMotion, type MovingMotion } from '#lib/core/backgrounds/moving.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

/**
 * How moving backgrounds move on this device (M43): the frame rate, what Reduce motion does
 * to them, and the player's switch that holds the Storyteller's shared one still (Trevor,
 * 2026-11-05: "Storyteller's, with a still switch").
 */
const KEY = 'grim.movingMotion';

class MovingMotionStore {
	current = $state<MovingMotion>(readParsed(KEY, parseMovingMotion));

	update(change: Partial<MovingMotion>): void {
		this.current = parseMovingMotion({ ...this.current, ...change });
		// Storage blocked: the choice still applies for this visit.
		writeStored(KEY, this.current);
	}
}

export const movingMotion = new MovingMotionStore();

import { parseMovingMotion, type MovingMotion } from '#lib/core/backgrounds/moving.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

/**
 * How moving backgrounds are drawn on this device (M43): the frame rate. Whether they move
 * at all is the Animations setting (ui/animations.svelte.ts).
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

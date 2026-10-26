import { describe, expect, it } from 'vitest';
import { isBuiltAt, isNewerBuild, newRoom, playerView, setStorytellerBuild } from './room.ts';

const EARLIER = '2026-10-25T10:00:00.000Z';
const LATER = '2026-10-26T10:00:00.000Z';

describe('the Storyteller build a room passes on to phones', () => {
	it('keeps a valid build time and ignores anything else', () => {
		const room = newRoom('hash');
		expect(setStorytellerBuild(room, LATER).storytellerBuiltAt).toBe(LATER);
		expect(setStorytellerBuild(room, 'yesterday')).toBe(room);
		expect(setStorytellerBuild(room, 12)).toBe(room);
		expect(setStorytellerBuild(room, 'x'.repeat(41))).toBe(room);
		const built = setStorytellerBuild(room, LATER);
		expect(setStorytellerBuild(built, LATER)).toBe(built);
	});

	it('tells each phone when the Storyteller built their app', () => {
		const room = setStorytellerBuild(newRoom('hash'), LATER);
		expect(playerView(room, 'm1').storytellerBuiltAt).toBe(LATER);
		expect(playerView(newRoom('hash'), 'm1')).not.toHaveProperty('storytellerBuiltAt');
	});

	it('finds a newer build only when theirs was made after mine', () => {
		expect(isNewerBuild(LATER, EARLIER)).toBe(true);
		expect(isNewerBuild(EARLIER, LATER)).toBe(false);
		expect(isNewerBuild(LATER, LATER)).toBe(false);
		// A Storyteller app from before builds were sent says nothing.
		expect(isNewerBuild(undefined, EARLIER)).toBe(false);
		expect(isBuiltAt('not a date')).toBe(false);
	});
});

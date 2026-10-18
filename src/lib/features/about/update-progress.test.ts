import { describe, expect, it } from 'vitest';
import { isPrecacheProgress, percentDone, PRECACHE_PROGRESS } from './update-progress.ts';

describe('update download progress', () => {
	it('reads only well-formed progress messages', () => {
		expect(isPrecacheProgress({ type: PRECACHE_PROGRESS, done: 3, total: 10 })).toBe(true);
		expect(isPrecacheProgress({ type: PRECACHE_PROGRESS, done: '3', total: 10 })).toBe(false);
		expect(isPrecacheProgress({ type: 'SKIP_WAITING' })).toBe(false);
		expect(isPrecacheProgress(null)).toBe(false);
	});

	it('gives whole percents, never over 100', () => {
		expect(percentDone({ done: 1, total: 3 })).toBe(33);
		expect(percentDone({ done: 5, total: 4 })).toBe(100);
		expect(percentDone({ done: 0, total: 0 })).toBe(0);
	});
});

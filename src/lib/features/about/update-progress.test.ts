import { describe, expect, it } from 'vitest';
import {
	isPrecacheProgress,
	parseSizes,
	percentDone,
	PRECACHE_PROGRESS,
	totalBytes
} from './update-progress.ts';

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

	it('counts bytes when the build published its sizes', () => {
		// Trevor (2026-10-18): "show size of update as well, not just percentage".
		expect(percentDone({ done: 9, total: 10, bytes: 1_000, totalBytes: 4_000 })).toBe(25);
		expect(percentDone({ done: 1, total: 4, bytes: 0, totalBytes: undefined })).toBe(25);
		expect(
			isPrecacheProgress({ type: PRECACHE_PROGRESS, done: 1, total: 2, bytes: 5, totalBytes: 9 })
		).toBe(true);
		expect(isPrecacheProgress({ type: PRECACHE_PROGRESS, done: 1, total: 2, bytes: '5' })).toBe(
			false
		);
	});

	it('reads the sizes file and totals only the files being stored', () => {
		const sizes = parseSizes({ '/a.js': 100, '/b.css': 50, '/c.png': -1, '/d': 'big' });
		expect(sizes).toEqual({ '/a.js': 100, '/b.css': 50 });
		expect(totalBytes(['/a.js', '/b.css', '/'], sizes)).toBe(150);
		expect(totalBytes(['/elsewhere.js'], sizes)).toBeUndefined();
		expect(parseSizes(null)).toEqual({});
	});
});

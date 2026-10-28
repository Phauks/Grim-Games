import { describe, expect, it } from 'vitest';
import {
	isMissingBuildFile,
	isMissingPageFile,
	mayLoadAfresh,
	RELOAD_GAP_MS
} from './stale-build.svelte.ts';

describe('isMissingBuildFile', () => {
	it("recognises each browser's failed module load", () => {
		for (const message of [
			'Failed to fetch dynamically imported module: /_app/immutable/nodes/10.W9ZH6SXS.js',
			'error loading dynamically imported module: /_app/immutable/nodes/42.D8sFBTX4.js',
			'Importing a module script failed.'
		]) {
			expect(isMissingBuildFile(new TypeError(message))).toBe(true);
		}
		expect(isMissingBuildFile('Failed to fetch dynamically imported module: /x.js')).toBe(true);
	});

	it('leaves other errors to be reported', () => {
		expect(isMissingBuildFile(new TypeError('Failed to fetch'))).toBe(false);
		expect(isMissingBuildFile(new Error('svelte.dev/e/state_unsafe_mutation'))).toBe(false);
		expect(isMissingBuildFile({ message: 'Importing a module script failed.' })).toBe(false);
		expect(isMissingBuildFile(undefined)).toBe(false);
	});
});

describe('isMissingPageFile', () => {
	it("tells a page's own code from a file loaded later", () => {
		expect(
			isMissingPageFile(
				new TypeError(
					'Failed to fetch dynamically imported module: http://localhost/_app/immutable/nodes/31.BFv3Y62W.js'
				)
			)
		).toBe(true);
		expect(
			isMissingPageFile(
				new TypeError('Failed to fetch dynamically imported module: /_app/immutable/chunks/x.js')
			)
		).toBe(false);
		// Safari names no file, so it can't be told apart: the page reloads, as before.
		expect(isMissingPageFile(new TypeError('Importing a module script failed.'))).toBe(false);
		expect(isMissingPageFile(new Error('/_app/immutable/nodes/1.js is fine'))).toBe(false);
	});
});

describe('mayLoadAfresh', () => {
	it('allows one fresh load a minute', () => {
		expect(mayLoadAfresh(1_000, undefined)).toBe(true);
		expect(mayLoadAfresh(1_000 + RELOAD_GAP_MS - 1, 1_000)).toBe(false);
		expect(mayLoadAfresh(1_000 + RELOAD_GAP_MS, 1_000)).toBe(true);
		expect(mayLoadAfresh(1_000, Number.NaN)).toBe(true);
	});
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	builtFiles,
	hasBuiltFrames,
	resolveBuiltStack,
	resolveStack,
	sourcePath,
	type Locate
} from './source-stack.ts';

// Shaped like the report Trevor sent on 2026-10-30, after scrubUrls.
const chrome = [
	'at ze (/_app/immutable/chunks/SwMh2NRa.js:1:2468)',
	'at /_app/immutable/chunks/SwMh2NRa.js:2:4667',
	'at /_app/immutable/chunks/C_1G-82e.js:2:37372'
].join('\n');

const places: Record<string, { source: string; line: number; column: number; name?: string }> = {
	'/_app/immutable/chunks/SwMh2NRa.js:1:2467': {
		source: '../../../../node_modules/svelte/src/internal/client/errors.js',
		line: 40,
		column: 9
	},
	'/_app/immutable/chunks/SwMh2NRa.js:2:4666': {
		source: '../../../../node_modules/svelte/src/internal/client/dom/blocks/each.js',
		line: 120,
		column: 4,
		name: 'each_key_duplicate'
	},
	'/_app/immutable/chunks/C_1G-82e.js:2:37371': {
		source: '../../../../src/lib/features/grimoire/Board.svelte',
		line: 88,
		column: 2,
		name: 'each'
	}
};
const locate: Locate = (file, line, column) => places[`${file}:${line}:${column}`];

describe('resolveStack', () => {
	it('names the source file, line and function of each built frame', () => {
		expect(resolveStack(chrome, locate)).toBe(
			[
				'at each_key_duplicate (node_modules/svelte/src/internal/client/errors.js:40:10)',
				'at each (node_modules/svelte/src/internal/client/dom/blocks/each.js:120:5)',
				'at src/lib/features/grimoire/Board.svelte:88:3'
			].join('\n')
		);
	});

	it('reads Firefox and Safari frames too', () => {
		expect(resolveStack('ze@/_app/immutable/chunks/SwMh2NRa.js:1:2468', locate)).toBe(
			'at node_modules/svelte/src/internal/client/errors.js:40:10'
		);
	});

	it('keeps frames it cannot place, and lines that are not frames, as they were', () => {
		const stack = 'at x (/_app/immutable/chunks/Other.js:1:1)\nat y (example.com/lib.js:3:4)';
		expect(resolveStack(stack, locate)).toBe(stack);
	});
});

describe('sourcePath', () => {
	it('starts at the project folder', () => {
		expect(sourcePath('../../../../src/routes/+page.svelte')).toBe('src/routes/+page.svelte');
		expect(sourcePath('../../node_modules/svelte/src/index.js')).toBe(
			'node_modules/svelte/src/index.js'
		);
		expect(sourcePath('../../build-info.ts')).toBe('build-info.ts');
	});
});

describe('builtFiles', () => {
	it('lists each built file once', () => {
		expect(builtFiles(chrome)).toEqual([
			'/_app/immutable/chunks/SwMh2NRa.js',
			'/_app/immutable/chunks/C_1G-82e.js'
		]);
		expect(hasBuiltFrames('at src/lib/x.ts:1:2')).toBe(false);
		expect(hasBuiltFrames(undefined)).toBe(false);
	});
});

describe('resolveBuiltStack', () => {
	afterEach(() => vi.unstubAllGlobals());

	// One generated line: column 0 maps to a.ts 1:0; column 10 maps to a.ts 5:2, named `run`.
	const map = {
		version: 3,
		sources: ['../../../../src/lib/a.ts'],
		names: ['run'],
		mappings: 'AAAA,UAIEA'
	};

	it("reads the build's map from this origin", async () => {
		const fetch = vi.fn(async () => Response.json(map));
		vi.stubGlobal('fetch', fetch);
		// The inner frame takes its name from the call its caller's frame maps to.
		const stack =
			'at f (/_app/immutable/chunks/A1.js:1:1)\nat g (/_app/immutable/chunks/A1.js:1:11)';
		expect(await resolveBuiltStack(stack)).toBe('at run (src/lib/a.ts:1:1)\nat src/lib/a.ts:5:3');
		expect(fetch).toHaveBeenCalledWith('/_app/immutable/chunks/A1.js.map', expect.anything());
	});

	it('leaves the stack as it was when there is no map, such as the app page instead', async () => {
		vi.stubGlobal('fetch', async () => new Response('<!doctype html>', { status: 200 }));
		const stack = 'at f (/_app/immutable/chunks/B2.js:1:11)';
		expect(await resolveBuiltStack(stack)).toBe(stack);
	});

	it('tries a map again after a failed fetch', async () => {
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('Failed to fetch');
		});
		const stack = 'at f (/_app/immutable/chunks/C3.js:1:11)';
		expect(await resolveBuiltStack(stack)).toBe(stack);
		vi.stubGlobal('fetch', async () => Response.json(map));
		expect(await resolveBuiltStack(stack)).toBe('at src/lib/a.ts:5:3');
	});
});

/**
 * Runs in the Vitest browser project (Chromium), against real IndexedDB. The file name
 * ends in `.svelte.test.ts` only because that is what the browser project picks up.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_SAVED_SCRIPTS } from './saved-scripts.ts';
import { IdbScriptLibrary } from './script-library.ts';

let n = 0;
const libraries: IdbScriptLibrary[] = [];

function library(): IdbScriptLibrary {
	let clock = 0;
	const lib = new IdbScriptLibrary(`scripts-test-${Date.now()}-${++n}`, indexedDB, () => ++clock);
	libraries.push(lib);
	return lib;
}

afterEach(async () => {
	for (const lib of libraries.splice(0)) await lib.close();
});

const script = (name: string) => ({
	name,
	json: [{ id: '_meta', name }, 'chef', 'imp'],
	source: { kind: 'paste' } as const
});

describe('IdbScriptLibrary', () => {
	it('lists scripts most recently used first', async () => {
		const lib = library();
		await lib.use(script('One'));
		await lib.use(script('Two'));
		expect((await lib.list()).map((s) => s.name)).toEqual(['Two', 'One']);
	});

	it('moves a script used again to the top instead of saving it twice', async () => {
		const lib = library();
		const first = await lib.use(script('One'));
		await lib.use(script('Two'));
		const again = await lib.use({ ...script('One'), source: { kind: 'share' } });
		expect(again.scriptId).toBe(first.scriptId);
		expect(again.source).toEqual({ kind: 'share' });
		expect((await lib.list()).map((s) => s.name)).toEqual(['One', 'Two']);
	});

	it(`keeps only the ${MAX_SAVED_SCRIPTS} most recent`, async () => {
		const lib = library();
		for (let i = 0; i < MAX_SAVED_SCRIPTS + 3; i++) await lib.use(script(`S${i}`));
		const names = (await lib.list()).map((s) => s.name);
		expect(names).toHaveLength(MAX_SAVED_SCRIPTS);
		expect(names[0]).toBe(`S${MAX_SAVED_SCRIPTS + 2}`);
		expect(names).not.toContain('S0');
	});

	it('deletes a script', async () => {
		const lib = library();
		const saved = await lib.use(script('One'));
		await lib.delete(saved.scriptId);
		expect(await lib.list()).toEqual([]);
	});
});

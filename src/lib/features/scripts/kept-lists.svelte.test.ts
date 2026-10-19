/**
 * Runs in the Vitest browser project (Chromium), against real localStorage. Each source's list
 * kept from an earlier visit is read when its module loads, never from the list's getter:
 * Search reads the getters inside derived values, where writing state throws (Trevor,
 * 2026-10-19: `state_unsafe_mutation` on /scripts).
 */
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hamlet = [{ id: '_meta', name: 'Little Hamlet', author: 'TPI' }, 'washerwoman', 'imp'];

afterEach(() => localStorage.clear());

/** The list's length as a derived value sees it, the way Search reads it. */
function lengthInDerived(read: () => readonly unknown[]): number {
	let seen = -1;
	const stop = $effect.root(() => {
		const length = $derived(read().length);
		$effect(() => {
			seen = length;
		});
	});
	flushSync();
	stop();
	return seen;
}

describe('lists kept on the device', () => {
	it('Official custom scripts: read inside a derived value without writing state', async () => {
		localStorage.setItem(
			'grim-games.curated-scripts',
			JSON.stringify({ scripts: [{ section: 'recommended', link: 'https://x', json: hamlet }] })
		);
		vi.resetModules();
		const { curatedScripts } = await import('./curated.svelte.ts');
		expect(lengthInDerived(() => curatedScripts.list)).toBe(1);
	});

	it('Carousel, HomeBrew Wiki and Bloodstar: read inside a derived value too', async () => {
		vi.resetModules();
		const { collectionScripts } = await import('./collection.svelte.ts');
		const { homebrewScripts } = await import('./homebrew-scripts.svelte.ts');
		const { bloodstarScripts } = await import('./bloodstar.svelte.ts');
		// Nothing kept: empty, and still no write.
		expect(lengthInDerived(() => collectionScripts.list)).toBe(0);
		expect(lengthInDerived(() => homebrewScripts.list)).toBe(0);
		expect(lengthInDerived(() => bloodstarScripts.list)).toBe(0);
	});
});

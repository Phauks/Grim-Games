import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import NestedFlush from './NestedFlush.svelte';

// The /join crash (Trevor, 2026-10-30): "Cannot read properties of null (reading 'clear')" in
// Svelte's flush_queued_effects, when a block an effect opened runs flushSync as it mounts.
// svelte-nested-flush.ts patches Svelte; without it this test fails with that error.
it('opens a block whose content flushes, without a crash', async () => {
	const errors: string[] = [];
	const onError = (event: ErrorEvent) => errors.push(String(event.error));
	window.addEventListener('error', onError);
	try {
		render(NestedFlush);
		await page.getByRole('button', { name: 'Show' }).click();
		await expect.element(page.getByText('Shown')).toBeVisible();
		await new Promise((done) => setTimeout(done, 50));
		expect(errors).toEqual([]);
	} finally {
		window.removeEventListener('error', onError);
	}
});

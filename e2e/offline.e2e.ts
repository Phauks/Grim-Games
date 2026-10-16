import { expect, test, type Page } from '@playwright/test';

/** Paths stored in every cache, by cache name. */
function cachedPaths(page: Page) {
	return page.evaluate(async () => {
		const out: Record<string, string[]> = {};
		for (const name of await caches.keys()) {
			const keys = await (await caches.open(name)).keys();
			out[name] = keys.map((request) => new URL(request.url).pathname);
		}
		return out;
	});
}

test('a fresh visit stores only what a game needs, and a chosen script works offline', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	// Edition icons and .woff fonts wait for first use.
	const fresh = Object.values(await cachedPaths(page)).flat();
	expect(fresh).toContain('/data/roles.json');
	expect(fresh.filter((path) => path.startsWith('/data/icons/tb/'))).toEqual([]);
	expect(fresh.filter((path) => path.endsWith('.woff'))).toEqual([]);

	// Choosing a script stores every icon on it, shown or not.
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(page.getByTestId('current-script-name')).toHaveText('Trouble Brewing');
	await expect
		.poll(async () => (await cachedPaths(page))['grim-games-runtime-v1'] ?? [])
		.toEqual(
			expect.arrayContaining(['/data/icons/tb/imp_e.webp', '/data/icons/tb/washerwoman_g.webp'])
		);

	await context.setOffline(true);
	await page.goto('/play');
	const icons = page.locator('img[src^="/data/icons/tb/"]');
	await expect(icons.first()).toBeVisible();
	await expect
		.poll(() =>
			icons.evaluateAll((images) =>
				(images as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth > 0)
			)
		)
		.toBe(true);
	await context.setOffline(false);
});

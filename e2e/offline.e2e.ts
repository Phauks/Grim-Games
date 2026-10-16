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
	await page.goto('/play#e=tb');
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	// The player sheet also shows the edition's Travellers, so theirs are stored too. The
	// service worker stores them a few at a time: wait for every one before going offline.
	const scriptIcons = await page.evaluate(async () => {
		const roles = (await (await fetch('/data/roles.json')).json()) as {
			id: string;
			edition?: string;
			team: string;
		}[];
		return roles
			.filter((role) => role.edition === 'tb')
			.flatMap((role) =>
				(role.team === 'traveller' ? ['', '_g', '_e'] : ['_g', '_e']).map(
					(suffix) => `/data/icons/tb/${role.id}${suffix}.webp`
				)
			);
	});
	expect(scriptIcons).toEqual(
		expect.arrayContaining(['/data/icons/tb/imp_e.webp', '/data/icons/tb/thief.webp'])
	);
	await expect
		.poll(async () => (await cachedPaths(page))['grim-games-runtime-v1'] ?? [], { timeout: 30_000 })
		.toEqual(expect.arrayContaining(scriptIcons));

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

import { expect, test, type Page } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

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

test("a homebrew character's good and evil images are stored with the script", async ({
	page,
	context
}) => {
	// A host that allows CORS, as GitHub and most image hosts do. A tiny PNG stands in.
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	);
	const host = 'https://homebrew-images.example';
	await context.route(`${host}/**`, (route) =>
		route.fulfill({
			body: png,
			contentType: 'image/png',
			headers: { 'access-control-allow-origin': '*' }
		})
	);
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	const script = [
		{ id: '_meta', name: 'Storm Front' },
		{
			id: 'stormwarden',
			name: 'Storm Warden',
			team: 'townsfolk',
			ability: 'Each night, choose a player: they are safe from the Demon tonight.',
			image: [`${host}/stormwarden.png`, `${host}/stormwarden-evil.png`]
		},
		'imp'
	];
	await page.goto(`/play#s=${await encodeSharedScript(script)}`);
	await expect(page.getByRole('heading', { name: 'Storm Front', level: 1 })).toBeVisible();
	await expect
		.poll(async () => (await cachedPaths(page))['grim-games-runtime-v1'] ?? [], { timeout: 30_000 })
		.toEqual(expect.arrayContaining(['/stormwarden.png', '/stormwarden-evil.png']));

	// The host is gone: only the stored copies can show.
	await context.unroute(`${host}/**`);
	await context.route(`${host}/**`, (route) => route.abort('internetdisconnected'));
	await context.setOffline(true);
	await page.reload();
	const image = page.locator(`img[src="${host}/stormwarden.png"]`).first();
	await expect(image).toBeVisible();
	await expect
		.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
		.toBe(true);
	await context.setOffline(false);
});

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

// Trevor (2026-10-19): updates "stutter and are somewhat slow", as each one downloaded the whole
// build. A new build copies the files the previous one holds unchanged and downloads the rest.
test('an update downloads only the files that changed', async ({ page, context }) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	const before = await cachedPaths(page);
	const [oldBuild] = Object.keys(before).filter((name) => name !== 'grim-games-runtime-v1');
	expect(before[oldBuild]).toContain('/precache-hashes.json');

	// Pretend the stored build is an older one: move it under another name, then install
	// this build again (a new script address) as if it were the next.
	await page.evaluate(async (name) => {
		const old = await caches.open('grim-games-older');
		const current = await caches.open(name);
		for (const request of await current.keys())
			await old.put(request, (await current.match(request))!);
		await caches.delete(name);
		const runtime = await caches.open('grim-games-runtime-v1');
		await runtime.put('/__active-build', new Response('grim-games-older'));
	}, oldBuild);
	const downloaded: string[] = [];
	context.on('request', (request) => {
		if (request.serviceWorker()) downloaded.push(new URL(request.url()).pathname);
	});
	await page.evaluate(async () => {
		const registration = await navigator.serviceWorker.register('/service-worker.js?next');
		const next = registration.installing;
		if (!next) throw new Error('no new build found');
		await new Promise<void>((done) =>
			next.addEventListener('statechange', () => next.state === 'installed' && done())
		);
	});

	const after = await cachedPaths(page);
	// Every file of the build is stored again...
	expect(after[oldBuild]).toEqual(expect.arrayContaining(before[oldBuild]));
	// ...but only the page itself came over the network.
	expect(downloaded.filter((path) => path.startsWith('/_app/immutable/'))).toEqual([]);
	expect(downloaded).not.toContain('/data/roles.json');
	expect(downloaded).toContain('/');
});

// Trevor (2026-10-23): updates still felt slow. Most files of an update were only renamed,
// because a file they import changed (chunk-renames.ts); those are rebuilt from the stored copy.
test('an update rebuilds a renamed file from its stored copy', async ({
	page,
	context,
	request
}) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	const [build] = Object.keys(await cachedPaths(page)).filter(
		(name) => name !== 'grim-games-runtime-v1'
	);

	// Pretend the stored build is an older one in which a page file and a file it imports had
	// other names: the import is the file that changed, the page file was only renamed.
	const { page: renamed, dependency } = await page.evaluate(async (name) => {
		const current = await caches.open(name);
		const chunks = await (await current.match('/precache-chunks.json'))!.json();
		const pagePath = Object.keys(chunks).find((path) =>
			chunks[path].names.some((file: string) => file.endsWith('.js'))
		)!;
		const depName: string = chunks[pagePath].names.find((file: string) => file.endsWith('.js'));
		const depPath = Object.keys(chunks).find((path) => path.endsWith(`/${depName}`))!;
		const oldPage = '/_app/immutable/nodes/Renamed0.js';
		const oldDep = '/_app/immutable/chunks/OldDep00.js';
		const old = await caches.open('grim-games-older');
		for (const request of await current.keys()) {
			const path = new URL(request.url).pathname;
			if (path !== pagePath && path !== depPath && path !== '/precache-chunks.json')
				await old.put(request, (await current.match(request))!);
		}
		const text = await (await current.match(pagePath))!.text();
		await old.put(
			oldPage,
			new Response(text.split(`/${depName}`).join('/OldDep00.js'), {
				headers: { 'Content-Type': 'text/javascript' }
			})
		);
		await old.put(oldDep, (await current.match(depPath))!);
		const oldChunks = { ...chunks };
		delete oldChunks[pagePath];
		delete oldChunks[depPath];
		oldChunks[oldPage] = {
			...chunks[pagePath],
			names: chunks[pagePath].names.map((file: string) => (file === depName ? 'OldDep00.js' : file))
		};
		oldChunks[oldDep] = { ...chunks[depPath], shape: 'changed' };
		await old.put('/precache-chunks.json', Response.json(oldChunks));
		await caches.delete(name);
		const runtime = await caches.open('grim-games-runtime-v1');
		await runtime.delete(depPath);
		await runtime.delete(pagePath);
		await runtime.put('/__active-build', new Response('grim-games-older'));
		return { page: pagePath, dependency: depPath };
	}, build);

	const downloaded: string[] = [];
	context.on('request', (request) => {
		if (request.serviceWorker()) downloaded.push(new URL(request.url()).pathname);
	});
	await page.evaluate(async () => {
		const registration = await navigator.serviceWorker.register('/service-worker.js?renamed');
		const next = registration.installing;
		if (!next) throw new Error('no new build found');
		await new Promise<void>((done) =>
			next.addEventListener('statechange', () => next.state === 'installed' && done())
		);
	});

	// The changed file came over the network; the renamed one was rebuilt, byte for byte.
	expect(downloaded).toContain(dependency);
	expect(downloaded).not.toContain(renamed);
	const stored = await page.evaluate(
		async ({ name, path }) => (await (await caches.open(name)).match(path))?.text(),
		{ name: build, path: renamed }
	);
	expect(stored).toBe(await (await request.get(renamed)).text());
});

// Trevor (2026-10-31): opening a game on beta ended in the browser's network error ("The
// FetchEvent … resulted in a network error response"), because the service worker had no
// stored app page and the network failed. A game address now always opens something.
test('a game address opens with no stored app page and no network', async ({ page, context }) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	const build = Object.keys(await cachedPaths(page)).find(
		(name) => name !== 'grim-games-runtime-v1'
	);
	expect(build).toBeDefined();

	// An older build's stored copy is still there: the game opens from it.
	await page.evaluate(async (name) => {
		const older = await caches.open('grim-games-older');
		const current = await caches.open(name);
		for (const request of await current.keys()) {
			const response = await current.match(request);
			if (response) await older.put(request, response);
		}
		await caches.delete(name);
	}, build!);
	await context.setOffline(true);
	await page.goto('/grimoire/no-such-game/setup');
	await expect(page.getByText('There is no saved game here on this device.')).toBeVisible();

	// Nothing stored at all: a page that says so, which opens the app once back online.
	await context.setOffline(false);
	await page.evaluate(async () => {
		for (const name of await caches.keys()) await caches.delete(name);
	});
	await context.setOffline(true);
	await page.goto('/grimoire/no-such-game/setup');
	await expect(page.getByText('This page could not open.')).toBeVisible();
	const retry = page.getByRole('button', { name: 'Try again' });
	await retry.tap();
	await expect(page.getByText('This page could not open.')).toBeVisible();
	await context.setOffline(false);
	await expect(page.getByText('There is no saved game here on this device.')).toBeVisible();
});

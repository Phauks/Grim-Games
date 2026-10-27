import { expect, test, type Page } from '@playwright/test';
import { theMenu } from './shell.ts';

// Trevor (2026-10-16): the update prompt opens a list of what changed since the running build.

/** Pretends a newer build is installed and waiting, as the service worker would report it. */
async function fakeWaitingUpdate(page: Page) {
	await page.addInitScript(() => {
		const worker = { postMessage() {}, addEventListener() {} };
		const registration = {
			waiting: worker,
			active: worker,
			addEventListener() {},
			update: () => Promise.resolve()
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			value: {
				controller: worker,
				ready: Promise.resolve(registration),
				register: () => Promise.resolve(registration),
				addEventListener() {},
				removeEventListener() {}
			}
		});
	});
}

test('the update prompt lists the commits since the running build', async ({ page, request }) => {
	// The running build's own notes; the "new" build adds two commits on top.
	const running = await (await request.get('/build-notes.json')).json();
	const newer = [
		{ sha: 'b'.repeat(40), subject: 'Second new change' },
		{ sha: 'a'.repeat(40), subject: 'First new change' }
	];
	await page.route('**/build-notes.json', (route) =>
		route.fulfill({
			json: { commit: newer[0].sha, commits: [...newer, ...running.commits] }
		})
	);
	await fakeWaitingUpdate(page);
	await page.goto('/');

	const prompt = page.getByTestId('update-banner');
	const toggle = prompt.getByRole('button', { name: 'What changed' });
	await expect(toggle).toBeEnabled();
	await expect(toggle.getByTestId('section-count')).toHaveText('2');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(prompt.getByText('First new change')).toBeHidden();

	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(prompt.getByRole('listitem')).toHaveText([
		/^bbbbbbb\s+Second new change$/,
		/^aaaaaaa\s+First new change$/
	]);
	expect(await prompt.getByRole('link', { name: /^aaaaaaa/ }).getAttribute('href')).toMatch(
		/\/commit\/a{40}$/
	);
	// The card grows upward from its corner; Update stays reachable on screen.
	const after = await prompt.getByRole('button', { name: 'Update' }).boundingBox();
	expect(after!.y + after!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

	await toggle.tap();
	await expect(prompt.getByText('First new change')).toBeHidden();
});

test('with no notes to fetch, What changed stays disabled', async ({ page }) => {
	await page.route('**/build-notes.json', (route) => route.abort());
	await fakeWaitingUpdate(page);
	await page.goto('/');
	const prompt = page.getByTestId('update-banner');
	await expect(prompt.getByRole('button', { name: 'Update' })).toBeVisible();
	await expect(prompt.getByRole('button', { name: 'What changed' })).toBeDisabled();
});

test('a tab left behind by Update in another tab offers to reload', async ({ page }) => {
	// The new build activates for every tab; this one never asked, so it is still on the old build.
	await page.addInitScript(() => {
		const worker = { postMessage() {}, addEventListener() {} };
		const listeners: Array<() => void> = [];
		const registration = {
			waiting: null,
			active: worker,
			addEventListener() {},
			update: () => Promise.resolve()
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			value: {
				controller: worker,
				ready: Promise.resolve(registration),
				register: () => Promise.resolve(registration),
				addEventListener: (type: string, listener: () => void) => {
					if (type === 'controllerchange') listeners.push(listener);
				},
				removeEventListener() {}
			}
		});
		(window as unknown as { controllerListeners: Array<() => void> }).controllerListeners =
			listeners;
	});
	type Fake = { controllerListeners: Array<() => void> };
	await page.goto('/');
	const prompt = page.getByTestId('update-banner');
	await expect
		.poll(() => page.evaluate(() => (window as unknown as Fake).controllerListeners.length))
		.toBe(1);
	await expect(prompt).toBeHidden();

	await page.evaluate(() =>
		(window as unknown as Fake).controllerListeners.forEach((listener) => listener())
	);
	await expect(prompt).toBeVisible();

	const reloaded = page.waitForEvent('load');
	await prompt.getByRole('button', { name: 'Update' }).tap();
	await reloaded;
	await expect(prompt).toBeHidden();
});

// Trevor (2026-10-18): About can check for a new build now; the result shows in place.
/** A service worker with nothing waiting, or with a build waiting when `waiting` is set. */
async function fakeServiceWorker(page: Page, waiting: boolean) {
	await page.addInitScript((waiting) => {
		const worker = { state: 'installed', postMessage() {}, addEventListener() {} };
		const registration = {
			waiting: waiting ? worker : null,
			installing: null,
			active: worker,
			addEventListener() {},
			update: () => Promise.resolve()
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			value: {
				controller: worker,
				ready: Promise.resolve(registration),
				register: () => Promise.resolve(registration),
				getRegistration: () => Promise.resolve(registration),
				addEventListener() {},
				removeEventListener() {}
			}
		});
	}, waiting);
}

/** The About page, opened from the menu (its own page since 2026-10-23). */
async function openAbout(page: Page) {
	await (await theMenu(page)).getByRole('link', { name: 'About', exact: true }).tap();
	await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
	return page.getByRole('main');
}

test('Check for updates in About says Up to date in place', async ({ page }) => {
	await fakeServiceWorker(page, false);
	await page.goto('/');
	const dialog = await openAbout(page);
	const result = dialog.getByTestId('update-check-result');
	const button = dialog.getByRole('button', { name: 'Check for updates' });
	const before = await button.boundingBox();
	await button.tap();
	// When it checked and what it found, on the version's line (Trevor, 2026-10-18).
	await expect(result).toHaveText(/^Checked \d{1,2}:\d{2}.* · Up to date$/);
	expect(await button.boundingBox()).toEqual(before);
	await page.reload();
	await openAbout(page);
	await expect(result).toHaveText(/^Checked \d{1,2}:\d{2}/);
	await expect(page.getByTestId('update-banner')).toHaveCount(0);
});

test('Check for updates brings back the update card after Later', async ({ page }) => {
	await fakeServiceWorker(page, true);
	await page.goto('/');
	const banner = page.getByTestId('update-banner');
	await banner.getByRole('button', { name: 'Later' }).tap();
	await expect(banner).toHaveCount(0);
	const dialog = await openAbout(page);
	await dialog.getByRole('button', { name: 'Check for updates' }).tap();
	await expect(dialog.getByTestId('update-check-result')).toHaveText(/ · Update ready$/);
	await expect(banner).toBeVisible();
});

test('a check that finds a build shows its download, then Update ready', async ({ page }) => {
	// Trevor (2026-10-18): "don't just say checking, give status of download".
	await page.addInitScript(() => {
		const listeners: ((event: MessageEvent) => void)[] = [];
		const stateListeners: (() => void)[] = [];
		const active = { state: 'activated', postMessage() {}, addEventListener() {} };
		const next = {
			state: 'installing',
			postMessage() {},
			addEventListener: (_: string, listener: () => void) => stateListeners.push(listener),
			removeEventListener() {}
		};
		const registration = {
			waiting: null as unknown,
			installing: null as unknown,
			active,
			addEventListener() {},
			update: () => {
				registration.installing = next;
				return Promise.resolve();
			}
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			value: {
				controller: active,
				ready: Promise.resolve(registration),
				register: () => Promise.resolve(registration),
				getRegistration: () => Promise.resolve(registration),
				startMessages() {},
				addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
					if (type === 'message') listeners.push(listener);
				},
				removeEventListener() {}
			}
		});
		// The test drives the new worker: progress messages, then installed.
		Object.assign(window, {
			swProgress: (done: number, total: number, bytes?: number, totalBytes?: number) =>
				listeners.forEach((listener) =>
					listener(
						new MessageEvent('message', {
							data: { type: 'PRECACHE_PROGRESS', done, total, bytes, totalBytes }
						})
					)
				),
			swInstalled: () => {
				next.state = 'installed';
				registration.installing = null;
				registration.waiting = next;
				stateListeners.forEach((listener) => listener());
			}
		});
	});
	await page.goto('/');
	const dialog = await openAbout(page);
	const result = dialog.getByTestId('update-check-result');
	const button = dialog.getByRole('button', { name: 'Check for updates' });
	await button.tap();
	await expect(result).toHaveText('Downloading update…');
	await expect(button).toBeDisabled();
	const box = await result.boundingBox();
	await page.evaluate(() =>
		(window as unknown as { swProgress: (d: number, t: number) => void }).swProgress(2, 5)
	);
	await expect(result).toHaveText('Downloading update… 40%');
	// In place, on the version's line: nothing moves.
	expect((await result.boundingBox())!.y).toBeCloseTo(box!.y, 0);
	// With the build's sizes, the sizes too (Trevor, 2026-10-18: "show size of update as well").
	await page.evaluate(() =>
		(
			window as unknown as { swProgress: (d: number, t: number, b: number, tb: number) => void }
		).swProgress(3, 5, 2_400_000, 6_100_000)
	);
	await expect(result).toHaveText('Downloading update… 2.4 MB of 6.1 MB · 39%');
	expect((await result.boundingBox())!.y).toBeCloseTo(box!.y, 0);
	await page.evaluate(() => (window as unknown as { swInstalled: () => void }).swInstalled());
	await expect(result).toHaveText(/ · Update ready$/);
	await expect(page.getByTestId('update-banner')).toBeVisible();
});

// Trevor (2026-10-19): "If update is already downloading, show this in about instead of
// requiring user to press the check icon".
test('About shows a download the app started by itself, without a check', async ({ page }) => {
	await page.addInitScript(() => {
		const listeners: ((event: MessageEvent) => void)[] = [];
		const stateListeners: (() => void)[] = [];
		const active = { state: 'activated', postMessage() {}, addEventListener() {} };
		// The browser's own update check found a build and is storing it as the page opens.
		const next = {
			state: 'installing',
			postMessage() {},
			addEventListener: (_: string, listener: () => void) => stateListeners.push(listener),
			removeEventListener() {}
		};
		const registration = {
			waiting: null as unknown,
			installing: next as unknown,
			active,
			addEventListener() {},
			update: () => Promise.resolve()
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			value: {
				controller: active,
				ready: Promise.resolve(registration),
				register: () => Promise.resolve(registration),
				getRegistration: () => Promise.resolve(registration),
				startMessages() {},
				addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
					if (type === 'message') listeners.push(listener);
				},
				removeEventListener() {}
			}
		});
		Object.assign(window, {
			swProgress: (done: number, total: number, bytes: number, totalBytes: number) =>
				listeners.forEach((listener) =>
					listener(
						new MessageEvent('message', {
							data: { type: 'PRECACHE_PROGRESS', done, total, bytes, totalBytes }
						})
					)
				),
			swInstalled: () => {
				next.state = 'installed';
				registration.installing = null;
				registration.waiting = next;
				stateListeners.forEach((listener) => listener());
			}
		});
	});
	await page.goto('/');
	const dialog = await openAbout(page);
	const result = dialog.getByTestId('update-check-result');
	await expect(result).toHaveText('Downloading update…');
	await expect(dialog.getByRole('button', { name: 'Check for updates' })).toBeDisabled();
	await page.evaluate(() =>
		(
			window as unknown as { swProgress: (d: number, t: number, b: number, tb: number) => void }
		).swProgress(3, 5, 2_400_000, 6_100_000)
	);
	await expect(result).toHaveText('Downloading update… 2.4 MB of 6.1 MB · 39%');
	await page.evaluate(() => (window as unknown as { swInstalled: () => void }).swInstalled());
	await expect(result).toHaveText(/ · Update ready$/);
	await expect(dialog.getByTestId('update-refresh')).toBeVisible();
});

// Trevor (2026-10-19): "once update has been loaded from about, also add a refresh button there".
test('About offers Update once a build is ready, and it moves onto the new build', async ({
	page
}) => {
	await page.addInitScript(() => {
		const seen: unknown[] = [];
		const listeners: Array<() => void> = [];
		const active = { state: 'activated', postMessage() {}, addEventListener() {} };
		const waiting = {
			state: 'installed',
			postMessage: (message: unknown) => {
				seen.push(message);
				// The new build takes over, as the real worker does after SKIP_WAITING.
				registration.waiting = null;
				listeners.splice(0).forEach((listener) => listener());
			},
			addEventListener() {}
		};
		const registration = {
			waiting: null as unknown,
			installing: null,
			active,
			addEventListener() {},
			update: () => {
				// Only the first page load finds the build; the reload runs it.
				if (!sessionStorage.getItem('refreshed')) registration.waiting = waiting;
				return Promise.resolve();
			}
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			value: {
				controller: active,
				ready: Promise.resolve(registration),
				register: () => Promise.resolve(registration),
				getRegistration: () => Promise.resolve(registration),
				addEventListener: (type: string, listener: () => void) => {
					if (type === 'controllerchange') listeners.push(listener);
				},
				removeEventListener() {}
			}
		});
		(window as unknown as { seen: unknown[] }).seen = seen;
	});
	await page.goto('/');
	const dialog = await openAbout(page);
	const refresh = dialog.getByTestId('update-refresh');
	const check = dialog.getByRole('button', { name: 'Check for updates' });
	await expect(refresh).toHaveCount(0);
	const before = await check.boundingBox();

	await check.tap();
	await expect(dialog.getByTestId('update-check-result')).toHaveText(/ · Update ready$/);
	await expect(refresh).toBeVisible();
	// It shares the version's line, so nothing below moves.
	expect(await check.boundingBox()).toEqual(before);
	expect((await refresh.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	// Trevor (2026-10-25): on a phone it ran off the screen. It stays inside the page's width.
	const box = (await refresh.boundingBox())!;
	expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		page.viewportSize()!.width
	);

	await page.evaluate(() => sessionStorage.setItem('refreshed', '1'));
	const reloaded = page.waitForEvent('load');
	await refresh.tap();
	await reloaded;
	await expect(page.getByTestId('update-banner')).toHaveCount(0);
});

test('About offers Update when the update card already found a build', async ({ page }) => {
	await fakeServiceWorker(page, true);
	await page.goto('/');
	await expect(page.getByTestId('update-banner')).toBeVisible();
	const dialog = await openAbout(page);
	await expect(dialog.getByTestId('update-refresh')).toHaveText('Update');
});

// Trevor (2026-10-19): "we should also proffer the changes there [About], just as we do on the
// main screen. so you don't have to back out to see the changes."
test('About shows what a ready build changed, in a dialog', async ({ page, request }) => {
	const running = await (await request.get('/build-notes.json')).json();
	const newer = [{ sha: 'c'.repeat(40), subject: 'A change worth seeing' }];
	await page.route('**/build-notes.json', (route) =>
		route.fulfill({ json: { commit: newer[0].sha, commits: [...newer, ...running.commits] } })
	);
	await fakeServiceWorker(page, true);
	await page.goto('/');
	const settings = await openAbout(page);
	const whatChanged = settings.getByRole('button', { name: 'What changed', exact: true });
	await expect(whatChanged).toBeEnabled();
	expect((await whatChanged.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await whatChanged.tap();
	const dialog = page.getByRole('dialog', { name: 'What changed' });
	await expect(dialog.getByRole('listitem')).toHaveText([/^ccccccc\s+A change worth seeing$/]);
});

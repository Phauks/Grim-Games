import { expect, test, type Page } from '@playwright/test';

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
	const toggle = prompt.getByRole('button', { name: 'What changed (2)' });
	await expect(toggle).toBeEnabled();
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
	// The card grows upward from its corner; Refresh stays reachable on screen.
	const after = await prompt.getByRole('button', { name: 'Refresh' }).boundingBox();
	expect(after!.y + after!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

	await toggle.tap();
	await expect(prompt.getByText('First new change')).toBeHidden();
});

test('with no notes to fetch, What changed stays disabled', async ({ page }) => {
	await page.route('**/build-notes.json', (route) => route.abort());
	await fakeWaitingUpdate(page);
	await page.goto('/');
	const prompt = page.getByTestId('update-banner');
	await expect(prompt.getByRole('button', { name: 'Refresh' })).toBeVisible();
	await expect(prompt.getByRole('button', { name: 'What changed' })).toBeDisabled();
});

test('a tab left behind by Refresh in another tab offers to reload', async ({ page }) => {
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
	await prompt.getByRole('button', { name: 'Refresh' }).tap();
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

async function openAbout(page: Page) {
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'About' })
		.tap();
	return dialog;
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

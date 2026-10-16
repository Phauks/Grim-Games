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

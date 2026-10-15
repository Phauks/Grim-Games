import { expect, test } from '@playwright/test';

// Player view (09-player-script-view.md): the script, night order, a private seat circle and notes.

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
});

test('the script tab lists characters by type with their abilities', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Townsfolk' })).toBeVisible();
	await expect(page.locator('[data-character]')).toHaveCount(22);
	const empath = page.locator('[data-character="empath"]');
	await expect(empath).toContainText('Each night, you learn how many of your 2 alive neighbors');
	await empath.getByRole('button', { name: /Empath/ }).tap();
	await expect(page.getByRole('dialog', { name: 'Empath' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open wiki entry' })).toHaveAttribute(
		'href',
		/wiki\.bloodontheclocktower\.com\/Empath/
	);
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('no-jinxes')).toHaveText('None');

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('the night order shows who wakes, without Storyteller text', async ({ page }) => {
	await page.getByRole('tab', { name: 'Night', exact: true }).tap();
	const first = page.locator('section[data-night="first"]');
	await expect(first.locator('[data-marker="minioninfo"]')).toBeVisible();
	await expect(first.getByRole('button', { name: /Poisoner/ })).toBeVisible();
	await expect(first).not.toContainText('Wake the Minions');
	const other = page.locator('section[data-night="other"]');
	await expect(other.getByRole('button', { name: /^Imp/ })).toBeVisible();
});

test('the circle keeps names, guesses and deaths on this device', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('8');
	await page.getByRole('button', { name: 'Add a seat' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('9');

	await page.getByRole('button', { name: /^Seat 3/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Seat 3' });
	await expect(sheet).toBeVisible();
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Alex');
	await sheet.getByRole('radio', { name: 'Empath' }).tap();
	await sheet.getByText('Dead', { exact: true }).tap();
	await page.keyboard.press('Escape');

	const seat = page.getByRole('button', { name: /^Seat 3, Alex, guess Empath, dead/ });
	await expect(seat).toBeVisible();
	await expect(page.getByTestId('alive-count')).toHaveText('8 alive');
	await expect(page.getByTestId('storage-note')).toHaveText(/Saved on this device only/);

	// Saved locally: a reload brings it back.
	await page.waitForTimeout(500);
	await page.reload();
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('9');
	await expect(
		page.getByRole('button', { name: /^Seat 3, Alex, guess Empath, dead/ })
	).toBeVisible();
});

test('notes are kept after a reload', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('textbox', { name: 'Notes' }).fill('Sam claimed Chef: 1');
	await page.waitForTimeout(500);
	await page.reload();
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('Sam claimed Chef: 1');
});

test('shows the script chosen on the Scripts page, with its own notebook', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await page.getByRole('button', { name: 'Add a seat' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('9');

	await page.getByRole('link', { name: 'Change script' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await page.getByRole('button', { name: 'Bad Moon Rising' }).tap();
	await expect(page.getByRole('button', { name: 'Bad Moon Rising' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Bad Moon Rising', level: 1 })).toBeVisible();
	await expect(page.locator('[data-character="grandmother"]')).toBeVisible();
	await page.getByRole('tab', { name: 'Circle' }).tap();
	// A new script starts its own circle; Trouble Brewing's is kept.
	await expect(page.getByTestId('seat-count')).toHaveText('8');
});

test('a homebrew character from a loaded script shows as a badge with its ability', async ({
	page
}) => {
	await page.goto('/scripts');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
				'chef',
				{
					id: 'stormwarden',
					name: 'Storm Warden',
					team: 'townsfolk',
					ability: 'Each night, choose a player: they are safe from the Demon tonight.'
				},
				'imp'
			])
		)
	});
	await expect(page.getByTestId('current-script-name')).toHaveText('Storm Front');
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Storm Front', level: 1 })).toBeVisible();
	const row = page.locator('[data-character="stormwarden"]');
	await expect(row.getByRole('button', { name: /Storm Warden/ })).toBeVisible();
	await expect(row).toContainText('safe from the Demon tonight');
});

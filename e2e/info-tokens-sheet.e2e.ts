import { expect, test } from '@playwright/test';

// The info-token sheet the grimoire board opens from its header (Trevor, 2026-10-16).

async function openSheet(page: import('@playwright/test').Page) {
	await page.goto('/spikes/info-tokens');
	await page.getByRole('button', { name: 'Info tokens' }).tap();
	await expect(page.getByRole('button', { name: 'This is the Demon' })).toBeVisible();
}

test('the sheet searches cards and names players on "This is the Demon"', async ({ page }) => {
	await openSheet(page);
	await page.getByRole('searchbox', { name: 'Search info tokens' }).fill('demon');
	await expect(page.getByRole('button', { name: 'Did you vote today?' })).toHaveCount(0);
	await page.getByRole('button', { name: 'This is the Demon' }).tap();

	await page.getByRole('button', { name: 'Sam' }).tap();
	await expect(page.getByRole('button', { name: 'Sam' })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Show' }).tap();

	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('This is the Demon');
	await expect(shown.getByRole('list', { name: 'Players' })).toHaveText('Sam');
	await shown.getByRole('button', { name: 'Close' }).tap();
	// The sheet comes back, at the list, for the next card.
	await expect(page.getByRole('button', { name: 'This is the Demon' })).toBeVisible();
});

test('the sheet shows a character card and a custom card', async ({ page }) => {
	await openSheet(page);
	await page.getByRole('button', { name: 'You are' }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Show' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('img', { name: /Empath token/ })).toBeVisible();
	await shown.getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Add info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **cursed**');
	await page.getByRole('button', { name: 'Save' }).tap();
	await page.getByRole('button', { name: 'You are cursed', exact: true }).tap();
	await expect(shown.locator('strong')).toHaveText('cursed');
	await shown.getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Edit You are cursed' }).tap();
	await page.getByRole('button', { name: 'Delete' }).tap();
	await expect(page.getByRole('button', { name: 'You are cursed', exact: true })).toHaveCount(0);
});

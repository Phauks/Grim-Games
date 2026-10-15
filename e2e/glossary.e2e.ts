import { expect, test, type Page } from '@playwright/test';

/** The Poisoner's card on the Character reference. */
async function poisonerCard(page: Page) {
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Poisoner');
	const card = page.locator('[data-testid="reference-card"][data-character="poisoner"]');
	await expect(card).toBeVisible();
	return card;
}

test('a rules term is a dotted link to the wiki Glossary that keeps its line height', async ({
	page
}) => {
	const card = await poisonerCard(page);
	const term = card.getByRole('link', { name: 'poisoned: open in the wiki Glossary' });
	await expect(term).toBeVisible();
	expect(await term.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe('dotted');
	await expect(term).toHaveAttribute(
		'href',
		/^https:\/\/wiki\.bloodontheclocktower\.com\/Glossary#/
	);
	await expect(term).toHaveAttribute('target', '_blank');
	// The word sits in the line like plain text: no taller than the line around it.
	const box = (await term.boundingBox())!;
	expect(box.height).toBeLessThan(32);
	// Our own definitions are parked (Trevor, 2026-10-15): no popover opens.
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('with "Explain rules terms" off the terms are plain text', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller help' })
		.tap();
	const explain = settings.getByRole('checkbox', { name: 'Explain rules terms' });
	await expect(explain).toBeChecked();
	await settings.getByText('Explain rules terms', { exact: true }).tap();
	await expect(explain).not.toBeChecked();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	const card = await poisonerCard(page);
	await expect(card).toContainText('they are poisoned tonight');
	await expect(card.locator('.glossary-term')).toHaveCount(0);
});

test('terms in the character dialog link to the Glossary', async ({ page }) => {
	await page.goto('/spikes/day');
	await page
		.getByRole('radiogroup', { name: 'Sample game' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	const reminders = page.getByRole('region', { name: 'Today' });
	await reminders
		.getByRole('button', { name: /^Slayer/ })
		.first()
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Slayer' });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole('link', { name: 'once per game: open in the wiki Glossary' })
	).toHaveAttribute('href', /Glossary#/);
});

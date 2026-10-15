import { expect, test, type Page } from '@playwright/test';

/** The Poisoner's card on the Character reference. */
async function poisonerCard(page: Page) {
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Poisoner');
	const card = page.locator('[data-testid="reference-card"][data-character="poisoner"]');
	await expect(card).toBeVisible();
	return card;
}

test('tapping a rules term shows our definition and a Glossary link, without moving the page', async ({
	page
}) => {
	const card = await poisonerCard(page);
	const term = card.getByRole('button', { name: 'poisoned: explain rules term' });
	await expect(term).toBeVisible();
	// A dotted underline, so it is not mistaken for a link.
	expect(await term.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe('dotted');

	// Tap just above the word: the hit area is a full tap target, not only the letters.
	await term.scrollIntoViewIfNeeded();
	const box = (await term.boundingBox())!;
	// The word sits in the line like plain text: no taller than the line around it.
	expect(box.height).toBeLessThan(32);
	const before = await card.boundingBox();
	await page.touchscreen.tap(box.x + box.width / 2, box.y - 8);

	const popover = page.getByRole('dialog', { name: 'Poisoned' });
	await expect(popover).toBeVisible();
	await expect(popover).toContainText('no ability');
	await expect(popover.getByRole('link', { name: 'Open Glossary' })).toHaveAttribute(
		'href',
		/^https:\/\/wiki\.bloodontheclocktower\.com\/Glossary#/
	);
	// An overlay: the card did not reflow.
	expect(await card.boundingBox()).toEqual(before);

	await popover.getByRole('button', { name: 'Close' }).tap();
	await expect(popover).toBeHidden();
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

test('terms in the character dialog open above it', async ({ page }) => {
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
	await dialog.getByRole('button', { name: 'once per game: explain rules term' }).tap();
	const popover = page.getByRole('dialog', { name: 'Once per game' });
	await expect(popover).toBeVisible();
	await expect(popover.getByRole('link', { name: 'Open Glossary' })).toBeVisible();
	// Still usable above the modal dialog: closing it leaves the dialog open.
	await popover.getByRole('button', { name: 'Close' }).tap();
	await expect(popover).toBeHidden();
	await expect(dialog).toBeVisible();
});

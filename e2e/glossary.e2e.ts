import { expect, test, type Page } from '@playwright/test';

/** The Poisoner's card on the Character reference. */
async function poisonerCard(page: Page) {
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Poisoner');
	const card = page.locator('[data-testid="reference-card"][data-character="poisoner"]');
	await expect(card).toBeVisible();
	return card;
}

/** The wiki API, answered with a made-up page so no wiki text is in the repo. */
async function mockWiki(page: Page) {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: { parse: { text: '<p><b>Poisoned:</b> Sample wiki wording for poisoned.</p>' } }
		})
	);
}

test('tapping a rules term shows the wiki Glossary wording and link, without moving the page', async ({
	page
}) => {
	await mockWiki(page);
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
	// The wiki's own wording, fetched live (mocked here with made-up text).
	await expect(popover.getByTestId('wiki-definition')).toHaveText(
		'Sample wiki wording for poisoned.'
	);
	await expect(popover.getByRole('link', { name: 'Open Glossary' })).toHaveAttribute(
		'href',
		/^https:\/\/wiki\.bloodontheclocktower\.com\/Glossary#/
	);
	// An overlay: the card did not reflow.
	expect(await card.boundingBox()).toEqual(before);

	await popover.getByRole('button', { name: 'Close' }).tap();
	await expect(popover).toBeHidden();
});

test('with rules term underlines off the terms are plain text', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Rules terms' })
		.tap();
	const label = 'Underline rules terms with glossary definitions';
	const explain = settings.getByRole('checkbox', { name: label, includeHidden: true });
	await expect(explain).toBeChecked();
	await settings.getByText(label, { exact: true }).tap();
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

test('without the wiki the popover shows only the term and the Glossary link', async ({ page }) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) => route.abort());
	const card = await poisonerCard(page);
	await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
	const popover = page.getByRole('dialog', { name: 'Poisoned' });
	await expect(popover.getByRole('link', { name: 'Open Glossary' })).toBeVisible();
	await expect(popover.getByTestId('wiki-definition')).toHaveCount(0);
});

test('a "see …" link in the wiki wording opens that entry, with Back, and characters are badges', async ({
	page
}) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: {
				parse: {
					text:
						'<p><b>Poisoned:</b> Sample wording, see <a href="/Glossary#Healthy">Healthy</a>' +
						' and the <a href="/Poisoner">Poisoner</a>.</p>' +
						'<p><b>Healthy:</b> Sample wording for healthy.</p>'
				}
			}
		})
	);
	const card = await poisonerCard(page);
	await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
	const popover = page.getByRole('dialog', { name: 'Poisoned' });
	const definition = popover.getByTestId('wiki-definition');
	await expect(definition).toHaveText(/^Sample wording, see Healthy and the\s+Poisoner\s*\.$/);
	await expect(definition.locator('[data-character-id="poisoner"]')).toBeVisible();

	await definition.getByRole('button', { name: 'Healthy' }).tap();
	const healthy = page.getByRole('dialog', { name: 'Healthy' });
	await expect(healthy.getByTestId('wiki-definition')).toHaveText('Sample wording for healthy.');
	await healthy.getByRole('button', { name: 'Back to Poisoned' }).tap();
	await expect(page.getByRole('dialog', { name: 'Poisoned' })).toBeVisible();

	// The character in the definition opens its details with its icon and the wiki button.
	await page
		.getByRole('dialog', { name: 'Poisoned' })
		.locator('[data-character-id="poisoner"]')
		.tap();
	const details = page.getByRole('dialog', { name: 'Poisoner', exact: true });
	const icon = details.locator('.character .icon img');
	await expect(icon).toBeVisible();
	await expect(icon).toHaveAttribute('src', /poisoner_e\.webp$/);
	// The image may still be loading when it first shows: wait for it to decode.
	await expect
		.poll(() => icon.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBeGreaterThan(0);
	await expect(details.getByRole('link', { name: 'Open wiki' })).toBeVisible();
});

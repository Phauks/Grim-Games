import { expect, test } from '@playwright/test';

test('tapping a character badge shows its ability and a wiki link', async ({ page }) => {
	await page.goto('/spikes/badges');
	// CSS locator: the page behind an open dialog is aria-hidden, so role queries can't see it.
	const badge = page.locator('button.badge', { hasText: 'Witch' });
	await expect(badge).toContainText('Sam');
	await expect(badge.locator('img')).toBeVisible();
	// Measure only once the icon and fonts have loaded: a late font swap or image resizes the
	// badge, which made this check flaky under a loaded full-suite run.
	await expect
		.poll(() => badge.locator('img').evaluate((img: HTMLImageElement) => img.complete))
		.toBe(true);
	await page.evaluate(() => document.fonts.ready);
	const before = await badge.boundingBox();

	await badge.tap();
	const dialog = page.getByRole('dialog', { name: 'Witch' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Each night, choose a player');
	await expect(dialog.getByRole('link', { name: 'Open wiki entry' })).toHaveAttribute(
		'href',
		'https://wiki.bloodontheclocktower.com/Witch'
	);
	expect(await badge.boundingBox()).toEqual(before);
});

test('badges are coloured by team', async ({ page }) => {
	await page.goto('/spikes/badges');
	await expect(page.getByRole('button', { name: /Witch/ })).toHaveAttribute('data-team', 'evil');
	await expect(page.getByRole('button', { name: /Saint/ })).toHaveAttribute('data-team', 'good');
	await expect(page.getByRole('button', { name: /Beggar/ })).toHaveAttribute('data-team', 'evil');
});

test('opening a character shows its whole wiki page, fetched live', async ({ page }) => {
	// A made-up page in the wiki's shape, so no wiki text is in the repo.
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) => {
		const title = new URL(route.request().url()).searchParams.get('page');
		route.fulfill({
			json: {
				parse: {
					text:
						`<div class="mw-parser-output"><h2>Summary</h2><p>Sample page for ${title}.</p>` +
						'<h2>How to Run</h2><ul><li>Sample step.</li></ul></div>'
				}
			}
		});
	});
	await page.goto('/spikes/badges');
	await page.locator('button.badge', { hasText: 'Witch' }).first().tap();
	const dialog = page.getByRole('dialog', { name: 'Witch' });
	const wiki = dialog.getByTestId('wiki-page');
	await expect(wiki.getByRole('heading', { name: 'Summary' })).toBeVisible();
	// The name is a badge, whose own markup spacing shows up in the text.
	await expect(wiki).toContainText(/Sample page for\s+Witch\s*\./);
	await expect(wiki.getByRole('heading', { name: 'How to Run' })).toBeVisible();
	await expect(wiki.getByRole('listitem')).toHaveText('Sample step.');
});

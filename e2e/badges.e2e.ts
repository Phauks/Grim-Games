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
	await expect(dialog.getByRole('link', { name: 'Open wiki' })).toHaveAttribute(
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
						'<div class="mw-parser-output"><div class="row"><div class="columns">' +
						'<div id="character-details"><p><span>Information</span></p>' +
						'<table><tr><td>Artist</td><td>Sample Artist</td></tr></table>' +
						'<p class="flavour">"Sample quote."</p><p><span>Appears in</span> <span>Sample episode</span></p></div>' +
						`</div><div class="columns"><h2>Summary</h2><p>Sample page for ${title}.</p>` +
						'<h2>How to Run</h2><ul><li>Sample step.</li></ul>' +
						'<h2>Examples</h2><div class="example"><p>Sample example one.</p></div>' +
						'<div class="example"><p>Sample example two.</p></div>' +
						'<h2>Tips &amp; Tricks</h2><ul><li>Sample tip one.</li></ul><ul><li>Sample tip two.</li></ul>' +
						'</div></div></div>'
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
	// Only the Summary shows; the other sections are in a list beside or under it.
	await expect(dialog).not.toContainText('Sample step.');
	const sections = dialog.getByRole('navigation', { name: 'More from the wiki' });
	const wide = (await dialog.boundingBox())!.width >= 40 * 16;
	await expect(sections.getByRole('button', { name: 'Summary' })).toBeVisible({ visible: wide });

	await sections.getByRole('button', { name: 'How to Run' }).tap();
	const section = dialog.getByTestId('wiki-section');
	await expect(section.getByRole('heading', { name: 'How to Run' })).toBeVisible();
	await expect(section.getByRole('listitem')).toHaveText('Sample step.');
	await expect(dialog.getByTestId('wiki-page')).toHaveCount(0);
	// Two panes on a tablet: the list stays; on a phone the section replaces it, with Back.
	await expect(sections).toBeVisible({ visible: wide });
	if (!wide) {
		await dialog.getByRole('button', { name: 'Summary' }).tap();
		await expect(dialog.getByTestId('wiki-page')).toBeVisible();
	}

	// Introduction: the quote in italics and the artist; no "Information" or "Appears in".
	await sections.getByRole('button', { name: 'Introduction' }).tap();
	await expect(section.locator('.quote')).toHaveText('"Sample quote."');
	await expect(section.locator('.quote')).toHaveCSS('font-style', 'italic');
	await expect(section).toContainText('Artist: Sample Artist');
	await expect(section).not.toContainText('Information');
	await expect(section).not.toContainText('Appears in');
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();

	// Examples are numbered boxes; tips are boxes, not bullets.
	await sections.getByRole('button', { name: 'Examples' }).tap();
	await expect(section.getByRole('heading', { name: 'Example 1' })).toBeVisible();
	await expect(section.getByRole('heading', { name: 'Example 2' })).toBeVisible();
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();
	await sections.getByRole('button', { name: 'Tips & Tricks' }).tap();
	await expect(section.locator('.tip')).toHaveText(['Sample tip one.', 'Sample tip two.']);
	await expect(section.getByRole('listitem')).toHaveCount(0);
});

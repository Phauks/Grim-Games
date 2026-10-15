import { expect, test } from '@playwright/test';

test('the footer links to the character reference', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Reference', exact: true }).tap();
	await expect(page).toHaveURL(/\/reference$/);
	await expect(page.getByRole('heading', { name: 'Character reference' })).toBeVisible();
});

test('searching shows everything the app uses for the Witch', async ({ page }) => {
	await page.goto('/reference');
	await expect(page.getByText(/^\s*181 of 181 characters\s*$/)).toBeVisible();

	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Witch');
	const card = page.locator('[data-testid="reference-card"][data-character="witch"]');
	await expect(card).toBeVisible();
	await expect(card).toContainText('Each night, choose a player');
	await expect(card.getByTestId('no-jinxes')).toBeVisible();
	await expect(card.getByTestId('night-first')).toContainText(/#\d+ on TPI’s sheet/);
	await expect(card.getByTestId('night-other')).toContainText(/#\d+ on TPI’s sheet/);
	await expect(card).toContainText('has chosen');
	await expect(card).toContainText('player with “Cursed”');
	await expect(card.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
		'href',
		/issues\/new\?.*witch/
	);

	// Touch-first: no sideways scrolling at this width.
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('filter chips narrow the list', async ({ page }) => {
	await page.goto('/reference');
	const demons = page.getByRole('button', { name: 'Demons' });
	await demons.tap();
	await expect(demons).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('#group-demon')).toBeVisible();
	await expect(page.locator('#group-townsfolk')).toHaveCount(0);
});

test('the night order runs from Dusk to Dawn', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('tab', { name: 'Night order' }).tap();
	for (const night of ['first', 'other']) {
		const steps = page
			.getByTestId(`night-${night}`)
			.getByRole('list', { name: /until Dawn/ })
			.locator(':scope > li');
		await expect(steps.first()).toHaveAttribute('data-step', 'dusk');
		await expect(steps.last()).toHaveAttribute('data-step', 'dawn');
	}
	await expect(page.getByTestId('night-first').locator('[data-step="minioninfo"]')).toBeVisible();
	await expect(page.getByRole('table')).toContainText('15');
});

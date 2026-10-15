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
	await expect(card.getByTestId('no-jinxes')).toHaveText('None');
	await expect(card.getByTestId('night-first-position')).toHaveText(/^#\d+/);
	await expect(card.getByTestId('night-other-position')).toHaveText(/^#\d+/);
	// TPI's :reminder: markup is drawn as the Witch's own token, coloured as a Minion's.
	const token = card.getByTestId('night-other').getByTestId('reminder-token');
	await expect(token).toHaveText('Cursed');
	await expect(token).toHaveAttribute('data-type', 'minion');
	await expect(card.getByTestId('night-other')).not.toContainText(':reminder:');
	await expect(card).toContainText('has chosen');
	await expect(card).toContainText('player with Cursed');
	await expect(
		card.getByRole('img', { name: /Witch token: wakes on the first night/ })
	).toBeVisible();
	await expect(card).toContainText('Starting alignment Evil');
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

test('the table view is remembered and the night-order table is in night order', async ({
	page
}) => {
	await page.goto('/reference');
	await page.getByText('Table', { exact: true }).tap();
	const table = page.getByTestId('character-table');
	await expect(table).toBeVisible();
	await expect(table.locator('tbody tr')).toHaveCount(181);
	const witch = table.locator('tr[data-character="witch"]');
	await expect(witch).toContainText('Evil');
	await expect(witch).toContainText('Cursed');

	await page.reload();
	await expect(page.getByTestId('character-table')).toBeVisible();

	await page.getByRole('tab', { name: 'Night order' }).tap();
	for (const night of ['first', 'other']) {
		const rows = page.getByTestId(`night-table-${night}`).locator('tbody tr');
		await expect(rows.first()).toHaveAttribute('data-step', 'dusk');
		const positions = await rows
			.locator('td.num')
			.allTextContents()
			.then((all) => all.map((t) => Number(t.replace('#', ''))));
		expect(positions.length).toBeGreaterThan(50);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		// The last step before the after-Dawn announcements is Dawn.
		await expect(rows.locator(':scope:not([data-after-dawn])').last()).toHaveAttribute(
			'data-step',
			'dawn'
		);
	}

	// Tables scroll inside their own box; the page never scrolls sideways.
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('token leaves are drawn inside the token', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Village Idiot');
	const token = page.locator('.token[role="img"]').first();
	await expect(token).toBeVisible();
	const face = await token.locator('circle.face').boundingBox();
	const leaves = token.locator('g.leaf');
	await expect(leaves.first()).toBeAttached();
	expect(face).not.toBeNull();
	for (const leaf of await leaves.all()) {
		const box = await leaf.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(face!.x);
		expect(box!.y).toBeGreaterThanOrEqual(face!.y);
		expect(box!.x + box!.width).toBeLessThanOrEqual(face!.x + face!.width);
		expect(box!.y + box!.height).toBeLessThanOrEqual(face!.y + face!.height);
	}
	await token.screenshot({ path: 'test-results/village-idiot-token.png' });
});

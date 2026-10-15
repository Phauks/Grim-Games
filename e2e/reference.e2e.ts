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

test('the filter chips are gone; the table sorts and filters by column', async ({ page }) => {
	// The full table (181 rows, every field) is rebuilt several times here.
	test.slow();
	await page.goto('/reference');
	await expect(page.getByRole('group', { name: 'Character types' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Demons', exact: true })).toHaveCount(0);

	await page.getByText('Table', { exact: true }).tap();
	const table = page.getByTestId('character-table');
	const rows = table.locator('tbody tr');
	await expect(rows).toHaveCount(181);

	// Sort by first night: positions ascend, characters that do not wake go last.
	await table.getByRole('button', { name: 'First night', exact: true }).tap();
	await expect(table.locator('th[data-col="firstNight"]')).toHaveAttribute(
		'aria-sort',
		'ascending'
	);
	const positions = (
		await rows
			.locator('td[data-col="firstNight"] [data-testid="night-first-position"]')
			.evaluateAll((els) => els.map((el) => el.getAttribute('data-position')))
	)
		.filter((p) => p !== null)
		.map(Number);
	expect(positions.length).toBeGreaterThan(50);
	expect(positions).toEqual([...positions].sort((x, y) => x - y));
	await table.getByRole('button', { name: 'First night', exact: true }).tap();
	await expect(table.locator('th[data-col="firstNight"]')).toHaveAttribute(
		'aria-sort',
		'descending'
	);

	// Filter the type column to Demons.
	await table.locator('td[data-col="type"] button').tap();
	const dialog = page.getByRole('dialog', { name: 'Filter by type' });
	await dialog.getByLabel('Demons').check();
	await dialog.getByRole('button', { name: 'Done' }).tap();
	await expect(page.getByTestId('table-count')).toContainText('1 filter');
	const types = await rows.evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-type')));
	expect(types.length).toBeGreaterThan(0);
	expect(new Set(types)).toEqual(new Set(['demon']));

	// The sort and filters are remembered on this device.
	await page.reload();
	await expect(page.getByTestId('table-count')).toContainText('1 filter');
	await expect(
		page.getByTestId('character-table').locator('th[data-col="firstNight"]')
	).toHaveAttribute('aria-sort', 'descending');

	await page.getByRole('button', { name: 'Clear filters' }).tap();
	await expect(page.getByTestId('character-table').locator('tbody tr')).toHaveCount(181);
	await expect(page.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
});

test('the Witch row shows the same values as the Witch card', async ({ page }) => {
	await page.goto('/reference');
	const card = page.locator('[data-testid="reference-card"][data-character="witch"]');
	await card.scrollIntoViewIfNeeded();
	const fields = [
		'name',
		'type',
		'edition',
		'alignment',
		'setup',
		'ability',
		'tokens',
		'special',
		'firstNight',
		'otherNight',
		'jinxes',
		'preDay',
		'problems',
		'links'
	];
	const read = (scope: typeof card) =>
		scope.evaluate(
			(el, ids) =>
				Object.fromEntries(
					ids.map((id) => [
						id,
						(el.querySelector(`[data-field="${id}"]`)?.textContent ?? '')
							.replace(/\s+/g, ' ')
							.trim()
					])
				),
			fields
		);
	const fromCard = await read(card);
	expect(fromCard.ability).toContain('Each night, choose a player');
	await expect(card.locator('[data-field="icons"] img')).toHaveCount(2);

	await page.getByText('Table', { exact: true }).tap();
	const row = page.getByTestId('character-table').locator('tr[data-character="witch"]');
	await expect(row).toBeVisible();
	expect(await read(row)).toEqual(fromCard);
	await expect(row.locator('[data-field="icons"] img')).toHaveCount(2);
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
		console.log(JSON.stringify(positions));
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

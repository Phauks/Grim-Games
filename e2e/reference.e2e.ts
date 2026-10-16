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
	// Only rows near the screen have their cells built (near.ts), so check those. Phones
	// stack each row into a tall block, so fewer rows are near there.
	expect(positions.length).toBeGreaterThan(3);
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
	// Builds the full table (181 rows); slow on emulated devices when the whole suite runs.
	test.slow();
	await page.goto('/reference');
	const card = page.locator('[data-testid="reference-card"][data-character="witch"]');
	// Card bodies and table rows are built as they come near the screen. Rows above can
	// still grow while they build and push the Witch away, so scroll again until it is built.
	const built = async (scope: typeof card) =>
		expect(async () => {
			await scope.scrollIntoViewIfNeeded();
			await expect(scope.locator('[data-field="ability"]')).toBeAttached({ timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
	await built(card);
	const fields = [
		'name',
		'type',
		'edition',
		'alignment',
		'setup',
		'prep',
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
	await built(row);
	expect(await read(row)).toEqual(fromCard);
	await expect(row.locator('[data-field="icons"] img')).toHaveCount(2);
});

test('each :reminder: shows the token it means, and reviewed night text replaces TPI’s', async ({
	page
}) => {
	await page.goto('/reference');
	const search = page.getByRole('searchbox', { name: 'Search characters' });

	// https://wiki.bloodontheclocktower.com/Pukka: the new target is poisoned; last night's
	// target dies and their Poisoned token comes off.
	await search.fill('Pukka');
	const pukka = page.locator('[data-testid="reference-card"][data-character="pukka"]');
	const tokens = pukka.getByTestId('night-other').getByTestId('reminder-token');
	await expect(tokens).toHaveText(['Poisoned', 'Dead', 'Poisoned']);
	await expect(tokens.nth(2)).toHaveAttribute('title', 'Remove this token');

	// https://wiki.bloodontheclocktower.com/Grandmother: Trevor's reviewed edits.
	await search.fill('Grandmother');
	const grandmother = page.locator('[data-testid="reference-card"][data-character="grandmother"]');
	await expect(grandmother.getByTestId('night-first').getByTestId('reminder-token')).toHaveText(
		'Grandchild'
	);
	await expect(grandmother.getByTestId('night-other').getByTestId('reminder-token')).toHaveText(
		'Dead'
	);
	// The "Differs from source" marker is parked.
	await expect(grandmother.getByTestId('differs-from-source')).toHaveCount(0);
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
	await witch.scrollIntoViewIfNeeded();
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

test('token leaves and the setup flower are drawn inside the token', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Village Idiot');
	const token = page.locator('.token[role="img"]').first();
	await expect(token).toBeVisible();
	const face = await token.locator('circle.face').boundingBox();
	const leaves = token.locator('g.leaf, g.flower');
	await expect(token.locator('g.flower')).toHaveCount(1);
	await expect(token.locator('g.leaf[data-kind="setup"]')).toHaveCount(0);
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

test('the token key explains the leaves and the flower in an overlay', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('button', { name: 'Token key' }).tap();
	const key = page.getByRole('dialog', { name: 'Token key' });
	await expect(key).toContainText('Leaf on the left: wakes on the first night.');
	await expect(key).toContainText('Flower at the bottom right: changes setup.');
	await expect(key.locator('g.flower')).toHaveCount(1);
});

test('cards and rows far below the screen are built only when scrolled near', async ({ page }) => {
	await page.goto('/reference');
	const last = page.locator('[data-testid="reference-card"]').last();
	await expect(last).toBeAttached();
	await expect(last.locator('[data-row]')).toHaveCount(0);
	await last.scrollIntoViewIfNeeded();
	await expect(last.locator('[data-row]').first()).toBeVisible();
});

test('character names are game badges and reminders are smaller token chips', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Witch');
	const card = page.locator('[data-testid="reference-card"][data-character="witch"]');
	// The card's title is the game's own badge, not a separate heading.
	await expect(card.locator('[data-field="name"] button.badge')).toHaveAttribute(
		'data-team',
		'evil'
	);
	const night = card.getByTestId('night-other');
	// "The Witch chooses a player." draws the Witch as a badge inside the sentence.
	const badge = night.locator('button.badge[data-character-id="witch"]');
	await expect(badge).toBeVisible();
	const chip = night.getByTestId('reminder-token');
	await expect(chip).toHaveText('Cursed');
	const badgeBox = (await badge.boundingBox())!;
	const chipBox = (await chip.boundingBox())!;
	expect(chipBox.height).toBeLessThan(badgeBox.height);
	// Different shapes: the badge is a pill, the chip a squarer token.
	const radius = (el: typeof badge) =>
		el.evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
	expect(await radius(chip)).toBeLessThan(await radius(badge));
});

test('prep steps show tokens as reminder chips', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Fortune Teller');
	const card = page.locator('[data-testid="reference-card"][data-character="fortuneteller"]');
	const prep = card.locator('[data-field="prep"]');
	await expect(prep).toContainText('Choose a good player as the');
	await expect(prep.getByTestId('reminder-token')).toHaveText('Red Herring');
	await expect(prep).not.toContainText('[');
});

test('on a phone the tables stack into labelled rows instead of scrolling sideways', async ({
	page
}) => {
	test.skip(test.info().project.name !== 'phone', 'phones stack; wider screens keep the table');
	await page.goto('/reference');
	await page.getByText('Table', { exact: true }).tap();
	const table = page.getByTestId('character-table');
	const witch = table.locator('tr[data-character="witch"]');
	await witch.scrollIntoViewIfNeeded();
	await expect(witch.locator('td[data-col="ability"]')).toHaveAttribute('data-label', 'Ability');
	await expect(witch.locator('td[data-col="ability"] .cell')).not.toBeEmpty({ timeout: 15_000 });
	const sideways = (selector: string) =>
		page.evaluate(
			(s) => [...document.querySelectorAll(s)].some((el) => el.scrollWidth > el.clientWidth + 1),
			selector
		);
	expect(await sideways('.scroll')).toBe(false);
	await page.getByRole('tab', { name: 'Night order' }).tap();
	await expect(page.getByTestId('night-table-first')).toBeVisible();
	expect(await sideways('.scroll')).toBe(false);
});

test('"/" jumps to the search field and Esc clears it', async ({ page }) => {
	await page.goto('/reference');
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await expect(page.getByText(/^\d+ of \d+ characters$/)).toBeVisible();
	await page.locator('h1').click();
	await page.keyboard.press('/');
	await expect(search).toBeFocused();
	await expect(search).toHaveValue('');
	await page.keyboard.type('witch');
	await expect(search).toHaveValue('witch');
	await page.keyboard.press('Escape');
	await expect(search).toHaveValue('');
	await expect(search).toBeFocused();
});

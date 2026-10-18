import { expect, test } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';

test('the menu opens the character reference; the footer no longer links it', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Reference' })).toHaveCount(
		0
	);
	await page.getByRole('banner').getByRole('button', { name: 'Menu', exact: true }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('link', { name: 'Character reference' })
		.tap();
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
	await expect(card.getByTestId('night-first-position')).toHaveText(/^Step \d+/);
	await expect(card.getByTestId('night-other-position')).toHaveText(/^Step \d+/);
	// TPI's :reminder: markup is drawn as the Witch's own token, coloured as a Minion's.
	const token = card.getByTestId('night-other').getByTestId('reminder-token');
	await expect(token).toHaveText('Cursed');
	await expect(token).toHaveAttribute('data-type', 'minion');
	// Its owner's icon sits on the token, so it reads as the Witch's (Trevor, 2026-10-17).
	await expect(token.locator('img.owner')).toHaveAttribute('src', /witch/i);
	// Level with the words around it, not sitting high (Trevor, 2026-10-18).
	const offset = await token.evaluate((chip) => {
		// A letter in the sentence's own font, just after the chip.
		const probe = document.createElement('span');
		probe.textContent = 'x';
		chip.after(probe);
		const text = probe.getBoundingClientRect();
		probe.remove();
		const box = chip.getBoundingClientRect();
		return Math.abs(box.top + box.height / 2 - (text.top + text.height / 2)) / text.height;
	});
	expect(offset).toBeLessThan(0.15);
	await expect(card.getByTestId('night-other')).not.toContainText(':reminder:');
	await expect(card).toContainText('has chosen');
	await expect(card).toContainText('player with Cursed');
	await expect(
		card.getByRole('img', { name: /Witch token: wakes on the first night/ })
	).toBeVisible();
	await expect(card).toContainText('Starting alignment Evil');
	// Report a problem opens the in-app form as a rules report about this character.
	await card.getByRole('button', { name: 'Report a problem' }).tap();
	const form = page.getByRole('dialog', { name: 'Report' });
	await expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue('Witch: ');
	await expect(form.getByRole('combobox', { name: 'Kind' })).toContainText(
		'Rules or character error'
	);
	await form.getByRole('button', { name: 'Cancel' }).tap();

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

	await page.getByRole('button', { name: 'Show as table' }).tap();
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
	// Filters sit in the header row: the funnel beside a column's name opens its choices.
	await table.getByRole('button', { name: 'Filter Type', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Filter Type' });
	await dialog.getByLabel('Demons').check();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(table.getByRole('button', { name: 'Filter Type (set)' })).toBeVisible();
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

	await page.getByRole('button', { name: 'Show as table' }).tap();
	const row = page.getByTestId('character-table').locator('tr[data-character="witch"]');
	await built(row);
	expect(await read(row)).toEqual(fromCard);
	// The table shows the token (with its icon), not the icon pair (Trevor, 2026-10-16).
	await expect(row.locator('[data-field="token"] .token')).toBeVisible();
	await expect(row.locator('[data-field="icons"]')).toHaveCount(0);
	await expect(
		page.getByTestId('character-table').getByRole('columnheader', { name: /Icons/ })
	).toHaveCount(0);
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

test('Info cards lists the info cards a character brings, or None', async ({ page }) => {
	await page.goto('/reference');
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('Mezepheles');
	const card = page.locator('[data-testid="reference-card"][data-character="mezepheles"]');
	await expect(card.locator('[data-field="cards"]')).toContainText('Your Secret Word is');
	await search.fill('Washerwoman');
	const washerwoman = page.locator('[data-testid="reference-card"][data-character="washerwoman"]');
	await expect(washerwoman.locator('[data-field="cards"]')).toContainText('None');
	await page.getByRole('button', { name: 'Show as table' }).tap();
	await search.fill('Mezepheles');
	await expect(
		page
			.getByTestId('character-table')
			.locator('tr[data-character="mezepheles"] [data-field="cards"]')
	).toHaveText('Your Secret Word is');
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
	await page.getByRole('button', { name: 'Show as table' }).tap();
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

test('token leaves are drawn inside the token, with no setup flower', async ({ page }) => {
	// Trevor (2026-10-18): the setup change is shown inside the Reference, not as a flower.
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Village Idiot');
	const token = page.locator('.token[role="img"]').first();
	await expect(token).toBeVisible();
	const face = await token.locator('circle.face').boundingBox();
	const leaves = token.locator('g.leaf');
	await expect(token.locator('g.flower')).toHaveCount(0);
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

test('the Reference has no token key (Trevor, 2026-10-18)', async ({ page }) => {
	await page.goto('/reference');
	await expect(page.getByRole('searchbox', { name: 'Search characters' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Token key' })).toHaveCount(0);
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
	await page.getByRole('button', { name: 'Show as table' }).tap();
	const table = page.getByTestId('character-table');
	const witch = table.locator('tr[data-character="witch"]');
	await witch.scrollIntoViewIfNeeded();
	await expect(witch.locator('td[data-col="ability"]')).toHaveAttribute('data-label', 'Ability');
	await expect(witch.locator('td[data-col="ability"] .cell')).not.toBeEmpty({ timeout: 15_000 });
	// Sideways scrolling: a box that can scroll (overflow auto or scroll) and is wider than it
	// shows, or the page itself. A clipped box can't scroll, whatever its scrollWidth says
	// (tap areas drawn past a word at the end of a line count there).
	const sideways = (selector: string) =>
		page.evaluate((s) => {
			const scrolls = (el: Element) =>
				['auto', 'scroll'].includes(getComputedStyle(el).overflowX) &&
				el.scrollWidth > el.clientWidth + 1;
			const root = document.documentElement;
			return (
				root.scrollWidth > root.clientWidth + 1 || [...document.querySelectorAll(s)].some(scrolls)
			);
		}, selector);
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

test('on a wide screen a card is long, with its fields side by side', async ({ page }) => {
	// Trevor (2026-10-16): "on desktop, my preference is longer".
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Steward');
	const card = page.locator('[data-testid="reference-card"][data-character="steward"]');
	const setup = (await card.locator('[data-row="setup"]').boundingBox())!;
	const alignment = (await card.locator('[data-row="alignment"]').boundingBox())!;
	const ability = (await card.locator('[data-row="ability"]').boundingBox())!;
	expect(Math.abs(setup.y - alignment.y)).toBeLessThan(2);
	expect(setup.x).toBeGreaterThan(alignment.x + alignment.width - 1);
	expect(ability.y).toBeLessThan(alignment.y);
});

test('each character type folds under its caret, a search opens it, and it stays folded', async ({
	page
}) => {
	// Trevor (2026-10-16): "make character types carrot menus in reference".
	await page.goto('/reference');
	const townsfolk = page.getByRole('button', { name: 'Townsfolk', exact: true });
	const steward = page.locator('[data-testid="reference-card"][data-character="steward"]');
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'true');
	await expect(steward).toBeVisible();
	await townsfolk.tap();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
	await expect(steward).toBeHidden();
	await expect(page.getByRole('button', { name: 'Minions', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true'
	);

	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('Steward');
	await expect(steward).toBeVisible();
	await search.fill('');
	await expect(steward).toBeHidden();

	await page.reload();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
});

test('jinxes start folded on cards and in the table; Wiki and Report sit by the name', async ({
	page
}) => {
	// Trevor (2026-10-16): "start jinxes collapsed for table and card view"; "move report and
	// wiki to under the name in table, or the top of the card".
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Alchemist');
	const card = page.locator('[data-testid="reference-card"][data-character="alchemist"]');
	const toggle = card.getByTestId('jinx-toggle');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(toggle).toHaveText(/^\d+ jinxes$/);
	await expect(card.locator('.jinx')).toHaveCount(0);
	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(card.locator('.jinx').first()).toBeVisible();
	await expect(card.locator('header').getByRole('link', { name: 'Wiki' })).toBeVisible();
	await expect(
		card.locator('header').getByRole('button', { name: 'Report a problem' })
	).toBeVisible();

	await page.getByRole('button', { name: 'Show as table' }).tap();
	const row = page.getByTestId('character-table').locator('tr[data-character="alchemist"]');
	await expect(row.getByTestId('jinx-toggle')).toHaveAttribute('aria-expanded', 'false');
	const name = row.locator('[data-field="name"]');
	await expect(name.getByRole('link', { name: 'Wiki' })).toBeVisible();
	await expect(name.getByRole('button', { name: 'Report a problem' })).toBeVisible();
	await expect(
		page.getByTestId('character-table').getByRole('columnheader', { name: /Links/ })
	).toHaveCount(0);
});

test('reminder tokens show their copies and whether setup places them; the table filters by it', async ({
	page
}) => {
	// Trevor (2026-10-17): "Designate tokens as setup tokens or not setup on the reference".
	await page.goto('/reference');
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('No Dashii');
	const tokens = page
		.locator('[data-testid="reference-card"][data-character="nodashii"]')
		.locator('[data-row="tokens"]')
		.getByTestId('reminder-token');
	// TPI lists Poisoned twice; setup poisons both of its Townsfolk neighbours.
	await expect(tokens).toHaveText(['Dead', 'Poisoned×2']);
	// Beside each chip: when it goes down, and who it may go on (Trevor, 2026-10-18), read from
	// the board's own placement rules. The chips carry the No Dashii's icon, not a setup flower.
	const rowsOf = (id: string) =>
		page
			.locator(`[data-testid="reference-card"][data-character="${id}"]`)
			.locator('[data-row="tokens"] .token-row');
	await expect(rowsOf('nodashii')).toHaveText([
		'DeadGoes on: Any player',
		'Poisoned×2Placed at setup · Goes on: Townsfolk, nearest each side'
	]);
	await expect(tokens.first().locator('img')).toHaveAttribute('src', /nodashii/);

	await search.fill('Washerwoman');
	await expect(rowsOf('washerwoman')).toHaveText([
		'TownsfolkPlaced at setup · Goes on: Townsfolk, not self',
		'WrongPlaced at setup · Goes on: Players, not with Townsfolk'
	]);

	await search.fill('');
	await page.getByRole('button', { name: 'Show as table' }).tap();
	const table = page.getByTestId('character-table');
	await table.getByRole('button', { name: 'Filter Tokens', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Filter Tokens' });
	await dialog.getByLabel('No setup tokens').check();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(table.locator('tr[data-character="imp"]')).toHaveCount(1);
	await expect(table.locator('tr[data-character="nodashii"]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Clear filters' }).tap();
});

test('the table filters characters by edition', async ({ page }) => {
	// Trevor (2026-10-18): "allow filtering by edition".
	await page.goto('/reference');
	await page.getByRole('button', { name: 'Show as table' }).tap();
	const table = page.getByTestId('character-table');
	await table.getByRole('button', { name: 'Filter Edition', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Filter Edition' });
	await dialog.getByLabel('Trouble Brewing').check();
	await dialog.getByLabel('Bad Moon Rising').check();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(table.getByRole('button', { name: 'Filter Edition (set)' })).toBeVisible();
	await expect(page.getByTestId('table-count')).toContainText('1 filter');
	await expect(table.locator('tr[data-character="imp"]')).toHaveCount(1);
	await expect(table.locator('tr[data-character="zombuul"]')).toHaveCount(1);
	await expect(table.locator('tr[data-character="vortox"]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Clear filters' }).tap();
	await expect(table.locator('tr[data-character="vortox"]')).toHaveCount(1);
});

test('the table toggle sits on the search line on both tabs', async ({ page }) => {
	// Trevor (2026-10-18): "put table/cards in the same line as the search".
	await page.goto('/reference');
	const toggle = page.getByRole('button', { name: 'Show as table' });
	const sameLine = async (field: ReturnType<typeof page.getByRole>) => {
		const a = (await field.boundingBox())!;
		const b = (await toggle.boundingBox())!;
		expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(a.height / 2);
		expect(b.x).toBeGreaterThan(a.x);
	};
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await sameLine(page.getByRole('searchbox', { name: 'Search characters' }));
	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('character-table')).toBeVisible();
	await sameLine(page.getByRole('searchbox', { name: 'Search characters' }));

	await page.getByRole('tab', { name: 'Night order' }).tap();
	await sameLine(page.getByRole('searchbox', { name: 'Filter night steps' }));
	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await sameLine(page.getByRole('searchbox', { name: 'Filter night steps' }));
});

import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { menuButton } from './shell.ts';

/** A character's row in the Character Lab's table (plan M47). */
const rowOf = (page: Page, id: string) =>
	page.getByTestId('character-table').locator(`tr[data-character="${id}"]`);

/**
 * Selects a character through its link (#witch, from a bug report): nothing is listed until
 * one is (Trevor, 2026-11-04: "do not list all on the left side when none are selected").
 */
async function select(page: Page, id: string) {
	await page.goto('about:blank');
	await page.goto(`/reference#${id}`);
	await expect(rowOf(page, id)).toBeAttached();
}

test('the menu opens the character reference', async ({ page }) => {
	await page.goto('/');
	await menuButton(page).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('link', { name: 'Characters' })
		.tap();
	await expect(page).toHaveURL(/\/reference$/);
	await expect(
		page.getByRole('heading', { name: 'Characters', level: 1, exact: true })
	).toBeVisible();
});

test('a selected Witch shows everything the app uses for it', async ({ page }) => {
	await select(page, 'witch');
	const card = rowOf(page, 'witch');
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
	await expect(card.locator('[data-field="alignment"]')).toHaveText('Evil');
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

test('the Witch row shows every field, with its icons and flavour text', async ({ page }) => {
	// Trevor (2026-10-19): "remove card mode ... verify we include all relevant info in the
	// table". One cell per field (fields.ts); coverage.test.ts maps the data to them.
	await select(page, 'witch');
	const row = rowOf(page, 'witch');
	await expect(row.locator('[data-field="ability"]')).toContainText('Each night, choose a player');
	for (const field of [
		'token',
		'name',
		'type',
		'edition',
		'icons',
		'alignment',
		'setup',
		'prep',
		'ability',
		'flavor',
		'tokens',
		'special',
		'cards',
		'firstNight',
		'otherNight',
		'jinxes',
		'preDay',
		'problems'
	]) {
		await expect(row.locator(`[data-field="${field}"]`), field).toHaveCount(1);
	}
	// The good and evil icons; the token shows only one.
	await expect(row.locator('[data-field="icons"] img')).toHaveCount(2);
	await expect(row.locator('[data-field="flavor"] q')).not.toBeEmpty();
	await expect(
		page.getByTestId('character-table').getByRole('columnheader', { name: /Links/ })
	).toHaveCount(0);
});

test('there is no card view', async ({ page }) => {
	await select(page, 'witch');
	await expect(page.getByTestId('character-table')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show as table' })).toHaveCount(0);
	await expect(page.getByTestId('reference-card')).toHaveCount(0);
});

test('a link to one character scrolls to its row', async ({ page }) => {
	await page.goto('/reference#witch');
	await expect(rowOf(page, 'witch')).toBeInViewport();
});

test('each :reminder: shows the token it means, and reviewed night text replaces TPI’s', async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Pukka: the new target is poisoned; last night's
	// target dies and their Poisoned token comes off.
	await select(page, 'pukka');
	const pukka = rowOf(page, 'pukka');
	const tokens = pukka.getByTestId('night-other').getByTestId('reminder-token');
	await expect(tokens).toHaveText(['Poisoned', 'Dead', 'Poisoned']);
	await expect(tokens.nth(2)).toHaveAttribute('title', 'Remove this token');

	// https://wiki.bloodontheclocktower.com/Grandmother: Trevor's reviewed edits.
	await select(page, 'grandmother');
	const grandmother = rowOf(page, 'grandmother');
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
	await select(page, 'mezepheles');
	const card = rowOf(page, 'mezepheles');
	await expect(card.locator('[data-field="cards"]')).toContainText('Your Secret Word is');
	await select(page, 'washerwoman');
	const washerwoman = rowOf(page, 'washerwoman');
	await expect(washerwoman.locator('[data-field="cards"]')).toContainText('None');
});

test('token leaves are drawn inside the token, with no setup flower', async ({ page }) => {
	// Trevor (2026-10-18): the setup change is shown inside the Reference, not as a flower.
	await select(page, 'villageidiot');
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
	await select(page, 'witch');
	await expect(page.getByRole('button', { name: 'Token key' })).toHaveCount(0);
});

test('rows far below the screen are built only when scrolled near', async ({ page }) => {
	// Every character: one selected, with the jinx filter off.
	await select(page, 'philosopher');
	await page.getByText('Jinxed with locked', { exact: true }).tap();
	await expect(page.getByTestId('character-table').locator('tbody tr')).toHaveCount(181);
	const last = page.getByTestId('character-table').locator('tbody tr').last();
	await expect(last).toBeAttached();
	await expect(last.locator('td')).toHaveCount(0);
	await last.scrollIntoViewIfNeeded();
	await expect(last.locator('td').first()).toBeVisible();
});

test('characters in night text are game badges and reminders are smaller token chips', async ({
	page
}) => {
	await select(page, 'witch');
	const card = rowOf(page, 'witch');
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
	await select(page, 'fortuneteller');
	const card = rowOf(page, 'fortuneteller');
	const prep = card.locator('[data-field="prep"]');
	await expect(prep).toContainText('Choose a good player as the');
	await expect(prep.getByTestId('reminder-token')).toHaveText('Red Herring');
	await expect(prep).not.toContainText('[');
});

test('on a phone the tables stack into labelled rows instead of scrolling sideways', async ({
	page
}) => {
	test.skip(test.info().project.name !== 'phone', 'phones stack; wider screens keep the table');
	await select(page, 'witch');
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
});

test('jinxes start folded; Wiki and Report sit under the name', async ({ page }) => {
	// Trevor (2026-10-16): "start jinxes collapsed"; "move report and wiki to under the name in
	// table".
	await select(page, 'alchemist');
	const row = rowOf(page, 'alchemist');
	const toggle = row.locator('[data-field="jinxes"]').getByRole('button', { name: 'Jinxes' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(toggle.getByTestId('section-count')).toHaveText(/^\d+$/);
	await expect(row.locator('.jinx').first()).toBeHidden();
	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(row.locator('.jinx').first()).toBeVisible();
	const name = row.locator('[data-field="name"]');
	await expect(name.getByRole('link', { name: 'Wiki' })).toBeVisible();
	await expect(name.getByRole('button', { name: 'Report a problem' })).toBeVisible();
});

test('reminder tokens show their copies and whether setup places them', async ({ page }) => {
	// Trevor (2026-10-17): "Designate tokens as setup tokens or not setup on the reference".
	await select(page, 'nodashii');
	const tokens = rowOf(page, 'nodashii')
		.locator('[data-field="tokens"]')
		.getByTestId('board-reminder');
	// TPI lists Poisoned twice; setup poisons both of its Townsfolk neighbours. Round tokens,
	// as on the board (Trevor, 2026-10-30), the count beside them.
	await expect(tokens).toHaveText(['Dead', 'Poisoned']);
	// Beside each chip: when it goes down, and who it may go on (Trevor, 2026-10-18), read from
	// the board's own placement rules. The chips carry the No Dashii's icon, not a setup flower.
	const rowsOf = (id: string) => rowOf(page, id).locator('[data-field="tokens"] .token-row');
	await expect(rowsOf('nodashii')).toHaveText([
		'DeadGoes on: Any player',
		'Poisoned×2Placed at setup · Goes on: Townsfolk, nearest each side'
	]);
	await expect(tokens.first().locator('img')).toHaveAttribute('src', /nodashii/);
	// Stacked rows are told apart by a line between them, not spacing alone (Trevor).
	await expect(rowsOf('nodashii').first()).toHaveCSS('border-top-width', '0px');
	await expect(rowsOf('nodashii').nth(1)).not.toHaveCSS('border-top-width', '0px');

	await select(page, 'washerwoman');
	await expect(rowsOf('washerwoman')).toHaveText([
		'TownsfolkPlaced at setup · Goes on: Townsfolk',
		'WrongPlaced at setup · Goes on: Players, not with Townsfolk'
	]);
});

test('the title row has no search, count or Clear filters', async ({ page }) => {
	// Trevor (2026-11-04): "remove all those useless table controls ... remove x at top right".
	await page.goto('/reference');
	const header = page.locator('main header');
	await expect(header.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(header.getByRole('searchbox')).toHaveCount(0);
	await expect(page.getByTestId('table-count')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
});

test('Traveller reminders are split blue and red', async ({ page }) => {
	// Trevor (2026-10-18): "Assign travellers with their proper red/blue color".
	await select(page, 'bureaucrat');
	const token = (name: string) =>
		page.evaluate(
			(n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
			name
		);
	const rgb = (hex: string) =>
		`rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
	const chip = rowOf(page, 'bureaucrat')
		.locator('[data-field="tokens"]')
		.getByTestId('board-reminder')
		.first();
	const background = await chip.evaluate((e) => getComputedStyle(e).backgroundImage);
	expect(background).toContain(rgb(await token('--good')));
	expect(background).toContain(rgb(await token('--evil')));
	await chip.screenshot({ path: 'test-results/traveller-reminder.png' });
});

test('tapping a token opens that character', async ({ page }) => {
	// Trevor (2026-10-19): "in character reference, allow clicking token icon in order to open
	// glossary".
	await select(page, 'washerwoman');
	await rowOf(page, 'washerwoman').getByRole('button', { name: 'About the Washerwoman' }).tap();
	await expect(page.getByRole('dialog', { name: 'Washerwoman' })).toBeVisible();
});

test('All data shows everything the app reads about a character, by file', async ({ page }) => {
	// Trevor (2026-10-28): "a button to show all information our app would use to use the
	// character".
	await select(page, 'washerwoman');
	const row = rowOf(page, 'washerwoman');
	await row.locator('[data-field="name"]').getByRole('button', { name: 'All data' }).tap();
	const dialog = page.getByRole('dialog').filter({ hasText: ': all data' });
	await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/Washerwoman\s*: all data/);
	const data = dialog.getByTestId('character-data');
	await expect(data.locator('section[data-part]')).toHaveCount(6);
	const rules = data.locator('section[data-part="rules"]');
	await expect(rules).toContainText('src/lib/core/data/rules/washerwoman.json');
	await expect(rules.locator('[data-key="setupPrep"] dt').first()).toHaveText('Setup prep');
	await expect(data.locator('section[data-part="character"]')).toContainText(
		'You start knowing that 1 of 2 players is a particular Townsfolk.'
	);
	await expect(data.locator('section[data-part="jinxes"] .value')).toHaveText('None');

	// The raw JSON starts closed, with Copy and Download in its header.
	await expect(dialog.getByTestId('character-data-file')).toBeHidden();
	await dialog.getByRole('button', { name: 'All data as one file' }).tap();
	const file = dialog.getByTestId('character-data-file');
	await expect(file).toContainText('washerwoman-data.json');
	await expect(file).toContainText('"reminderTargets"');
	await expect(file.getByRole('button', { name: 'Copy all data' })).toBeVisible();
	const download = page.waitForEvent('download');
	await file.getByRole('button', { name: 'Download all data' }).tap();
	expect((await download).suggestedFilename()).toBe('washerwoman-data.json');

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

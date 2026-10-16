import { expect, test, type Page } from '@playwright/test';

// Character selection, the bag and the draw (ROADMAP Phase 2 Setup).

/** Starts a Trouble Brewing game with `players` seats and opens its character selection. */
async function selectionFor(page: Page, players: number) {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	for (let n = 8; n > players; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	await expect(page.getByTestId('player-count')).toHaveText(String(players));
}

test('the setup table is shown and follows the player count', async ({ page }) => {
	await selectionFor(page, 6);
	const table = page.getByTestId('setup-table');
	await expect(table).toBeVisible();
	const current = table.locator('thead [data-current]');
	await expect(current).toHaveText('6');
	await expect(table.locator('tbody [data-current]')).toHaveText(['3', '1', '1', '1']);
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(current).toHaveText('7');
	await expect(table.locator('tbody [data-current]')).toHaveText(['5', '0', '1', '1']);
});

test('setup is one flow of two steps with the same bar on each', async ({ page }) => {
	await selectionFor(page, 5);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	const steps = page.getByRole('navigation', { name: 'Setup steps' });
	await expect(steps.locator('[aria-current="step"]')).toHaveText(/Characters/);
	await expect(steps.getByRole('listitem')).toHaveCount(2);
	// The bar: Back on the left, the step's main action on the right.
	const bar = page.getByRole('navigation', { name: 'Setup', exact: true });
	const barButtons = async () => {
		const [back, next] = await Promise.all([
			bar.getByRole('link').first().boundingBox(),
			bar.locator('a, button').last().boundingBox()
		]);
		expect(back!.x).toBeLessThan(next!.x);
		return { back, next };
	};
	await expect(bar.getByRole('link', { name: 'Grimoire' })).toBeVisible();
	await expect(bar.getByRole('button', { name: 'Build bag' })).toBeVisible();
	const onCharacters = await barButtons();
	// No bag yet, so the Draw step can't be opened.
	await expect(steps.getByRole('link', { name: 'Draw' })).toHaveCount(0);

	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await expect(steps.locator('[aria-current="step"]')).toHaveText(/Draw/);
	await expect(bar.getByRole('link', { name: 'Characters' })).toBeVisible();
	await expect(bar.getByRole('link', { name: 'Grimoire' })).toBeVisible();
	// Same place on both steps.
	const onDraw = await barButtons();
	expect(Math.abs(onDraw.back!.y - onCharacters.back!.y)).toBeLessThan(2);
	expect(
		Math.abs(
			onDraw.next!.x + onDraw.next!.width - (onCharacters.next!.x + onCharacters.next!.width)
		)
	).toBeLessThan(2);
	await steps.getByRole('link', { name: 'Characters' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	await steps.getByRole('link', { name: 'Draw' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);

	// Once the draw has started, the steps and the way back stay on screen.
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('reveal')).toBeHidden();
	await expect(steps.locator('[aria-current="step"]')).toHaveText(/Draw/);
	await expect(page.getByText(/\d+ left|Enter draws/)).toHaveCount(0);
	await steps.getByRole('link', { name: 'Characters' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	// Going back changes nothing; building again says what happens to the drawn tile.
	await page.getByRole('button', { name: 'Build bag' }).tap();
	const replace = page.getByRole('alertdialog', { name: 'Replace the bag?' });
	await expect(replace).toContainText('Now: 1 of 5 tiles drawn.');
	await replace.getByRole('button', { name: 'Keep' }).tap();
	await steps.getByRole('link', { name: 'Draw' }).tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(1);

	// Finishing goes to the board, which opens its setup reminders.
	await bar.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page).toHaveURL(new RegExp(`${board}(#setup-reminders)?$`));
});

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

async function select(page: Page, ...names: string[]) {
	for (const name of names) await choice(page, name).tap();
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('selection counts against the setup sheet and explains the Drunk', async ({ page }) => {
	await selectionFor(page, 6);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Drunk');
	// Adding the Drunk asks which Townsfolk goes in the bag for it; nothing is picked for you.
	const ask = page.getByRole('dialog', { name: 'What is the Drunk shown?' });
	await expect(ask).toBeVisible();
	await expect(ask.getByRole('button', { name: 'Empath', exact: true })).toHaveCount(0);
	await ask.getByRole('button', { name: 'Decide later' }).tap();
	const check = page.getByTestId('setup-check');
	await expect(check.getByTestId('stand-in-drunk')).toContainText('Choose');
	await check.getByRole('button', { name: 'Shown to the Drunk' }).tap();
	await ask.getByRole('button', { name: 'Chef', exact: true }).tap();
	await expect(check.getByTestId('stand-in-drunk')).toContainText('Chef');
	await select(page, 'Poisoner', 'Imp');
	await expect(choice(page, 'Drunk')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('3');
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('warning-count')).toHaveText('0');
	await noSidewaysScroll(page);

	// A Baron needs two more Outsiders: the counts and the check say so, but nothing blocks.
	await select(page, 'Baron');
	await expect(page.getByTestId('warning-count')).not.toHaveText('0');
	// The check is on the screen, not behind a button.
	await expect(page.getByRole('button', { name: /Check/ })).toHaveCount(0);
	await expect(check).toBeVisible();
	await expect(check).toContainText(/Baron\s*: \+2 Outsiders/);
	await expect(check.getByTestId('stand-in-drunk')).toContainText('is shown');
	await select(page, 'Baron');

	// The selection is kept on the device.
	await page.reload();
	await expect(choice(page, 'Drunk')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('warning-count')).toHaveText('0');

	// Clear is an icon by the search and says what it discards before clearing.
	await page.getByRole('button', { name: 'Clear selection' }).tap();
	const clear = page.getByRole('alertdialog', { name: 'Clear the selection?' });
	await expect(clear).toContainText('Now: 6 characters chosen. After: none.');
	await clear.getByRole('button', { name: 'Clear', exact: true }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await page.getByRole('button', { name: 'Random selection' }).tap();
	await expect(page.getByTestId('warning-count')).toHaveText('0');
});

test('characters can be searched by name or ability', async ({ page }) => {
	await selectionFor(page, 5);
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('pairs of EVIL');
	await expect(choice(page, 'Chef')).toBeVisible();
	await expect(choice(page, 'Imp')).toHaveCount(0);
	await search.press('Enter');
	await expect(search).not.toBeFocused();
	await choice(page, 'Chef').tap();
	await page.getByRole('button', { name: 'Clear search' }).tap();
	await expect(choice(page, 'Imp')).toBeVisible();
	await expect(choice(page, 'Chef')).toHaveAttribute('aria-pressed', 'true');
	await search.fill('zzzz');
	await expect(page.getByTestId('character-picker')).toHaveText('None');
});

test('bag tiles can show symbols instead of numbers, centred on the token', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	const tile = page.getByRole('button', { name: 'Tile 1', exact: true });
	await expect(tile).toHaveText('1');
	// The number's centre is the tile's centre.
	const [t, f] = await Promise.all([tile.boundingBox(), tile.locator('.face').boundingBox()]);
	expect(Math.abs(t!.x + t!.width / 2 - (f!.x + f!.width / 2))).toBeLessThan(2);
	expect(Math.abs(t!.y + t!.height / 2 - (f!.y + f!.height / 2))).toBeLessThan(2);

	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	await page.getByRole('button', { name: 'Storyteller settings' }).tap();
	await page.getByText('Symbols on bag tiles', { exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(tile).toHaveText('');
	await expect(tile.locator('svg')).toHaveCount(1);
});

test('with Require a name, the token stays hidden until a name is typed', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	await page.getByRole('button', { name: 'Storyteller settings' }).tap();
	await page.getByText('Require a name before drawing', { exact: true }).tap();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal.getByTestId('reveal-locked')).toBeVisible();
	await expect(reveal.getByTestId('reveal-name')).toHaveText('');
	const show = page.getByRole('button', { name: 'Reveal' });
	await expect(show).toBeDisabled();
	await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
	await show.tap();
	await expect(reveal.getByTestId('reveal-name')).not.toBeEmpty();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 1, drawn' })).toBeDisabled();
});

test('type groups and the setup sheet close from their header and stay closed', async ({
	page
}) => {
	await selectionFor(page, 5);
	const townsfolk = page.getByRole('button', { name: 'Townsfolk', exact: true });
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'true');
	await townsfolk.tap();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
	await expect(choice(page, 'Chef')).toBeHidden();
	await page.getByRole('button', { name: 'Setup sheet', exact: true }).tap();
	await expect(page.getByTestId('setup-table')).toBeHidden();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Townsfolk', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await expect(page.getByTestId('setup-table')).toBeHidden();
	await expect(choice(page, 'Imp')).toBeVisible();
});

test('a character picked by Random looks the same as one picked by hand', async ({ page }) => {
	await selectionFor(page, 5);
	await page.getByRole('button', { name: 'Random selection' }).tap();
	const picked = page.locator('.choice[data-selected]');
	await expect(picked.first()).toBeVisible();
	const random = picked.first();
	const randomName = await random.locator('.main').getAttribute('data-character-id');
	// Pick one by hand: clear, then tap the same character.
	await page.getByRole('button', { name: 'Clear selection' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Clear', exact: true }).tap();
	await page.locator(`[data-character-id="${randomName}"]`).tap();
	const manual = page.locator('.choice[data-selected]').first();
	const ring = (l: typeof manual) =>
		l.evaluate((el) => {
			const after = getComputedStyle(el, '::after');
			return { ring: after.boxShadow, bg: getComputedStyle(el).backgroundColor };
		});
	// Move the pointer away so a hover can't differ either.
	await page.mouse.move(0, 0);
	const byHand = await ring(manual);
	await page.getByRole('button', { name: 'Random selection' }).tap();
	await page.mouse.move(0, 0);
	const byRandom = await ring(page.locator('.choice[data-selected]').first());
	expect(byHand).toEqual(byRandom);
	expect(byHand.ring).not.toBe('none');
});

test('building a bag with errors asks the Storyteller to confirm them', async ({ page }) => {
	await selectionFor(page, 5);
	// No Demon, and one character short.
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	const errors = page.getByTestId('build-errors');
	await expect(errors).toBeVisible();
	await expect(errors).toContainText('4 characters chosen for 5 players');
	await page.getByRole('button', { name: 'Go back' }).tap();
	await expect(errors).toBeHidden();
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Build anyway' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	await expect(page.getByRole('list', { name: 'Bag' }).getByRole('listitem')).toHaveCount(4);
});

test('the draw reveals tiles, keeps a held tile and lands on seats', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 1');
	await expect(page.getByRole('list', { name: 'Bag' }).getByRole('listitem')).toHaveCount(5);

	// Tile 1 to seat 1, with a name.
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal).toBeVisible();
	await expect(reveal.getByTestId('reveal-name')).not.toBeEmpty();
	await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 1, drawn' })).toBeDisabled();
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 2');

	// A drawn tile is never put back: closing the reveal keeps it in seat 2's hand, even
	// across a reload.
	await page.getByRole('button', { name: 'Tile 2', exact: true }).tap();
	await expect(reveal).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(reveal).toBeHidden();
	await page.reload();
	const held = page.getByRole('button', { name: 'Tile 2, held by Seat 2' });
	await expect(held).toBeVisible();
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 3');
	await held.tap();
	await expect(page.getByRole('button', { name: 'Put back' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 2, drawn' })).toBeDisabled();

	// The rest are drawn one by one; Enter in the name field closes the keyboard, not the reveal.
	for (let n = 3; n <= 5; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		const name = reveal.getByRole('textbox', { name: 'Name' });
		await expect(name).toHaveAttribute('enterkeyhint', 'done');
		await name.fill(`P${n}`);
		await name.press('Enter');
		await expect(name).not.toBeFocused();
		await expect(reveal).toBeVisible();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await expect(page.getByRole('button', { name: 'Add all' })).toHaveCount(0);
	await expect(page.getByTestId('next-seat')).toHaveText('None');
	await noSidewaysScroll(page);

	// The last step is the board's setup reminders tray, not a list in the draw.
	const steps = page.getByRole('navigation', { name: 'Setup steps' });
	await expect(steps.locator('[aria-current="step"]')).toHaveText(/Draw/);
	await page
		.getByRole('navigation', { name: 'Setup', exact: true })
		.getByRole('link', { name: 'Grimoire' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
	await expect(page.getByRole('button', { name: /^Seat 1: Ana, / })).toBeVisible();
	for (let n = 1; n <= 5; n++) {
		await expect(page.getByRole('button', { name: new RegExp(`^Seat ${n}: .+`) })).toBeVisible();
	}

	// Set up: the bag and the selection are gone from the board, and closed by address.
	await expect(page.getByRole('button', { name: 'Characters' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Bag draw' })).toHaveCount(0);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/draw`);
	await expect(page).toHaveURL(new RegExp(`${board}$`));
});

test.describe('in a computer window', () => {
	test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

	test('controls sit beside the list, and the keyboard reaches search and the draw', async ({
		page
	}) => {
		await page.goto('/new');
		await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').click();
		for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).click();
		await page.getByRole('button', { name: 'Start game' }).click();
		await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
		await page.goto(`${new URL(page.url()).pathname}/setup`);

		// The setup sheet is beside the characters; Build bag is in the bar at the bottom right.
		const sheet = await page.getByTestId('setup-table').boundingBox();
		const build = await page.getByRole('button', { name: 'Build bag' }).boundingBox();
		const list = await page.getByTestId('character-picker').boundingBox();
		expect(sheet!.x + sheet!.width).toBeLessThan(list!.x);
		expect(build!.x).toBeGreaterThan(list!.x + list!.width / 2);
		expect(build!.y + build!.height).toBeGreaterThan(900 - 2 * build!.height);
		expect(list!.y).toBeLessThan(sheet!.y + sheet!.height);
		await noSidewaysScroll(page);

		// "/" jumps to search; Esc clears it.
		const search = page.getByRole('searchbox', { name: 'Search characters' });
		await page.keyboard.press('/');
		await expect(search).toBeFocused();
		await page.keyboard.type('imp');
		await expect(choice(page, 'Chef')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(search).toHaveValue('');
		await expect(choice(page, 'Chef')).toBeVisible();

		for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
			await choice(page, name).click();
		await page.getByRole('button', { name: 'Build bag' }).click();
		await expect(page).toHaveURL(/\/draw$/);
		await noSidewaysScroll(page);

		// Enter draws a tile; Enter again confirms it.
		await page.keyboard.press('Enter');
		const reveal = page.getByTestId('reveal');
		await expect(reveal).toBeVisible();
		await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
		await page.keyboard.press('Enter');
		await expect(reveal.getByRole('textbox', { name: 'Name' })).not.toBeFocused();
		await page.keyboard.press('Enter');
		await expect(reveal).toBeHidden();
		// Enter takes a tile at random, so any one of them is now drawn.
		await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(1);
	});
});

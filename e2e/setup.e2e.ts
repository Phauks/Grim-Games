import { expect, test, type Page } from '@playwright/test';

// Character selection, the bag and the draw (ROADMAP Phase 2 Setup).

/** Starts a Trouble Brewing game with `players` seats and opens its character selection. */
async function selectionFor(page: Page, players: number) {
	await page.goto('/');
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
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Drunk', 'Poisoner', 'Imp');
	await expect(choice(page, 'Drunk')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('3');
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('warning-count')).toHaveText('0');
	await noSidewaysScroll(page);

	// A Baron needs two more Outsiders: the counts and the check say so, but nothing blocks.
	await select(page, 'Baron');
	await expect(page.getByTestId('warning-count')).not.toHaveText('0');
	await page.getByRole('button', { name: /Check/ }).tap();
	const check = page.getByTestId('setup-check');
	await expect(check).toContainText(/Baron\s*: \+2 Outsiders/);
	await expect(check.getByTestId('stand-in-drunk')).toContainText('is shown');
	await page.keyboard.press('Escape');
	await select(page, 'Baron');

	// The selection is kept on the device.
	await page.reload();
	await expect(choice(page, 'Drunk')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('warning-count')).toHaveText('0');

	await page.getByRole('button', { name: 'Clear', exact: true }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await page.getByRole('button', { name: 'Random' }).tap();
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

	// Setup reminders live on the board now, not in the draw.
	await expect(page.getByRole('button', { name: 'Setup reminders' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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

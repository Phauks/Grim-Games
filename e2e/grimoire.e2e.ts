import { expect, test, type Page } from '@playwright/test';

// The Storyteller's grimoire board: saved games, seats and the seat sheet (ROADMAP Phase 2).

async function startGame(page: Page, script = 'Trouble Brewing') {
	await page.goto('/');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText(script, { exact: true }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

/** A seat by the start of its label; the board is hidden from the a11y tree under a sheet. */
const seatLabelled = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

/** Runs an action from the toolbar's More menu. */
async function menu(page: Page, action: string) {
	await page.getByRole('button', { name: 'More' }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: action }).tap();
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByLabel('Player name')).toBeVisible();
	return sheet;
}

test('a new game is saved and listed on the home page', async ({ page }) => {
	await startGame(page);
	await page.goto('/');
	const saved = page.getByRole('link', { name: /Trouble Brewing.*8 seats/ }).first();
	await expect(saved).toBeVisible();
	await saved.tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
});

test('the seat sheet names, assigns, shrouds and survives a reload', async ({ page }) => {
	await startGame(page);
	let sheet = await openSeat(page, 1);
	await sheet.getByLabel('Player name').fill('Ana');
	await sheet.getByLabel('Player name').press('Enter');
	await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible();

	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character for Ana' });
	await picker.getByRole('button', { name: 'Imp', exact: true }).tap();
	await expect(picker).toBeHidden();
	await expect(sheet.getByText('Imp', { exact: true }).first()).toBeVisible();

	await sheet.getByRole('button', { name: 'Dead' }).tap();
	const cause = page.getByRole('dialog', { name: 'How did Ana die?' });
	await cause.getByRole('button', { name: 'Executed' }).tap();
	await expect(sheet.getByRole('button', { name: 'Executed' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Vote used' }).tap();
	await sheet.getByRole('button', { name: 'Upside down' }).tap();

	await page.reload();
	const seat = page.getByRole('button', { name: /^Seat 1:/ });
	await expect(seat).toHaveAccessibleName('Seat 1: Ana, Imp, dead, ghost vote used, upside down');
	sheet = await openSeat(page, 1);
	await expect(sheet.getByRole('button', { name: 'Executed' })).toBeVisible();
});

test('undo, add seat, swap and remove', async ({ page }) => {
	await startGame(page);
	await menu(page, 'Add seat');
	await expect(page.getByTestId('seat')).toHaveCount(9);
	await page.getByRole('button', { name: 'Undo' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await page.getByRole('button', { name: 'Redo' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(9);

	let sheet = await openSeat(page, 2);
	await sheet.getByLabel('Player name').fill('Ben');
	await sheet.getByLabel('Player name').press('Enter');
	await sheet.getByRole('button', { name: 'Swap seats' }).tap();
	await page
		.getByRole('dialog', { name: 'Swap Ben with' })
		.getByRole('button', { name: /^5/ })
		.tap();
	await expect(seatLabelled(page, 'Seat 5: Ben')).toBeAttached();

	await closeSheet(page);
	sheet = await openSeat(page, 5);
	await sheet.getByRole('button', { name: 'Remove seat' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Remove Ben?' })
		.getByRole('button', { name: 'Remove' })
		.tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
});

test('an orphan character is flagged and names are suggested', async ({ page }) => {
	await startGame(page);
	let sheet = await openSeat(page, 1);
	await sheet.getByLabel('Player name').fill('Zed');
	await sheet.getByLabel('Player name').press('Enter');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character for Zed' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Zombuul', exact: true }).tap();
	await expect(sheet.getByText('Not on the script')).toBeVisible();
	await expect(seatLabelled(page, 'Seat 1: Zed, Zombuul, not on the script')).toBeAttached();

	// A name used before on this device is offered on another seat, once nobody has it.
	await sheet.getByLabel('Player name').fill('Amy');
	await sheet.getByLabel('Player name').press('Enter');
	await closeSheet(page);
	sheet = await openSeat(page, 2);
	await sheet.getByLabel('Player name').fill('Z');
	await sheet
		.getByRole('group', { name: 'Name suggestions' })
		.getByRole('button', { name: 'Zed' })
		.tap();
	await expect(page.getByRole('heading', { name: 'Zed' })).toBeVisible();
});

test('Travellers join as a new seat, and Fabled sit in the middle', async ({ page }) => {
	await startGame(page);
	await menu(page, 'Add Traveller');
	await page
		.getByRole('dialog', { name: 'Add a Traveller' })
		.getByRole('button', { name: 'Thief', exact: true })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toBeAttached();

	await menu(page, 'Add Fabled or Loric');
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Spirit of Ivory', exact: true })
		.tap();
	const fabled = page
		.getByRole('list', { name: 'Fabled and Loric' })
		.getByRole('button', { name: 'Spirit of Ivory' });
	await expect(fabled).toBeVisible();
	await fabled.tap();
	await page
		.getByRole('dialog', { name: 'Spirit of Ivory' })
		.getByRole('button', { name: 'Remove from the game' })
		.tap();
	await expect(fabled).toBeHidden();
});

test('Demon bluffs open from the toolbar, and a seat shows its token to the player', async ({
	page
}) => {
	await startGame(page);
	await menu(page, 'Demon bluffs');
	await expect(page.getByRole('heading', { name: 'Demon bluffs' })).toBeVisible();
	await page.keyboard.press('Escape');

	const sheet = await openSeat(page, 1);
	await expect(sheet.getByRole('button', { name: 'Show to player' })).toBeDisabled();
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown).toBeVisible();
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toBeHidden();
});

test('the toolbar leads to character selection and the bag draw', async ({ page }) => {
	await startGame(page);
	const board = page.url();
	await page.getByRole('button', { name: 'Characters' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	await page.goto(board);
	await page.getByRole('button', { name: 'Bag draw' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
});

test('a new game can use a custom script from the Scripts page', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Paste', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Paste a script' });
	await dialog
		.getByLabel('Script JSON or link')
		.fill(JSON.stringify([{ id: '_meta', name: 'Pocket Storm' }, 'chef', 'saint', 'imp']));
	await dialog.getByRole('button', { name: 'Load' }).tap();
	await expect(page.getByTestId('current-script-name')).toHaveText('Pocket Storm');

	await startGame(page, 'Pocket Storm');
	await expect(page.getByRole('toolbar', { name: 'Grimoire' })).toContainText('Pocket Storm');
});

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

	await page.getByRole('button', { name: 'Clear' }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await page.getByRole('button', { name: 'Random' }).tap();
	await expect(page.getByTestId('warning-count')).toHaveText('0');
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

	// Backing out keeps the tile in seat 2's hand, even across a reload.
	await page.getByRole('button', { name: 'Tile 2', exact: true }).tap();
	await expect(reveal).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(reveal).toBeHidden();
	await page.reload();
	const held = page.getByRole('button', { name: 'Tile 2, held by Seat 2' });
	await expect(held).toBeVisible();
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 3');
	await held.tap();
	await page.getByRole('button', { name: 'Put back' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 2', exact: true })).toBeEnabled();

	// Add all seats everyone else without reveals.
	await page.getByRole('button', { name: 'Add all' }).tap();
	await expect(page.getByTestId('next-seat')).toHaveText('None');
	await noSidewaysScroll(page);

	// Setup reminders: the Washerwoman's tokens, the Storyteller picks the seats.
	await page.getByRole('button', { name: 'Setup reminders' }).tap();
	const reminders = page.getByTestId('setup-reminders');
	await expect(reminders.locator('[data-character-id="washerwoman"]').first()).toBeVisible();
	await page.keyboard.press('Escape');

	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByRole('button', { name: /^Seat 1: Ana, / })).toBeVisible();
	for (let n = 1; n <= 5; n++) {
		await expect(page.getByRole('button', { name: new RegExp(`^Seat ${n}: .+`) })).toBeVisible();
	}
});

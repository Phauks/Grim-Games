import { expect, test, type Page } from '@playwright/test';

// The Character Lab (plan M37, Trevor 2026-11-03: "lock philosopher and tea lady on a script
// and then just keep cycling through or manually changing like the different opposing
// characters"), the Characters page for everyone since M45, with only the selected characters
// listed since M47 (Trevor, 2026-11-04: "do not list all on the left side when none are
// selected. just put a + button to add characters"). The Philosopher's one jinx is with the
// Bounty Hunter (static/data/jinxes.json).

/** A computer window shows the lab beside the table, with the game above it; else the bar. */
const onComputer = async (page: Page) => {
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	return (await page.getByRole('navigation', { name: 'Character Lab' }).count()) === 0;
};

/** The lab's controls: the panel on a computer, else the dialog the bottom bar's Lab opens. */
async function labControls(page: Page) {
	if (await onComputer(page)) return page.getByTestId('lab-panel');
	await page
		.getByRole('navigation', { name: 'Character Lab' })
		.getByRole('button', { name: 'Lab' })
		.tap();
	return page.getByRole('dialog', { name: 'Character Lab' });
}

/** The lab game's seats: in the frame beside the table, or the page Load game opened. */
async function labSeats(page: Page) {
	const frame = page.getByTestId('lab-frame');
	if (await frame.isVisible()) return frame.locator('iframe').contentFrame().getByTestId('seat');
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	return page.getByTestId('seat');
}

/** Selects `name` with +, searching for it as when adding a character mid-game. */
async function lock(page: Page, name: string) {
	await page.getByRole('button', { name: 'Select character' }).tap();
	const picker = page.getByRole('dialog', { name: 'Select character' });
	await picker.getByRole('searchbox').fill(name);
	await picker.getByRole('button', { name: new RegExp(`^${name}`) }).tap();
	await page.keyboard.press('Escape');
	await expect(picker).toBeHidden();
}

async function loadGame(page: Page) {
	if (await onComputer(page))
		await page.getByTestId('lab-panel').getByRole('button', { name: 'Load game' }).tap();
	else
		await page
			.getByRole('navigation', { name: 'Character Lab' })
			.getByRole('button', { name: 'Load game' })
			.tap();
}

test('lists nothing until a character is selected, then it and its jinx partners', async ({
	page
}) => {
	await page.goto('/reference');
	await expect(
		page.getByRole('heading', { name: 'Characters', level: 1, exact: true })
	).toBeVisible();
	// No search, filters or count in the title row.
	await expect(page.getByRole('searchbox', { name: 'Search characters' })).toHaveCount(0);
	const rows = page.getByTestId('character-table').locator('tr[data-character]');
	await expect(rows).toHaveCount(0);
	await expect(page.getByTestId('lab-locked')).toHaveText('None');

	await lock(page, 'Philosopher');
	// Locked stays at the top; Jinxed with locked leaves its one jinx partner under it.
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toHaveAttribute('data-character', 'philosopher');
	await expect(rows.nth(0)).toHaveAttribute('data-locked', '');
	await expect(rows.nth(1)).toHaveAttribute('data-character', 'bountyhunter');
	await expect(page.getByTestId('lab-locked')).toContainText('Philosopher');
	await expect(page.getByTestId('lab-position').first()).toHaveText('1 of 1');

	// The table has no sort, filter or column controls.
	await expect(
		page.getByTestId('character-table').getByRole('button', { name: /^Columns/ })
	).toHaveCount(0);

	const computer = await onComputer(page);
	const lab = await labControls(page);
	await expect(lab.getByTestId('lab-jinxes').getByTestId('jinx-note')).toHaveCount(1);
	await expect(lab.getByText('Jinx partner is')).toHaveCount(0);
	if (!computer) await page.keyboard.press('Escape');

	// Turning the jinx filter off brings every character back as a partner.
	await page.getByText('Jinxed with locked', { exact: true }).tap();
	await expect(page.getByTestId('lab-position').first()).toHaveText(/^1 of 1\d\d$/);
	await page.getByText('Jinxed with locked', { exact: true }).tap();
	await expect(page.getByTestId('lab-position').first()).toHaveText('1 of 1');

	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.first()).toHaveAttribute('aria-label', /Philosopher/);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /Bounty Hunter/);

	// The lab's game is not one being played: Join game doesn't list it.
	await page.goto('/join');
	await expect(page.getByRole('heading', { name: 'Join game', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Character Lab/ })).toHaveCount(0);

	// An old Lab link opens the Characters page, with the lock kept.
	await page.goto('/character-lab');
	await expect(page).toHaveURL(/\/reference$/);
	await expect(rows.nth(0)).toHaveAttribute('data-character', 'philosopher');
});

test('Select character toggles locks, filtered to characters with jinxes', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('button', { name: 'Select character' }).tap();
	const picker = page.getByRole('dialog', { name: 'Select character' });
	await picker.getByText('Has jinxes', { exact: true }).tap();
	// The Chef has no jinx; the Philosopher has one, counted in words on its row.
	await expect(picker.getByRole('button', { name: /^Chef/ })).toHaveCount(0);
	const philosopher = picker.getByRole('button', { name: /^Philosopher/ });
	await expect(philosopher.getByTestId('jinx-count')).toHaveText('1 jinx');
	await philosopher.tap();
	await expect(philosopher).toHaveAttribute('aria-pressed', 'true');
	// A second tap unlocks it again.
	await philosopher.tap();
	await expect(philosopher).toHaveAttribute('aria-pressed', 'false');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('lab-locked')).toHaveText('None');
});

test('steps through jinx partners with the arrows, one fresh game each', async ({ page }) => {
	await page.goto('/reference');
	await lock(page, 'Summoner');
	await expect(page.getByTestId('lab-position').first()).toHaveText(/^1 of ([2-9]|\d\d)$/);
	const next = (await onComputer(page))
		? page.getByTestId('lab-panel').getByRole('button', { name: 'Next jinx partner' })
		: page.getByRole('navigation', { name: 'Character Lab' }).getByRole('button', {
				name: 'Next jinx partner'
			});
	await next.tap();
	await expect(page.getByTestId('lab-position').first()).toHaveText(/^2 of /);
	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.first()).toBeVisible();
});

test('on a computer window the game opens on the right of the table', async ({ page }) => {
	test.skip(test.info().project.name !== 'tablet', 'one window size is enough');
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/reference');
	const panel = page.getByTestId('lab-panel');
	await expect(panel).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Character Lab' })).toHaveCount(0);
	await lock(page, 'Philosopher');
	await panel.getByRole('button', { name: 'Load game' }).tap();
	const table = await page.getByTestId('character-table').boundingBox();
	const frame = await page.getByTestId('lab-frame').boundingBox();
	const controls = await panel.getByRole('button', { name: 'Load game' }).boundingBox();
	// The game on the right, at the top, with the controls under it and no Open the game.
	expect(frame!.x).toBeGreaterThan(table!.x + table!.width - 1);
	expect(controls!.y).toBeGreaterThan(frame!.y + frame!.height - 1);
	await expect(panel.getByText('Open the game')).toHaveCount(0);
	const seats = page.getByTestId('lab-frame').locator('iframe').contentFrame().getByTestId('seat');
	await expect(seats.first()).toHaveAttribute('aria-label', /Philosopher/);
});

// Load game sets the game up as after a real draw and starts it (Trevor, 2026-11-04: "load game
// and start game should be the same"; the Marionette "thinks they are a player"): the
// Marionette's seat holds a Townsfolk with the Is The Marionette reminder, and the first night
// is under way.
test('loads a started game, the Marionette thinking they are a Townsfolk', async ({ page }) => {
	await page.goto('/reference');
	await lock(page, 'Marionette');
	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.nth(0)).toHaveAttribute('aria-label', /Marionette, believes they are the /);
	const frame = page.getByTestId('lab-frame');
	const board = (await frame.isVisible()) ? frame.locator('iframe').contentFrame() : page;
	await expect(board.getByRole('button', { name: 'End night', exact: true })).toBeVisible();
	await expect(board.getByRole('button', { name: 'Start game', exact: true })).toHaveCount(0);
});

test('Apply setup tokens off seats the characters as they are', async ({ page }) => {
	await page.goto('/reference');
	await lock(page, 'Marionette');
	const computer = await onComputer(page);
	const lab = await labControls(page);
	await lab.getByText('Apply setup tokens', { exact: true }).tap();
	if (!computer) await page.keyboard.press('Escape');
	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.nth(0)).toHaveAttribute('aria-label', /Marionette/);
	await expect(seats.nth(0)).not.toHaveAttribute('aria-label', /believes they are/);
});

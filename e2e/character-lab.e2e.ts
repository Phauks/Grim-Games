import { expect, test, type Page } from '@playwright/test';

// The Character Lab (plan M37, Trevor 2026-11-03: "lock philosopher and tea lady on a script
// and then just keep cycling through or manually changing like the different opposing
// characters"), the Characters page for everyone since M45, with one core character since M47
// (Trevor, 2026-11-05: "Just allow setting what the core one is on the left side, start
// empty"), tested against its jinx partners on the right. The Philosopher's one jinx is with
// the Bounty Hunter (static/data/jinxes.json).

/** A computer window shows the lab beside the table, with the game above it; else the bar. */
const onComputer = async (page: Page) => {
	await expect(page.getByRole('heading', { name: 'Character Analyzer', level: 1 })).toBeVisible();
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

/**
 * The lab game's seats, in its frame on this page: beside the table on a computer, under it
 * on a phone (Trevor, 2026-11-06: "loads game on another page ... only to show it beneath").
 */
async function labSeats(page: Page) {
	await expect(page).toHaveURL(/\/character-analyzer/);
	const seats = page.getByTestId('lab-frame').locator('iframe').contentFrame().getByTestId('seat');
	// The frame is made again for each load, so scroll once its new game is in it.
	await expect(async () => {
		await expect(seats.first()).toBeAttached({ timeout: 2_000 });
		await page.getByTestId('lab-frame').scrollIntoViewIfNeeded({ timeout: 2_000 });
	}).toPass();
	return seats;
}

/** Makes `name` the core character with +, searching for it as when adding one mid-game. */
async function lock(page: Page, name: string) {
	await page.getByRole('button', { name: 'Select character' }).tap();
	const picker = page.getByRole('dialog', { name: 'Select character' });
	await picker.getByRole('searchbox').fill(name);
	await picker.getByRole('button', { name: new RegExp(`^${name}`) }).tap();
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

test('starts empty; the core character alone on the left, its jinx partners on the right', async ({
	page
}) => {
	await page.goto('/character-analyzer');
	await expect(
		page.getByRole('heading', { name: 'Character Analyzer', level: 1, exact: true })
	).toBeVisible();
	// No search, filters or count in the title row, and nothing listed.
	await expect(page.getByRole('searchbox', { name: 'Search characters' })).toHaveCount(0);
	const rows = page.getByTestId('character-table').locator('tr[data-character]');
	await expect(rows).toHaveCount(0);
	await expect(page.getByTestId('lab-core')).toHaveText('None');
	await expect(page.getByText('Jinxed with locked')).toHaveCount(0);

	await lock(page, 'Philosopher');
	// Only the core character on the left, without its jinx partners under it.
	await expect(rows).toHaveCount(1);
	await expect(rows.nth(0)).toHaveAttribute('data-character', 'philosopher');
	await expect(page.getByTestId('lab-core')).toContainText('Philosopher');
	await expect(page.getByTestId('lab-position').first()).toHaveText('1 of 1');
	await expect(
		page.getByTestId('character-table').getByRole('button', { name: /^Columns/ })
	).toHaveCount(0);

	// Its one partner on the right, with their jinx.
	const computer = await onComputer(page);
	const lab = await labControls(page);
	await expect(lab.getByTestId('lab-partners').getByRole('button')).toHaveCount(1);
	await expect(lab.getByTestId('lab-partners')).toContainText('Bounty Hunter');
	await expect(lab.getByTestId('lab-jinxes').getByTestId('jinx-note')).toHaveCount(1);
	await expect(lab.getByText('Jinx partner is')).toHaveCount(0);
	if (!computer) await page.keyboard.press('Escape');

	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.first()).toHaveAttribute('aria-label', /Philosopher/);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /Bounty Hunter/);

	// The lab's game is not one being played: Join game doesn't list it.
	await page.goto('/join');
	await expect(page.getByRole('heading', { name: 'Join game', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Character Lab/ })).toHaveCount(0);

	// An old Lab link opens the Character Analyzer, with the core character kept.
	await page.goto('/character-lab');
	await expect(page).toHaveURL(/\/character-analyzer$/);
	await expect(rows.nth(0)).toHaveAttribute('data-character', 'philosopher');
});

test('a character with no jinx says None once', async ({ page }) => {
	await page.goto('/character-analyzer');
	await lock(page, 'Chef');
	const computer = await onComputer(page);
	const lab = await labControls(page);
	await expect(lab.getByText('None', { exact: true })).toHaveCount(1);
	if (!computer) await page.keyboard.press('Escape');
});

test('Select character picks the core one, filtered to characters with jinxes', async ({
	page
}) => {
	await page.goto('/character-analyzer');
	await page.getByRole('button', { name: 'Select character' }).tap();
	const picker = page.getByRole('dialog', { name: 'Select character' });
	await picker.getByText('Has jinxes', { exact: true }).tap();
	// The Chef has no jinx; the Philosopher has one, counted in words on its row.
	await expect(picker.getByRole('button', { name: /^Chef/ })).toHaveCount(0);
	const philosopher = picker.getByRole('button', { name: /^Philosopher/ });
	await expect(philosopher.getByTestId('jinx-count')).toHaveText('1 jinx');
	await philosopher.tap();
	await expect(picker).toBeHidden();
	await expect(page.getByTestId('lab-core')).toContainText('Philosopher');
	// Picking another replaces it.
	await lock(page, 'Summoner');
	await expect(page.getByTestId('lab-core')).toContainText('Summoner');
	await expect(page.getByTestId('character-table').locator('tr[data-character]')).toHaveCount(1);
});

test('steps through jinx partners with the arrows, one fresh game each', async ({ page }) => {
	await page.goto('/character-analyzer');
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
	await page.goto('/character-analyzer');
	const panel = page.getByTestId('lab-panel');
	await expect(panel).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Character Lab' })).toHaveCount(0);
	await lock(page, 'Philosopher');
	await panel.getByRole('button', { name: 'Load game' }).tap();
	// Measured from the top of the lab, where nothing has scrolled under the pinned game.
	await panel.evaluate((el) => el.closest('aside')?.scrollTo(0, 0));
	await page.evaluate(() => window.scrollTo(0, 0));
	const table = await page.getByTestId('lab-select').boundingBox();
	const frame = await page.getByTestId('lab-frame').boundingBox();
	const settings = await panel.getByTestId('lab-settings').boundingBox();
	const partners = await panel.getByTestId('lab-partners').boundingBox();
	// The game on the right, at the top and as wide as the panel, with no caption; its
	// settings under it, then the jinx partners, and no Open the game.
	expect(frame!.x).toBeGreaterThan(table!.x + table!.width - 1);
	expect(frame!.width).toBeGreaterThan(settings!.width - 10);
	expect(settings!.y).toBeGreaterThan(frame!.y + frame!.height - 1);
	expect(partners!.y).toBeGreaterThan(settings!.y + settings!.height - 1);
	await expect(page.getByTestId('lab-frame').locator('figcaption')).toHaveCount(0);
	await expect(panel.getByText('Open the game')).toHaveCount(0);
	const seats = page.getByTestId('lab-frame').locator('iframe').contentFrame().getByTestId('seat');
	await expect(seats.first()).toHaveAttribute('aria-label', /Philosopher/);
});

// A second Load game on a computer opens the new game inside the frame's app, which keeps
// running, instead of loading the app again (load timing, 2026-11-06).
test('a computer window opens each new game in the same frame', async ({ page }) => {
	test.skip(test.info().project.name !== 'tablet', 'one window size is enough');
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/character-analyzer');
	const panel = page.getByTestId('lab-panel');
	await lock(page, 'Summoner');
	const load = panel.getByRole('button', { name: 'Load game' });
	await load.tap();
	const inFrame = page.getByTestId('lab-frame').locator('iframe').contentFrame();
	await expect(inFrame.getByTestId('seat').first()).toBeVisible();
	// Marks the running app: a fresh load would forget it.
	await inFrame.locator('body').evaluate(() => ((window as { labMark?: number }).labMark = 1));
	const first = await inFrame.locator('body').evaluate(() => location.pathname);
	await panel.getByRole('button', { name: 'Next jinx partner' }).tap();
	await expect(page.getByTestId('lab-position').first()).toHaveText(/^2 of /);
	await expect
		.poll(() => inFrame.locator('body').evaluate(() => location.pathname))
		.not.toBe(first);
	await expect(inFrame.getByTestId('seat').first()).toBeVisible();
	expect(
		await inFrame.locator('body').evaluate(() => (window as { labMark?: number }).labMark)
	).toBe(1);
});

// Load game sets the game up as after a real draw and starts it (Trevor, 2026-11-04: "load game
// and start game should be the same"; the Marionette "thinks they are a player"): the
// Marionette's seat holds a Townsfolk with the Is The Marionette reminder, and the first night
// is under way.
test('loads a started game, the Marionette thinking they are a Townsfolk', async ({ page }) => {
	await page.goto('/character-analyzer');
	await lock(page, 'Marionette');
	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.nth(0)).toHaveAttribute('aria-label', /Marionette, believes they are the /);
	const frame = page.getByTestId('lab-frame');
	const board = frame.locator('iframe').contentFrame();
	await expect(board.getByRole('button', { name: 'End night', exact: true })).toBeVisible();
	await expect(board.getByRole('button', { name: 'Start game', exact: true })).toHaveCount(0);
});

test('Apply setup tokens off seats the characters as they are', async ({ page }) => {
	await page.goto('/character-analyzer');
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

// Trevor, 2026-11-05: "what day of the game to start on".
test('Start on opens the game on a later day', async ({ page }) => {
	await page.goto('/character-analyzer');
	await lock(page, 'Philosopher');
	const computer = await onComputer(page);
	const lab = await labControls(page);
	await lab.getByRole('combobox', { name: 'Start on' }).tap();
	await page.getByRole('option', { name: 'Day 2', exact: true }).tap();
	if (!computer) await page.keyboard.press('Escape');
	await loadGame(page);
	const frame = page.getByTestId('lab-frame');
	const board = frame.locator('iframe').contentFrame();
	await expect(board.getByRole('button', { name: 'Execution', exact: true })).toBeVisible();
	await expect(board.getByText('Day 2', { exact: true }).first()).toBeVisible();
	await expect(board.getByRole('button', { name: 'End night', exact: true })).toHaveCount(0);
});

// Plan M63 (Trevor, 2026-11-05: "functionality available to test custom characters"): a
// character made in the Character builder is picked and seated like an official one.
test('tests a character made in the Character builder', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'grim-games:characters',
			JSON.stringify({
				version: 1,
				characters: [
					{
						savedId: 's1',
						entry: {
							id: 'lanternkeeper',
							name: 'Lantern Keeper',
							team: 'townsfolk',
							ability: 'Each night, learn a number.'
						},
						updatedAt: 1
					}
				]
			})
		);
	});
	await page.goto('/character-analyzer');
	await lock(page, 'Lantern Keeper');
	await expect(page.getByTestId('lab-core')).toContainText('Lantern Keeper');
	const rows = page.getByTestId('character-table').locator('tr[data-character]');
	await expect(rows.nth(0)).toHaveAttribute('data-character', 'lanternkeeper');
	await loadGame(page);
	const seats = await labSeats(page);
	await expect(seats.first()).toHaveAttribute('aria-label', /Lantern Keeper/);
});

// Trevor, 2026-11-05: "make sure that the name of the url matches the title of the page".
test('the address matches the title, and an old Reference link still opens its character', async ({
	page
}) => {
	await page.goto('/reference#witch');
	await expect(page).toHaveURL(/\/character-analyzer#witch$/);
	await expect(
		page.getByRole('heading', { name: 'Character Analyzer', level: 1, exact: true })
	).toBeVisible();
	await expect(page).toHaveTitle(/^Character Analyzer/);
	await expect(
		page.getByTestId('character-table').locator('tr[data-character]').nth(0)
	).toHaveAttribute('data-character', 'witch');
});

// Trevor, 2026-11-05: "you can expand to use more space, also, pin mock game on the top right".
test('a computer window uses its whole width, the game pinned while the lab scrolls', async ({
	page
}) => {
	test.skip(test.info().project.name !== 'tablet', 'one window size is enough');
	await page.setViewportSize({ width: 2400, height: 900 });
	await page.goto('/character-analyzer');
	await lock(page, 'Summoner');
	const panel = page.getByTestId('lab-panel');
	const box = (await panel.boundingBox())!;
	expect(box.x + box.width).toBeGreaterThan(2400 - 100);
	// Scrolled to the bottom of the lab, the game still sits at the top of the window.
	const frame = page.getByTestId('lab-frame');
	await panel.getByTestId('lab-jinxes').scrollIntoViewIfNeeded();
	await expect(panel.getByTestId('lab-jinxes')).toBeInViewport();
	const pinned = (await frame.boundingBox())!;
	expect(pinned.y).toBeGreaterThanOrEqual(0);
	expect(pinned.y).toBeLessThan(120);
	await expect(frame).toBeInViewport({ ratio: 0.9 });
});

test("the lab's game stays on this device, out of the device's own room", async ({ page }) => {
	// Trevor, 2026-11-06: "I could see potentially multiple people using character lab. I think
	// this should be local, and not invoke a room code unless specifically asks for it with a
	// button". This device already has a room for a real game.
	await page.addInitScript(() => {
		if (window === window.top)
			localStorage.setItem(
				'grim-games-room-host',
				JSON.stringify({ code: '482913', key: 'real-game-host-key' })
			);
	});
	const sockets: string[] = [];
	page.on('websocket', (socket) => sockets.push(socket.url()));
	await page.goto('/character-analyzer');
	await lock(page, 'Philosopher');
	await loadGame(page);
	await expect((await labSeats(page)).first()).toBeVisible();
	const board = page.getByTestId('lab-frame').locator('iframe').contentFrame();
	await expect(board.getByTestId('board-room-code')).toBeVisible();
	await expect(board.getByTestId('board-room-code')).not.toContainText('482 913');
	expect(sockets.filter((url) => url.includes('482913'))).toEqual([]);
	// Share in the lab's game opens a room of its own, apart from the real game's.
	await expect(board.getByTestId('board-room-code')).not.toContainText(/[0-9]{3} [0-9]{3}/);
	await board.getByRole('button', { name: 'Share' }).tap();
	await expect(board.getByTestId('board-room-code')).toContainText(/[0-9]{3} [0-9]{3}/);
	await expect(board.getByTestId('board-room-code')).not.toContainText('482 913');
});

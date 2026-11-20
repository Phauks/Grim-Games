import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { walkName, walkNext, walkThrough } from './night-step.ts';
import { pickNumber } from './number-select.ts';
import { tapStartGame } from './start-game.ts';
import { openPane, paneIsSheet, storytellerPane } from './players.ts';
import { openBoardTheme } from './theme.ts';

// The grim as the home screen (Trevor, 2026-11-16: "make the grim the home screen"): the Day
// and the Night are tabs of the Storyteller's pane, with Notes and Players. Beside the board
// it always shows, so the board never changes size; on a phone one button opens it as a sheet
// named Game.

async function newGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await pickNumber(page, 'Players', 7);
	await toBoard(page);
	await expect(page.getByTestId('cover-button')).toBeVisible();
}

/** An Imp in Seat 1, then Start game: the first night's walk-through starts at Dusk. */
async function firstNight(page: Page) {
	const seatSheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await page.locator('[data-testid="seat"][aria-label^="Seat 1:"]').tap();
	await seatSheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: /^Imp(, Recommended)?$/ })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seatSheet).toBeHidden();
	await tapStartGame(
		page,
		page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: 'Start game', exact: true })
	);
	await expect(endNight(page)).toBeVisible();
}

const endNight = (page: Page) =>
	page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true });

test('the Day, the Night, Notes and Players are one pane: beside the board, or Game on a phone', async ({
	page
}) => {
	await newGame(page);
	const sheet = await paneIsSheet(page);
	// No Day button: the Day is the pane's.
	await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveCount(0);
	if (sheet) {
		await expect(storytellerPane(page)).toBeHidden();
		await expect(page.getByTestId('game-pane-button')).toBeVisible();
	} else {
		// Always shown, so there is no button to open it.
		await expect(storytellerPane(page)).toBeVisible();
		await expect(page.getByTestId('game-pane-button')).toHaveCount(0);
	}
	// Game holds the Day and Night, Players the players and the notes (Trevor, 2026-11-18).
	const pane = await openPane(page);
	for (const tab of ['Game', 'Players', 'More'])
		await expect(
			pane
				.getByRole('tablist', { name: 'Game', exact: true })
				.getByRole('tab', { name: new RegExp(`^${tab}`) })
		).toBeVisible();
	for (const tab of ['Day', 'Night'])
		await expect(pane.getByRole('tab', { name: tab, exact: true })).toBeVisible();
	// Before the first night, the Day tab is open, with no second timer (the board's is the one).
	await expect(pane.getByTestId('pane-day')).toBeVisible();
	await expect(pane.getByTestId('day-timer')).toHaveCount(0);
	// The day's counts head the pane on every view (Trevor, 2026-11-20: "they should be on every
	// screen on the top"): above the tabs beside the board; on a phone small in the sheet's
	// header (Trevor, 2026-11-19, "B Header, compact").
	const counts = page.getByTestId('day-counts');
	const subjects = pane.getByRole('tablist', { name: 'Game', exact: true });
	await expect(counts).toBeVisible();
	if (sheet) {
		await expect(pane.getByTestId('pane-day').getByTestId('day-counts')).toHaveCount(0);
		await expect(page.getByTestId('dialog-head-actions').getByTestId('day-counts')).toBeVisible();
		// In the title's place, from the left (Trevor, 2026-11-19: "You can remove "game" in
		// header and only have the pills, left aligned"; 2026-11-20: "Remove "Game" From
		// header"); the sheet is still named Game.
		const dialog = page.getByRole('dialog', { name: 'Game', exact: true });
		const heading = (await dialog.getByRole('heading', { name: 'Game' }).boundingBox())!;
		expect(heading.width).toBeLessThan(2);
		const box = (await counts.boundingBox())!;
		const tabs = (await subjects.boundingBox())!;
		expect(Math.abs(box.x - tabs.x)).toBeLessThan(24);
	} else {
		await expect(pane.getByTestId('pane-day').getByTestId('day-counts')).toHaveCount(0);
		// Above the tabs.
		expect((await counts.boundingBox())!.y).toBeLessThan((await subjects.boundingBox())!.y);
	}

	// The Night tab lists the nights' steps, each night closing from its header. The counts and
	// the tabs stay put.
	const tabsAt = (await subjects.boundingBox())!.y;
	await pane.getByRole('tab', { name: /^Night/ }).tap();
	expect((await subjects.boundingBox())!.y).toBeCloseTo(tabsAt, 0);
	const night = pane.getByTestId('pane-night');
	await expect(night.getByRole('button', { name: /^First night/ })).toBeVisible();
	await expect(night.getByRole('button', { name: /^Other nights/ })).toBeVisible();
	await expect(counts).toBeVisible();
	if (sheet) {
		const dialog = page.getByRole('dialog', { name: 'Game', exact: true });
		const heading = (await dialog.getByRole('heading', { name: 'Game' }).boundingBox())!;
		expect(heading.width).toBeLessThan(2);
	}
	// And on another subject's view.
	await pane.getByRole('tab', { name: /^More/ }).tap();
	await expect(counts).toBeVisible();
	expect((await subjects.boundingBox())!.y).toBeCloseTo(tabsAt, 0);
});

test("tonight's step is the pane's Night tab, with the strip's Next", async ({ page }) => {
	await newGame(page);
	await firstNight(page);
	await expect(walkThrough(page)).toBeVisible();
	await expect(walkName(page)).toHaveText('Dusk');
	await walkNext(page).tap();
	await expect(walkName(page)).not.toHaveText('Dusk');

	if (!(await paneIsSheet(page))) {
		// Beside the board there is no strip: the pane has the step and its arrows. With no
		// characters the night is only Dusk and Dawn, its bookends, which have no count (Trevor,
		// 2026-11-18: "Dawn and dusk shouldn't count as night order steps").
		await expect(page.getByTestId('night-strip')).toHaveCount(0);
		const step = storytellerPane(page).getByRole('region', { name: 'First night' });
		await expect(walkName(page)).toHaveText('Dawn');
		await expect(step.getByTestId('step-count')).toHaveCount(0);
		// No bar on Dawn or Dusk (Trevor, 2026-11-19: "there should be no progress bar when on
		// dusk or dawn").
		await expect(step.getByTestId('step-progress')).toBeHidden();
		await step.getByRole('button', { name: 'Previous step', exact: true }).tap();
		await expect(walkName(page)).toHaveText('Dusk');
		await expect(step.getByTestId('step-count')).toHaveCount(0);
		await expect(step.getByTestId('step-progress')).toBeHidden();
	}
});

test('starting the timer at night asks to start the day', async ({ page }) => {
	await newGame(page);
	await firstNight(page);

	const board = page.locator('.toolbar-timer').getByTestId('day-timer');
	await board.getByRole('button', { name: /open its controls$/ }).tap();
	await page
		.getByRole('dialog', { name: 'Day timer' })
		.getByRole('button', { name: 'Start timer' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the day?' });
	await expect(ask).toBeVisible();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	// The night is over: the bank's button is Execution again.
	await expect(endNight(page)).toHaveCount(0);
});

// Trevor (2026-11-16): "for characters like virgin ... should we just show the reminder tokens
// now instead, and revise this so it is more unified with how we treat things at night?"; and
// "allow dragging a reminder token from the right side ... just move the one they drag".
test("a day row lists its character's reminder tokens to place, move or drag, as at night", async ({
	page
}) => {
	await newGame(page);
	const seatSheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await page.locator('[data-testid="seat"][aria-label^="Seat 2:"]').tap();
	await seatSheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 2' })
		.getByRole('button', { name: /^Virgin(, Recommended)?$/ })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seatSheet).toBeHidden();

	const pane = await openPane(page, 'Day');
	const row = pane.locator('li[data-character="virgin"]').getByTestId('day-tokens');
	await expect(row).toContainText('Not placed');
	const seat = (n: number) => page.locator(`[data-testid="seat"][aria-label^="Seat ${n}:"]`);
	if (await paneIsSheet(page)) {
		// Place puts the token in hand: the phone's sheet closes so a seat can be tapped.
		await row.getByRole('button', { name: 'Place', exact: true }).tap();
		await expect(pane).toBeHidden();
		await seat(3).tap();
	} else {
		// Beside the board, the token itself drags onto a seat.
		const token = row.getByRole('button', { name: 'No Ability token' });
		await token.scrollIntoViewIfNeeded();
		const from = (await token.boundingBox())!;
		const to = (await seat(3).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
		await page.mouse.up();
	}
	await expect(seat(3)).toHaveAttribute('aria-label', /1 reminder/);
});

// Trevor, 2026-11-19: "once i start scrolling, background changes". A heading pinned in the
// pane beside the board is filled with the pane's own colour, not the page's darker backdrop.
test("a heading pinned as the pane scrolls keeps the pane's own background", async ({ page }) => {
	await newGame(page);
	test.skip(await paneIsSheet(page), 'A phone shows the pane as a sheet, filled as a sheet is.');
	// A short landscape screen, so the pane is beside the board and its Night tab scrolls.
	await page.setViewportSize({ width: 1280, height: 520 });
	const pane = await openPane(page, 'Night');
	const heading = pane.locator('.collapsible > .head').filter({ hasText: 'First night' });
	await heading.evaluate((head) => {
		for (let box = head.parentElement; box; box = box.parentElement) {
			if (box.scrollHeight > box.clientHeight + 1 && getComputedStyle(box).overflowY === 'auto') {
				box.scrollTop = box.scrollHeight;
				return;
			}
		}
	});
	await expect(heading).toHaveAttribute('data-stuck', '');
	// The colour of the box the heading sits on.
	const paneColour = await heading.evaluate((head) => {
		for (let box = head.parentElement; box; box = box.parentElement) {
			const colour = getComputedStyle(box).backgroundColor;
			if (colour !== 'rgba(0, 0, 0, 0)') return colour;
		}
		return '';
	});
	expect(paneColour).not.toBe('');
	await expect(heading).toHaveCSS('background-color', paneColour);
	await expect(heading).toHaveCSS('background-image', 'none');
});

test.describe('on a wide screen', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	// Trevor (2026-11-19): "fix different scrollbars in theme section". Only the view scrolls,
	// never the pane around it, so there is one scrollbar, at the screen's edge.
	test('a long Theme band scrolls inside its view, never the whole pane', async ({ page }) => {
		await newGame(page);
		const panel = await openBoardTheme(page, 'Board');
		await expect(
			panel.getByRole('checkbox', { name: 'Vignette', includeHidden: true })
		).toBeAttached();
		const overflow = (testId: string) =>
			page.getByTestId(testId).evaluate((el) => el.scrollHeight - el.clientHeight);
		expect(await overflow('pane-theme')).toBeGreaterThan(0);
		expect(await overflow('beside-pane')).toBeLessThanOrEqual(1);
	});
});

// Trevor (2026-11-19): a token in the pane's choices, tapped again while it is in hand, is put
// down.
test('a pane reminder tapped again is put down', async ({ page }) => {
	await newGame(page);
	const seatSheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await page.locator('[data-testid="seat"][aria-label^="Seat 2:"]').tap();
	await seatSheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 2' })
		.getByRole('button', { name: /^Virgin(, Recommended)?$/ })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seatSheet).toBeHidden();

	const inHand = page.getByTestId('reminder-in-hand');
	const pane = await openPane(page, 'Day');
	const row = pane.locator('li[data-character="virgin"]').getByTestId('day-tokens');
	const place = row.getByRole('button', { name: 'Place', exact: true });
	await place.tap();
	await expect(inHand).toBeVisible();
	// A phone's sheet closes so a seat can be tapped; beside the board the row stays.
	if (await paneIsSheet(page)) return;
	await place.tap();
	await expect(inHand).toBeHidden();
	const token = row.getByRole('button', { name: 'No Ability token' });
	await token.tap();
	await expect(inHand).toBeVisible();
	await token.tap();
	await expect(inHand).toBeHidden();
});

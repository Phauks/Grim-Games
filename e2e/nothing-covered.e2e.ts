import { openNotes } from './tabs.ts';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNothingCovered } from './occlusion.ts';
import { pickNumber } from './number-select.ts';
import { toBoard } from './new-game.ts';

// Nothing on the key screens is drawn under anything else (Trevor, 2026-11-06: "their biggest
// UI issues always with stuff being covered up. Can we freaking find out how to stop doing
// this"). Each screen is checked at rest on the phone and the tablet (e2e/occlusion.ts).

const PLAYER_SETTINGS = 'grim-games:player-settings:v1';

/**
 * Found by this check on the board and not fixed yet: on a phone the reminder bank's handle
 * sits over New token. Fix one, take it off: the check fails until the
 * list matches exactly what it finds.
 */
const BOARD_KNOWN: Record<string, { rest: string[]; ended: string[] }> = {
	phone: {
		rest: ['<button.new-token> "New token" covered by <button.handle> "Every reminder"'],
		ended: []
	},
	tablet: {
		rest: [],
		ended: []
	}
};

/** A Trouble Brewing game on the board, as a Storyteller would start one. */
async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 8);
	await toBoard(page);
	return new URL(page.url()).pathname;
}

/** The players' sheets on paper rather than the app's theme, as Trevor had them. */
async function paperSheets(page: Page) {
	await page.evaluate((key) => {
		const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
		localStorage.setItem(key, JSON.stringify({ ...settings, sheetBackground: 'parchment' }));
	}, PLAYER_SETTINGS);
}

/** The bottom tab bar meets the bottom of the box it scrolls in, however short the tab. */
async function expectBarAtBottom(bar: Locator, bottom: number) {
	await expect(async () => {
		const box = (await bar.boundingBox())!;
		expect(Math.abs(box.y + box.height - bottom)).toBeLessThanOrEqual(2);
	}).toPass({ timeout: 5_000 });
}

/** Folds each of the Notes tab's sections, the way a short Notes tab looks. */
async function foldNotes(scope: Locator) {
	for (const name of ['My notes', 'Scratch pads', 'Players']) {
		const header = scope.getByRole('button', { name: new RegExp(`^${name}`) });
		if ((await header.count()) === 0) continue;
		if ((await header.first().getAttribute('aria-expanded')) === 'true') await header.first().tap();
	}
}

test("the Storyteller's player view after Game over covers nothing", async ({ page }) => {
	// Trevor's two screenshots (2026-11-06): the paper sheet pulled up over the bottom of
	// "Game over: Good won", and on a short Notes tab the tab bar left halfway up the screen.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	await paperSheets(page);
	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
	await expectNothingCovered(page, undefined, BOARD_KNOWN[test.info().project.name].ended);

	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const view = page.getByRole('dialog', { name: 'Trouble Brewing' });
	const status = view.getByRole('status').filter({ hasText: 'Game over: Good won' });
	await expect(status).toBeVisible();
	await expect(view.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
	await expectNothingCovered(page, view);

	const scroll = view.getByTestId('script-scroll');
	const bar = view.getByRole('tablist');
	await foldNotes(await openNotes(view));
	const scrollBox = (await scroll.boundingBox())!;
	await expectBarAtBottom(bar, scrollBox.y + scrollBox.height);
	await expectNothingCovered(page, view);
	// Back to a long tab and to the short one again: the bar stays put.
	await view.getByRole('tab', { name: 'Script' }).tap();
	await openNotes(view);
	await expectBarAtBottom(bar, scrollBox.y + scrollBox.height);
});

test('the players’ screen covers nothing, on paper or the theme', async ({ page }) => {
	for (const paper of [false, true]) {
		await page.goto('/play');
		if (paper) {
			await paperSheets(page);
			await page.reload();
		}
		// The script stays chosen across the reload.
		if (!paper) await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).tap();
		await expect(page.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
		await expectNothingCovered(page);
		await page.getByRole('tab', { name: 'Night' }).tap();
		await expectNothingCovered(page);
		const notes = await openNotes(page);
		await expectNothingCovered(page);
		await foldNotes(notes);
		await expectBarAtBottom(page.getByRole('tablist'), page.viewportSize()!.height);
		await page.getByRole('tab', { name: 'Script' }).tap();
	}
});

for (const path of ['/', '/new', '/scripts', '/library', '/reference', '/settings', '/about']) {
	test(`${path} covers nothing at rest`, async ({ page }) => {
		await page.goto(path);
		await expect(page.getByRole('heading').first()).toBeVisible();
		await expectNothingCovered(page);
	});
}

test('the grimoire board covers nothing at rest', async ({ page }, testInfo) => {
	await startGame(page);
	await expectNothingCovered(page, undefined, BOARD_KNOWN[testInfo.project.name].rest);
});

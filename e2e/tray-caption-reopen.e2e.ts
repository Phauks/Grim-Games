import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { closeBin, openBin } from './reminder-bank.ts';

// Trevor (2026-11-16, phone): after the tray was pulled up and let back down, the ∞ caption sat
// left of the handle bar, over the wrong tokens. Its row comes back scrolled to its start, so
// each caption goes back over its own stretch: the ∞ from its line before the first ∞ token
// (or past the handle bar), never over the tokens before it, and not at all while that token is
// off the row's end. One tray for both views (ReminderTray).

async function captionOverItsTokens(page: Page) {
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	const caption = page.getByTestId('bank-generic');
	const cell = tray.getByRole('button', { name: /^Generic reminder/ }).first();
	await expect
		.poll(async () => {
			const token = (await cell.boundingBox())!;
			const row = (await tray.boundingBox())!;
			if ((await caption.count()) === 0) return token.x > row.x + row.width / 2;
			const mark = (await caption.boundingBox())!;
			return mark.x >= token.x - token.width / 2 && mark.x < row.x + row.width;
		})
		.toBe(true);
}

async function scrollOpenClose(page: Page) {
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	await tray.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
	await captionOverItsTokens(page);
	await openBin(page);
	await closeBin(page);
	await captionOverItsTokens(page);
}

test("a player's ∞ caption stays over its tokens after the tray is pulled up and down", async ({
	page
}) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await scrollOpenClose(page);
});

test("the Storyteller's ∞ caption stays over its tokens after the bank is pulled up and down", async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await scrollOpenClose(page);
});

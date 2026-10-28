import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * Show to player records what was shown and places its reminders (the night info framework's
 * "record on show", Trevor 2026-10-28). The Washerwoman learns that one of two players is a
 * given Townsfolk (https://wiki.bloodontheclocktower.com/Washerwoman); its Townsfolk
 * reminder marks that player.
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet;
}

async function choose(page: Page, number: number, name: string, offScript = false) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await closeSheet(page);
}

async function walkTo(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		const start = page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: /^(Start game|Run Night Order)$/ });
		await start.tap();
		const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
		await expect(strip.or(ask)).toBeVisible();
		if (await ask.isVisible())
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	}
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) await next.tap();
	await expect(name).toHaveText(title);
	return strip;
}

async function openStep(page: Page, title: string) {
	const strip = await walkTo(page, title);
	await strip.locator('button.step').tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

test('showing the Washerwoman a Townsfolk places its reminder', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Washerwoman');
	await choose(page, 2, 'Chef');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Poisoner');
	const placed = page.locator(
		'[data-testid="board-reminder"][aria-label="Townsfolk reminder"]:not([data-tray] *)'
	);
	await expect(placed).toHaveCount(0);

	const step = await openStep(page, 'Washerwoman');
	const row = step
		.getByTestId('learned-roles')
		.getByRole('listitem')
		.filter({
			has: page.locator('[data-character-id="chef"]')
		});
	await row.first().getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(shown).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();
	await expect(placed).toHaveCount(1);
});

import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Spy sees the Grimoire each night (https://wiki.bloodontheclocktower.com/Spy), so its night
 * step shows the board to that player clean: no reminder bank, no night order, and nothing in
 * the bar over it but the X, which goes back to the step (Trevor, 2026-10-30).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function openStep(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: /^(Start game|Run Night Order)$/ })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) await next.tap();
	await expect(name).toHaveText(title);
	await strip.locator('button.step').tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

test('the Spy is shown the Grimoire with nothing but the X over it', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Spy');
	await choose(page, 2, 'Imp');
	const step = await openStep(page, 'Spy');

	await step.getByRole('button', { name: 'Show the Grimoire' }).tap();
	await expect(step).toBeHidden();
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await expect(toolbar.getByRole('button')).toHaveCount(1);
	await expect(page.getByTestId('night-strip')).toBeHidden();
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeHidden();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await expect(page.getByTestId('seat').first()).toBeVisible();

	await toolbar.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('dialog', { name: 'Spy' })).toBeVisible();
	// The bar has its controls back, under the step (which hides them from the accessibility tree).
	await expect(page.locator('[role="toolbar"] button[aria-label="More"]')).toBeAttached();
});

test('a step whose player does not see the Grimoire does not offer it', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Poisoner');
	await choose(page, 2, 'Imp');
	const step = await openStep(page, 'Poisoner');
	await expect(step.getByRole('button', { name: 'Show the Grimoire' })).toHaveCount(0);
});

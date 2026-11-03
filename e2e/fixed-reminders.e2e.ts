import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { binToken, closeBin, inHand, putReminder } from './reminder-bank.ts';

// Reminders that stay where they were first put (a character's `reminderMovement.fixed`,
// such as the Fortune Teller's Red Herring) have their word band filled in their team colour
// on the board (Trevor, 2026-11-02, mockup A) and in the reminder bank before they are put
// down or while held (Trevor, 2026-11-03); tokens placed afresh each night (the Monk's
// Safe) keep the plain band.

async function setCharacter(page: Page, seat: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${seat}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${seat}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

const onBoard = (page: Page, label: string) =>
	page.locator('.chip-slot', {
		has: page.getByRole('button', { name: `${label} reminder`, exact: true })
	});

test('reminders that stay put get a filled word band', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await setCharacter(page, 1, 'Fortune Teller');
	await setCharacter(page, 2, 'Monk');

	// In the bank, before it is placed, the fixed token already shows its filled band.
	const herringInBin = await binToken(page, 'Red Herring');
	const safeInBin = await binToken(page, 'Safe');
	await expect(herringInBin).toHaveAttribute('data-fixed', '');
	await expect(safeInBin).not.toHaveAttribute('data-fixed');
	const inBin = await herringInBin.evaluate((token) => ({
		band: getComputedStyle(token.querySelector('.label')!).backgroundColor,
		rim: getComputedStyle(token).borderTopColor
	}));
	expect(inBin.band).toBe(inBin.rim);
	await closeBin(page);

	await putReminder(page, 'Red Herring', 3);
	await putReminder(page, 'Safe', 4);

	const herring = onBoard(page, 'Red Herring');
	const safe = onBoard(page, 'Safe');
	await expect(herring.locator('.reminder')).toHaveAttribute('data-fixed', '');
	await expect(safe.locator('.reminder')).not.toHaveAttribute('data-fixed');

	// The fixed token's band takes its rim's colour; the moving one's stays the token face.
	const bandAndRim = (slot: ReturnType<typeof onBoard>) =>
		slot.locator('.reminder').evaluate((token) => ({
			band: getComputedStyle(token.querySelector('.label')!).backgroundColor,
			rim: getComputedStyle(token).borderTopColor
		}));
	const fixed = await bandAndRim(herring);
	expect(fixed.band).toBe(fixed.rim);
	const moving = await bandAndRim(safe);
	expect(moving.band).not.toBe(moving.rim);

	// Held (tapped), the token in hand shows the same mark (Trevor, 2026-11-03).
	await herring.getByRole('button', { name: 'Red Herring reminder', exact: true }).tap();
	await expect(inHand(page).locator('.reminder')).toHaveAttribute('data-fixed', '');
});

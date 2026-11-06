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

// Trevor (2026-11-06): a turned-evil Townsfolk's stay-put reminder had the red icon but a blue
// rim and word band. The whole token follows its owner's alignment, as the icon does.
test("a turned-evil Townsfolk's reminders are red all over", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await setCharacter(page, 1, 'Fortune Teller');
	await setCharacter(page, 2, 'Imp');
	await putReminder(page, 'Red Herring', 3);
	const token = onBoard(page, 'Red Herring').locator('.reminder');
	const colours = () =>
		token.evaluate((el) => ({
			band: getComputedStyle(el.querySelector('.label')!).backgroundColor,
			rim: getComputedStyle(el).borderTopColor
		}));
	const good = await colours();

	// The Fortune Teller's player turns evil.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Change alignment' }).last().tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	await expect(token).toHaveAttribute('data-alignment', 'evil');
	const evil = await colours();
	expect(evil.rim).not.toBe(good.rim);
	expect(evil.band).toBe(evil.rim);
	// The same red as an evil character's own reminder rim.
	const evilRim = await page.evaluate(() => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--evil)';
		document.body.append(probe);
		const colour = getComputedStyle(probe).color;
		probe.remove();
		return colour;
	});
	expect(evil.rim).toBe(evilRim);
});

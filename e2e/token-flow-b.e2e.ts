import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { confirmToken, editorAction, heldAction, inHand, pickLook } from './reminder-bank.ts';

// Fewer steps to make, edit, remove and delete your own ∞ tokens (Trevor, 2026-11-10, option
// B): "+ New token" stays last; its editor has Text first, every symbol and colour on view,
// and Cancel and Confirm; Confirm puts the token in hand; the hand's pill has ✎, and ⋯ holds
// Duplicate and the trash (Trevor, 2026-11-10). The editor fits one phone screen with the
// keyboard up: symbols in tabs, a character's icon, any colour (Trevor, 2026-11-10, Tabs).

async function playerGrim(page: Page) {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	const make = tray.getByRole('button', { name: 'New token' });
	await make.scrollIntoViewIfNeeded();
	return { tray, make };
}

test("a player's new token is typed, confirmed and placed in four taps", async ({ page }) => {
	const { tray, make } = await playerGrim(page);
	// Still last in the tray.
	await expect(tray.locator('> li').last().getByRole('button')).toHaveAccessibleName('New token');
	await make.tap();
	// Text first, ready to type.
	const text = page.getByTestId('reminder-note');
	await expect(text).toBeFocused();
	await page.keyboard.type('Claims Chef');
	await pickLook(page, 'Star');
	await pickLook(page, 'Blue');
	await confirmToken(page);
	await expect(text).toBeHidden();
	// In hand: the next seat tapped gets it.
	await expect(inHand(page)).toBeVisible();
	const seat = page.getByTestId('grim-seat').nth(1);
	await seat.tap();
	await expect(seat).toHaveAttribute('aria-label', /your reminders: Claims Chef$/);
	const mine = tray.getByRole('button', { name: 'Generic reminder: Claims Chef' });
	await expect(mine).toHaveCount(1);
	await expect(mine.locator('[data-symbol="ph:star"]')).toBeAttached();
});

test("Cancel throws a player's new token away, and Enter confirms", async ({ page }) => {
	const { tray, make } = await playerGrim(page);
	const before = await tray.getByRole('button').count();
	await make.tap();
	await page.keyboard.type('Gone');
	await page.getByRole('button', { name: 'Cancel' }).tap();
	await expect(tray.getByRole('button')).toHaveCount(before);
	await make.tap();
	await page.keyboard.type('Kept');
	await page.keyboard.press('Enter');
	await expect(tray.getByRole('button', { name: 'Generic reminder: Kept' })).toHaveCount(1);
	await expect(inHand(page)).toBeVisible();
});

test("a placed token's pill edits it or takes it off; deleting a token can take its copies", async ({
	page
}) => {
	const { tray, make } = await playerGrim(page);
	await make.tap();
	await page.keyboard.type('Chose');
	await page.keyboard.press('Enter');
	const seats = page.getByTestId('grim-seat');
	await seats.nth(1).tap();
	const mine = tray.getByRole('button', { name: 'Generic reminder: Chose' });
	await mine.tap();
	await seats.nth(2).tap();
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /your reminders: Chose$/);

	// A copy on a seat: tap it, then ✎ edits only that copy.
	const onSeat = (n: number) =>
		page.locator(`.chip-slot[data-seat="${n}"]`).getByTestId('board-reminder');
	await onSeat(2).tap();
	await inHand(page).getByRole('button', { name: 'Edit token' }).tap();
	const text = page.getByTestId('reminder-note');
	await text.fill('Changed');
	await confirmToken(page);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /your reminders: Changed$/);
	await expect(mine).toHaveCount(1);

	// Still in hand, its ⋯ takes it off the seat.
	await heldAction(page, 'Remove reminder');
	await expect(onSeat(2)).toHaveCount(0);

	// The tray token's trash asks, and its copy still like it can go too.
	await mine.tap();
	await heldAction(page, 'Delete token');
	const ask = page.getByRole('alertdialog', { name: 'Delete token' });
	await expect(ask.getByRole('checkbox', { name: 'Also off seats (1)' })).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(mine).toHaveCount(0);
	await expect(onSeat(3)).toHaveCount(0);
});

test("the Storyteller's new ∞ token goes into the hand on Confirm, and the pill deletes it", async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await bank.getByRole('button', { name: 'New token' }).tap();
	await page.keyboard.type('Red herring');
	await pickLook(page, 'Owl');
	await confirmToken(page);
	await expect(inHand(page)).toBeVisible();
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const placed = page.locator(
		'.chip-slot [data-testid="board-reminder"][aria-label="Generic reminder: Red herring"]'
	);
	await expect(placed).toHaveCount(1);

	const token = bank.getByRole('button', { name: 'Generic reminder: Red herring' });
	await token.tap();
	await heldAction(page, 'Delete token');
	const ask = page.getByRole('alertdialog', { name: 'Delete token' });
	await ask.getByText('Also off seats (1)', { exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(token).toHaveCount(0);
	// Left on, as asked.
	await expect(placed).toHaveCount(1);
});

test('the editor fits above the keyboard: tabs, a character icon, any colour, tap again to clear', async ({
	page
}) => {
	const { tray, make } = await playerGrim(page);
	await make.tap();
	await page.keyboard.type('Seamstress');
	const editor = page.getByRole('dialog', { name: /token/ });
	const preview = editor.getByTestId('generic-token-preview');
	// No None: tapping the chosen symbol again takes it off.
	await pickLook(page, 'Heart');
	await expect(preview.locator('[data-symbol^="ph:"]')).toBeAttached();
	await pickLook(page, 'Heart');
	await expect(preview.locator('[data-symbol]')).toHaveCount(0);
	// Any colour, beside the presets.
	await pickLook(page, 'Heart');
	await editor.getByTestId('custom-colour').evaluate((input: HTMLInputElement) => {
		input.value = '#3a7f5c'; // colour-ok: a picked colour, as a test value
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await expect(preview.locator('[data-symbol^="ph:"]')).toHaveCSS('color', 'rgb(58, 127, 92)');
	// A character's icon, from the script or, through the picker, off it.
	await editor.getByRole('tab', { name: 'Characters', exact: true }).tap();
	await editor.getByRole('button', { name: 'More characters' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character icon' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('searchbox').fill('Vortox');
	await picker.getByRole('button', { name: 'Vortox' }).tap();
	await expect(picker).toBeHidden();
	await expect(preview.locator('img')).toBeVisible();
	await expect(editor.getByRole('radio', { name: 'Vortox' })).toBeChecked();
	// Everything is on screen with the keyboard taking the lower part (a phone held upright).
	await page.evaluate(() =>
		document.documentElement.style.setProperty(
			'--keyboard-inset',
			`${Math.round(innerHeight * 0.36)}px` // px-ok: a measured inset, as keyboard-inset.ts sets
		)
	);
	const confirm = editor.getByRole('button', { name: 'Confirm' });
	const bottom = await confirm.evaluate((el) => el.getBoundingClientRect().bottom);
	expect(bottom).toBeLessThanOrEqual(await page.evaluate(() => innerHeight * 0.64 + 1));
	await confirmToken(page);
	await expect(tray.getByRole('button', { name: 'Generic reminder: Seamstress' })).toHaveCount(1);
});

test("⋯ duplicates a player's token, from the pill or the editor", async ({ page }) => {
	const { tray, make } = await playerGrim(page);
	await make.tap();
	await page.keyboard.type('Twin');
	await pickLook(page, 'Star');
	await confirmToken(page);
	const twins = tray.getByRole('button', { name: 'Generic reminder: Twin' });
	await expect(twins).toHaveCount(1);
	await heldAction(page, 'Duplicate token');
	await expect(twins).toHaveCount(2);
	await expect(twins.nth(1).locator('[data-symbol="ph:star"]')).toBeAttached();
	// The copy is in hand, ready for a seat.
	await expect(inHand(page)).toBeVisible();
	await inHand(page).getByRole('button', { name: 'Edit token' }).tap();
	await editorAction(page, 'Duplicate');
	await expect(twins).toHaveCount(3);
});

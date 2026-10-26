import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// Deal (Trevor, 2026-10-26: "auto select characters and send to players"): the bag goes to the
// seats at random, every seat whether or not its player has a phone, and a seated phone holds
// to see its own character while the Storyteller lets players see theirs.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

/** Names seat `number` on the board: a phone with that name sits there (Trevor, 2026-10-26). */
async function nameSeat(page: Page, board: string, number: number, name: string) {
	await page.goto(board);
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test('Deal gives every seat a character, and a seated phone holds to see its own', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);

	// A phone joins, and the Storyteller seats it in seat 2.
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByTestId('you-row').tap();
	const you = phone.getByRole('dialog', { name: 'You', exact: true });
	await you.getByRole('textbox', { name: 'Your name' }).fill('Alex');
	await you.getByRole('button', { name: 'Save' }).tap();
	await nameSeat(page, board, 2, 'Alex');
	await expect(phone.getByTestId('join-status')).toHaveText('You are in seat 2 as Alex.');
	// Nothing to see before the deal.
	await expect(phone.getByTestId('your-character')).toHaveCount(0);

	// Deal, with the players' switch left on.
	await page.goto(`${board}/draw`);
	await page.getByRole('button', { name: 'Deal' }).tap();
	const deal = page.getByRole('alertdialog', { name: 'Deal at random?' });
	await expect(deal).toContainText('The 5 tiles left in the bag go to the empty seats at random');
	await expect(
		deal.getByRole('checkbox', { name: 'Players can see their character' })
	).toBeChecked();
	await deal.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);
	await expect(page.getByRole('button', { name: 'Deal' })).toBeDisabled();

	// The phone holds to see its character; the name shows only while held.
	await phone.getByTestId('your-character').tap();
	const card = phone.getByRole('dialog', { name: 'Your character' });
	const hold = card.getByTestId('role-hold');
	await expect(card.getByTestId('role-name')).toBeEmpty();
	await hold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
	await expect(card.getByTestId('role-name')).toHaveText(/Washerwoman|Empath|Monk|Poisoner|Imp/);
	await hold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
	await expect(card.getByTestId('role-name')).toBeEmpty();

	// Share lists every seat: seat 2 has seen theirs, the others have no phone.
	await page.goto(`${board}/room`);
	const rows = page.getByTestId('role-seat');
	await expect(rows).toHaveCount(5);
	await expect(rows.nth(1)).toContainText('Seen');
	await expect(rows.nth(0)).toContainText('No phone');

	// Turned off, the phone can no longer open it.
	await page.getByText('Players can see their character', { exact: true }).tap();
	await expect(card).toBeHidden();
	await expect(phone.getByTestId('your-character')).toHaveCount(0);
	// Who has looked stays.
	await expect(rows.nth(1)).toContainText('Seen');
	await phoneContext.close();
});

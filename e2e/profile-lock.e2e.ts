import { expect, test, type Page } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';

// Plan R14 (Trevor, 2026-10-29): once a game has started, a player can't change the look on
// their seat (character token, picture, laurel), or it could hint at the character they are
// bluffing. It unlocks when the game ends.

/** Names a seat on the board, which seats the phone with that name. */
async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("a seated player's character token, picture and laurel lock for the game", async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const profile = await openProfile(phone);
	await setPlayerName(phone, 'Alex Kim');
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();
	await nameSeat(page, 3, 'Alex Kim');

	// In Setup, everything can change.
	const token = profile.getByRole('button', { name: 'Change character token' });
	const picture = profile.getByTestId('avatar-picture').getByRole('button', { name: 'Image' });
	const laurel = profile.getByRole('combobox', { name: 'Your laurel' });
	const note = profile.getByTestId('profile-look-locked');
	await expect(token).toBeEnabled();
	await expect(picture).toBeEnabled();
	await expect(laurel).toBeEnabled();
	await expect(note).toHaveText('');
	const before = (await profile.getByTestId('character-icon').boundingBox())!;

	// The first night begins: one character, so the bank offers Start game.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const seat = page.locator('[data-scope="drawer"][data-part="content"]');
	await seat.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seat).toBeHidden();
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	await bank.getByRole('button', { name: 'Start game', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(strip).toBeVisible();

	// Locked, and said so in the line kept for it, so nothing moves.
	await expect(note).toHaveText('Locked until this game ends');
	await expect(token).toBeDisabled();
	await expect(picture).toBeDisabled();
	await expect(laurel).toBeDisabled();
	expect((await profile.getByTestId('character-icon').boundingBox())!.y).toBeCloseTo(before.y, 0);
	// Still locked when the phone comes back.
	await phone.reload();
	const again = await openProfile(phone);
	await expect(again.getByTestId('profile-look-locked')).toHaveText('Locked until this game ends');
	await expect(again.getByRole('button', { name: 'Change character token' })).toBeDisabled();

	// The game ends, and the look can change again, for the next game.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(again.getByTestId('profile-look-locked')).toHaveText('');
	await expect(again.getByRole('button', { name: 'Change character token' })).toBeEnabled();
	await phoneContext.close();
});

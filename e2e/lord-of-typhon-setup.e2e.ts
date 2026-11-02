import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Lord of Typhon's setup (M22, https://wiki.bloodontheclocktower.com/Lord_of_Typhon, How
 * to Run): no Minions are dealt; on the first night the players beside it become Minions, the
 * usual number plus one, spreading out from it in a line.
 */

async function newBoard(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function choose(page: Page, number: number, name: string, offScript = false) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test('the Lord of Typhon makes its neighbours Minions, one more than usual', async ({ page }) => {
	test.slow();
	await newBoard(page);
	await choose(page, 1, 'Lord of Typhon', true);
	await choose(page, 2, 'Chef');
	await choose(page, 3, 'Empath');

	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 10 && (await name.textContent()) !== 'Lord of Typhon'; i++) await next.tap();
	await expect(name).toHaveText('Lord of Typhon');
	await strip.locator('button.step .name strong').tap();
	const step = page.getByRole('dialog', { name: 'Lord of Typhon' });
	const change = step.getByTestId('change-character');

	// Only the players beside it: Seat 2 and Seat 8.
	await change.getByRole('button', { name: 'Choose' }).tap();
	let seats = page.getByRole('dialog', { name: 'Changes character' });
	await expect(seats.getByRole('button', { name: /Seat 3/ })).toHaveCount(0);
	await seats.getByRole('button', { name: /Seat 2/ }).tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await expect(change).toContainText('Poisoner');

	// Then out along the line: Seat 3 or Seat 8. Eight players usually have one Minion: two here.
	await change.getByRole('button', { name: 'Choose' }).tap();
	seats = page.getByRole('dialog', { name: 'Changes character' });
	await expect(seats.getByRole('button', { name: /Seat 4/ })).toHaveCount(0);
	await seats.getByRole('button', { name: /Seat 8/ }).tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: 'Spy', exact: true })
		.tap();
	await expect(change).toContainText('Spy');
	await expect(change.getByRole('button', { name: 'Choose' })).toHaveCount(0);
	await page.screenshot({ path: `test-results/lord-of-typhon-${test.info().project.name}.png` });
});

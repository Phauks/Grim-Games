import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// The Savant information sheet (L2): one true and one false statement from the grimoire,
// from the Savant seat's ⋯ menu (https://wiki.bloodontheclocktower.com/Savant).

const CAST = [
	'Savant',
	'Clockmaker',
	'Dreamer',
	'Snake Charmer',
	'Mutant',
	'Witch',
	'Philosopher',
	'Vigormortis'
];

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet;
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

test('the Savant seat offers one true and one false statement, one kept while the other cycles', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	for (const [i, name] of CAST.entries()) {
		const sheet = await openSeat(page, i + 1);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${i + 1}` });
		await picker.getByRole('button', { name, exact: true }).tap();
		await expect(picker).toBeHidden();
		await closeSheet(page);
	}

	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Savant information…' }).tap();
	const savant = page.getByRole('dialog', { name: /^Savant information/ });
	const lines = savant.getByTestId('savant-line');
	await expect(lines).toHaveCount(2);
	// One true and one false, in either order.
	await expect(savant.locator('[data-truth="true"]')).toHaveCount(1);
	await expect(savant.locator('[data-truth="false"]')).toHaveCount(1);

	// Keep the first; the second cycles and the pair stays one of each.
	const first = await lines.nth(0).locator('.sentence').innerText();
	await savant.getByRole('button', { name: 'Keep statement 1' }).tap();
	await expect(savant.getByRole('button', { name: 'Another statement 1' })).toBeDisabled();
	const second = await lines.nth(1).locator('.sentence').innerText();
	await savant.getByRole('button', { name: 'Another statement 2' }).tap();
	await expect(lines.nth(0).locator('.sentence')).toHaveText(first);
	await expect(lines.nth(1).locator('.sentence')).not.toHaveText(second);
	await expect(savant.locator('[data-truth="true"]')).toHaveCount(1);
	await expect(savant.locator('[data-truth="false"]')).toHaveCount(1);

	// Both false on request (a drunk or poisoned Savant may hear two of a kind); a kept line
	// stays as it is, so let it go first.
	await savant.getByRole('button', { name: 'Keep statement 1' }).tap();
	await savant.getByRole('combobox', { name: 'Statements' }).tap();
	await page.getByRole('option', { name: 'Both false' }).tap();
	await expect(savant.locator('[data-truth="false"]')).toHaveCount(2);

	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
});

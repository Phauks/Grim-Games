import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

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

test('the Savant seat offers one true and one false statement, each cycled or written on its own', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
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

	// Each says whether it holds, and why where the grimoire shows it (Trevor, 2026-10-23: L49;
	// the reasons are unit-tested in savant.test.ts).
	await expect(savant.locator('.verdict')).toHaveCount(2);

	// No lock (L48): the second cycles on its own and the pair stays one of each.
	await expect(savant.getByRole('button', { name: /^Keep statement/ })).toHaveCount(0);
	const first = await lines.nth(0).locator('.sentence').innerText();
	const second = await lines.nth(1).locator('.sentence').innerText();
	await savant.getByRole('button', { name: 'Another statement 2' }).tap();
	await expect(lines.nth(0).locator('.sentence')).toHaveText(first);
	await expect(lines.nth(1).locator('.sentence')).not.toHaveText(second);
	await expect(savant.locator('[data-truth="true"]')).toHaveCount(1);
	await expect(savant.locator('[data-truth="false"]')).toHaveCount(1);

	// Both false on request (a drunk or poisoned Savant may hear two of a kind).
	await savant.getByRole('combobox', { name: 'Statements' }).tap();
	await page.getByRole('option', { name: 'Both false' }).tap();
	await expect(savant.locator('[data-truth="false"]')).toHaveCount(2);

	// The Storyteller's own words (L47), marked true or false by a tap.
	await savant.getByRole('button', { name: 'Write statement 1 yourself' }).tap();
	const field = savant.getByRole('textbox', { name: 'Statement 1, your words' });
	await field.fill('Seat 4 has a secret.');
	const verdict = lines.nth(0).getByRole('button', { name: 'False' });
	await verdict.tap();
	await expect(lines.nth(0).getByRole('button', { name: 'True' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Shown like info tokens, with no True or False (L50).
	await savant.getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('dialog[open][data-testid="show-to-player"]');
	await expect(shown).toBeVisible();
	await expect(shown).toContainText('Seat 4 has a secret.');
	await expect(shown).not.toContainText('True');
	await expect(shown).not.toContainText('False');
	await page.keyboard.press('Escape');
	await expect(shown).toBeHidden();

	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
});

test('the day view recommends Savant information until it is set for today', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	for (const [i, name] of CAST.entries()) {
		const sheet = await openSeat(page, i + 1);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${i + 1}` });
		await picker.getByRole('button', { name, exact: true }).tap();
		await expect(picker).toBeHidden();
		await closeSheet(page);
	}
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	// Not set yet: the button stands out (Trevor, 2026-10-20: L5).
	const info = page.getByTestId('savant-info');
	await expect(info).toHaveCount(1);
	await expect(info).toHaveClass(/recommend/);
	await info.tap();
	const savant = page.getByRole('dialog', { name: /^Savant information/ });
	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
	// Set for today: marked, no longer recommended.
	await expect(info).toHaveAttribute('data-marked', 'true');
	await expect(info).not.toHaveClass(/recommend/);
});

test('the end of the night offers to set the Savant’s information', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	for (const [i, name] of CAST.entries()) {
		const sheet = await openSeat(page, i + 1);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${i + 1}` });
		await picker.getByRole('button', { name, exact: true }).tap();
		await expect(picker).toBeHidden();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	await bank.getByRole('button', { name: 'Start game', exact: true }).tap();
	await bank.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	// A question, never a block (Trevor, 2026-10-23: L46).
	const ask = page.getByRole('alertdialog', { name: 'Set the Savant’s information for today?' });
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	const savant = page.getByRole('dialog', { name: /^Savant information/ });
	await expect(savant.getByTestId('savant-line')).toHaveCount(2);
	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
	await expect(page.getByTestId('savant-info')).toHaveAttribute('data-marked', 'true');
});

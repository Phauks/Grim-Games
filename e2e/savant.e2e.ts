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
	await page.getByRole('button', { name: 'Create game' }).tap();
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
	// Eight character picks first: past 30s on a loaded runner, as in the tests below.
	test.setTimeout(90_000);
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
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
	// Cancel closes it and sets nothing (L41: Trevor saw neither button respond, Oct 23).
	await savant.getByRole('button', { name: 'Cancel' }).tap();
	await expect(savant).toBeHidden();
	await expect(info).toHaveClass(/recommend/);
	await info.tap();
	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
	// Set for today: marked, no longer recommended.
	await expect(info).toHaveAttribute('data-marked', 'true');
	await expect(info).not.toHaveClass(/recommend/);
});

test('the end of the night offers to set the Savant’s information', async ({ page }) => {
	// Eight character picks before the night: about 15s alone, past 30s on a loaded runner.
	test.setTimeout(90_000);
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
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
	// Its switch is in Settings, through ⋯ (Trevor, 2026-10-30).
	await ask.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('menuitem', { name: 'View in settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await expect(
		settings.locator('.content [data-search-label="Suggest Savant information"]')
	).toBeInViewport();
	await settings.locator('[data-part="close-trigger"]').first().tap();
	await expect(settings).toHaveCount(0);
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	const savant = page.getByRole('dialog', { name: /^Savant information/ });
	await expect(savant.getByTestId('savant-line')).toHaveCount(2);
	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
	await expect(page.getByTestId('savant-info')).toHaveAttribute('data-marked', 'true');
});

test('Use these saves the statements: reopening shows them, true or false as given', async ({
	page
}) => {
	test.setTimeout(90_000);
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	for (const [i, name] of CAST.entries()) {
		const sheet = await openSeat(page, i + 1);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${i + 1}` });
		await picker.getByRole('button', { name, exact: true }).tap();
		await expect(picker).toBeHidden();
		await closeSheet(page);
	}
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const info = page.getByTestId('savant-info');
	await info.tap();
	const savant = page.getByRole('dialog', { name: /^Savant information/ });
	const lines = savant.getByTestId('savant-line');
	const field = (i: number) =>
		savant.getByRole('textbox', { name: `Statement ${i + 1}, your words` });
	// Each line in words, so what was given can be read back exactly.
	const given: { words: string; truth: string | null }[] = [];
	for (const i of [0, 1]) {
		await savant.getByRole('button', { name: `Write statement ${i + 1}` }).tap();
		given.push({
			words: await field(i).inputValue(),
			truth: await lines.nth(i).locator('[data-truth]').getAttribute('data-truth')
		});
	}
	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();
	// Trevor (2026-10-24): saving seemed to do nothing, as reopening dealt a fresh pair.
	for (let round = 0; round < 2; round++) {
		await info.tap();
		await expect(savant.getByRole('textbox')).toHaveCount(2);
		for (const i of [0, 1]) {
			await expect(field(i)).toHaveValue(given[i].words);
			await expect(lines.nth(i).locator('[data-truth]')).toHaveAttribute(
				'data-truth',
				given[i].truth!
			);
		}
		// Saving again keeps the same two, not a second pair under them.
		await savant.getByRole('button', { name: 'Use these' }).tap();
		await expect(savant).toBeHidden();
	}
});

test('earlier days’ Savant information sits beside today’s, which is edited on its own', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	for (const [i, name] of CAST.entries()) {
		const sheet = await openSeat(page, i + 1);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${i + 1}` });
		await picker.getByRole('button', { name, exact: true }).tap();
		await expect(picker).toBeHidden();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	const endNight = async () => {
		await bank.getByRole('button', { name: 'End night', exact: true }).tap();
		await page
			.getByRole('alertdialog', { name: 'End the night?' })
			.getByRole('button', { name: 'Confirm' })
			.tap();
		await page
			.getByRole('alertdialog', { name: 'Set the Savant’s information for today?' })
			.getByRole('button', { name: 'Confirm' })
			.tap();
	};
	const savant = page.getByRole('dialog', { name: /^Savant information/ });
	const earlier = savant.getByRole('region', { name: 'Earlier days' });
	await bank.getByRole('button', { name: 'Start game', exact: true }).tap();
	await endNight();
	// Day 1: nothing earlier yet. Today's lines are written in the shared text field.
	await expect(earlier).toContainText('None');
	await savant.getByRole('button', { name: 'Write statement 1 yourself' }).tap();
	await savant.getByRole('textbox', { name: 'Statement 1, your words' }).fill('Seat 4 is good.');
	await savant.getByRole('button', { name: 'Write statement 2 yourself' }).tap();
	await savant.getByRole('textbox', { name: 'Statement 2, your words' }).fill('Seat 6 is good.');
	const lines = savant.getByTestId('savant-line');
	const truths: string[] = [];
	for (const i of [0, 1]) {
		const truth = await lines.nth(i).locator('[data-truth]').getAttribute('data-truth');
		truths.push(truth === 'true' ? 'True' : 'False');
	}
	await savant.getByRole('button', { name: 'Use these' }).tap();
	await expect(savant).toBeHidden();

	await page.keyboard.press('Escape');
	await bank.getByRole('button', { name: 'Execution', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /^No execution(\s|$)/ }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await endNight();

	// Day 2: Day 1's pair on the left, true or false as given; today's is a fresh pair.
	const day1 = earlier.getByTestId('savant-earlier').getByRole('listitem');
	await expect(day1).toHaveCount(1);
	await expect(day1).toContainText('Day 1');
	await expect(day1).toContainText(`${truths[0]} Seat 4 is good.`);
	await expect(day1).toContainText(`${truths[1]} Seat 6 is good.`);
	await expect(savant.getByTestId('savant-line')).toHaveCount(2);
	await expect(savant.getByRole('textbox')).toHaveCount(0);

	// Side by side where there's room; stacked, earlier days on top, on a phone.
	const today = await savant.getByTestId('savant-line').first().boundingBox();
	const left = await earlier.boundingBox();
	const wide = (page.viewportSize()?.width ?? 0) >= 700;
	if (wide) expect(left!.x + left!.width).toBeLessThanOrEqual(today!.x);
	else expect(left!.y + left!.height).toBeLessThanOrEqual(today!.y);
});

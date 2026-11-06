import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Philosopher's choice on its night step (https://wiki.bloodontheclocktower.com/Philosopher;
 * Trevor, 2026-11-03): a good character not in play is held by the Philosopher, who keeps their
 * token; one in play makes its player drunk. And Gain ability, from any seat's ⋯, gives a
 * player a character's ability or the Storyteller's own words (M34). The Cerenovus's step records
 * whom its player is mad as, marked ! by the seat (https://wiki.bloodontheclocktower.com/Cerenovus,
 * M36).
 */

const sheetOf = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = sheetOf(page);
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByRole('button', { name, exact: true }).tap();
	await expect(picker).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function setUp(page: Page, first = 'Philosopher') {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await choose(page, 1, first);
	await choose(page, 2, 'Seamstress');
	await choose(page, 3, 'Witch');
	await choose(page, 4, 'No Dashii');
}

/** Starts the night and opens `character`'s step. */
async function openStep(page: Page, character: string) {
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
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== character; i++) await next.tap();
	await expect(name).toHaveText(character);
	// The character's band opens the step (its ring opens the character instead).
	await strip.locator('.row .ring-main, button.step .name:not(.visually-hidden) strong').tap();
}

/** Starts the night and opens the Philosopher's step. */
async function philosopherStep(page: Page) {
	await openStep(page, 'Philosopher');
	const row = page.getByTestId('gained-ability');
	await expect(row).toBeVisible();
	return row;
}

const seat = (page: Page, number: number) =>
	page.locator(`[data-testid="seat"][aria-label^="Seat ${number}:"]`);

test('the Philosopher keeps their token when they gain a character not in play', async ({
	page
}) => {
	await setUp(page);
	const row = await philosopherStep(page);
	await expect(row).toContainText('None');
	await row.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Gained ability' })
		.getByRole('button', { name: 'Dreamer', exact: true })
		.tap();
	await expect(row).toContainText('Dreamer');
	await expect(row.getByRole('button', { name: 'Change' })).toBeVisible();
	await page.keyboard.press('Escape');
	// Still the Philosopher on the board, holding the Dreamer ability in its pill.
	await expect(seat(page, 1)).toHaveAttribute('aria-label', /Philosopher/);
	await expect(seat(page, 1).getByTestId('held-ability')).toHaveAttribute(
		'title',
		'Holds the Dreamer ability'
	);
});

test('the Philosopher choosing a character in play makes its player drunk', async ({ page }) => {
	await setUp(page);
	const row = await philosopherStep(page);
	await row.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Gained ability' })
		.getByRole('button', { name: 'Seamstress', exact: true })
		.tap();
	await expect(row).toContainText('Seamstress');
	await expect(row).toContainText('Drunk');
	await page.keyboard.press('Escape');
	await expect(seat(page, 1)).toHaveAttribute('aria-label', /Philosopher/);
	await expect(
		page.locator('.chip-slot[data-seat="2"]').getByRole('button', { name: 'Drunk reminder' })
	).toHaveCount(1);
});

test('Gain ability gives any player an ability in words, and takes it away', async ({ page }) => {
	await setUp(page);
	await seat(page, 3).tap();
	const sheet = sheetOf(page);
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Gain ability…' }).tap();
	const gain = page.getByRole('dialog', { name: 'Gain ability' });
	await expect(gain).toContainText('None');
	await gain.getByRole('button', { name: 'Custom' }).tap();
	const words = page.getByRole('dialog', { name: 'Custom ability' });
	await words.getByRole('textbox', { name: 'Ability' }).fill('Learns a number each night');
	await words.getByRole('button', { name: 'Confirm' }).tap();
	await expect(words).toBeHidden();
	await expect(gain).toContainText('Learns a number each night');
	await gain.getByRole('button', { name: 'Remove Learns a number each night' }).tap();
	await expect(gain).toContainText('None');
	await gain.getByRole('button', { name: 'Custom' }).tap();
	await words.getByRole('textbox', { name: 'Ability' }).fill('Is immune to the Witch');
	await words.getByRole('button', { name: 'Confirm' }).tap();
	await page.keyboard.press('Escape');
	await expect(gain).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(seat(page, 3).getByTestId('custom-ability')).toHaveAttribute(
		'title',
		'Has Is immune to the Witch'
	);
});

test('the Cerenovus step records whom the player is mad as, marked ! by their seat', async ({
	page
}) => {
	await setUp(page, 'Cerenovus');
	await openStep(page, 'Cerenovus');
	const row = page.getByTestId('mad-as');
	// Nothing to record it on until Mad is placed: the row stays, its Choose disabled.
	await expect(row).toContainText('None');
	await expect(row.getByRole('button', { name: 'Choose' })).toBeDisabled();
	await page.getByRole('dialog').getByRole('button', { name: 'Place' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Put Mad on' })
		.getByRole('button', { name: /Seamstress Seat 2/ })
		.tap();
	await row.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Mad as' })
		.getByRole('button', { name: 'Savant', exact: true })
		.tap();
	await expect(row).toContainText('Savant');
	await expect(row.getByRole('button', { name: 'Change' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(seat(page, 2).getByTestId('mad-as-character')).toHaveAttribute(
		'title',
		'Mad as the Savant'
	);
	await expect(seat(page, 2)).toHaveAttribute('aria-label', /mad as the Savant/);
	// Tapping the small token says it in words (Trevor, 2026-11-03); its reminder can be held
	// from there, as a tap on the token itself would.
	await seat(page, 2).getByTestId('mad-as-character').tap();
	const words = page.getByRole('dialog', { name: 'Seat 2' });
	await expect(words.getByTestId('seat-marks')).toContainText('Is mad as this character');
	await expect(words.getByTestId('seat-marks')).toContainText('Savant');
	await words.getByRole('button', { name: 'Hold reminder' }).tap();
	await expect(words).toBeHidden();
	await expect(page.getByTestId('reminder-in-hand')).toBeVisible();
});

test("a gained ability brings its character's reminders into the bank (M50)", async ({ page }) => {
	await setUp(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	// No Mathematician in play, so no Abnormal reminder yet.
	await expect(bank.getByRole('button', { name: 'Abnormal reminder' })).toHaveCount(0);
	const row = await philosopherStep(page);
	await row.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Gained ability' })
		.getByRole('button', { name: 'Mathematician', exact: true })
		.tap();
	await expect(row).toContainText('Mathematician');
	await page.keyboard.press('Escape');
	await expect(bank.getByRole('button', { name: 'Abnormal reminder' }).first()).toBeVisible();
});

test('day view lists an ability a player gained under their own character', async ({ page }) => {
	// The Artist, whose day button gives it a row in day view.
	await setUp(page, 'Artist');
	await seat(page, 1).tap();
	const sheet = sheetOf(page);
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Gain ability…' }).tap();
	const gain = page.getByRole('dialog', { name: 'Gain ability' });
	await gain.getByRole('button', { name: 'Character ability' }).tap();
	await page
		.getByRole('dialog', { name: /^Ability / })
		.getByRole('button', { name: 'Mathematician', exact: true })
		.tap();
	await expect(gain).toContainText('Mathematician');
	await page.keyboard.press('Escape');
	await expect(gain).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	// Into Day 1: start the game and end the first night.
	const tray = page.locator('[data-tray]');
	await tray.getByRole('button', { name: /^(Start game|Run Night Order)$/ }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await tray.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	// Under the Artist's own row in day view, the Mathematician's, as the same character row.
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day).toBeVisible();
	const row = day.locator('li[data-character="artist"]');
	await expect(row.getByTestId('borrowed-abilities')).toContainText('Mathematician');
	await expect(
		day.locator('li[data-character="witch"]').getByTestId('borrowed-abilities')
	).toHaveCount(0);
});

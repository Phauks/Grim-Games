import { expect, test, type Page } from '@playwright/test';

/**
 * Game modes on New game (Trevor, 2026-10-17): choose a mode, inspect every part of it, and
 * restrict characters. Whale Buffet's rules: https://whalebuffet.com/.
 */
const modePicker = (page: Page) => page.getByRole('combobox', { name: 'Game mode' });

async function chooseMode(page: Page, name: string) {
	await modePicker(page).tap();
	await page.getByRole('option', { name, exact: true }).tap();
	await expect(modePicker(page)).toContainText(name);
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('Inspect shows every part of a mode with its status and the mode file', async ({ page }) => {
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	await page.getByRole('button', { name: 'Inspect Whale Buffet' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Whale Buffet' });
	await expect(dialog.getByRole('link', { name: 'Whalebuffet', exact: true })).toHaveAttribute(
		'href',
		'https://whalebuffet.com/'
	);
	const banned = dialog.locator('[data-part="restricted"]');
	await expect(banned).toContainText('Run by the app');
	for (const name of ['Atheist', 'Engineer', 'Pit-Hag'])
		await expect(banned.getByRole('button', { name, exact: true })).toBeVisible();
	await expect(dialog.locator('[data-part="assignment"]')).toContainText('Run by the Storyteller');
	await expect(dialog.locator('[data-part="towns"]')).toContainText('Standard');
	await expect(dialog.locator('pre')).toContainText('"id": "whale-buffet"');
	await noSidewaysScroll(page);
});

test('restricted characters stay out of the game, and the mode’s bans can be lifted', async ({
	page
}) => {
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	const restricted = page.getByRole('button', { name: /^Restricted characters/ });
	await expect(restricted).toContainText('(3)');
	await restricted.tap();
	const dialog = page.getByRole('dialog', { name: 'Restricted characters' });
	await dialog.getByRole('searchbox').fill('Pit-Hag');
	await dialog.getByRole('button', { name: /^Pit-Hag/ }).tap();
	await dialog.getByRole('searchbox').fill('Imp');
	await dialog.getByRole('button', { name: /^Imp\b/ }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(restricted).toContainText('(3)');

	await page.getByRole('button', { name: 'Start game' }).tap();
	// Whale Buffet opens on choosing; the setup list shows the game's characters all the same.
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
	await page.goto(new URL(page.url()).pathname.replace(/\/deal$/, '/setup'));
	const list = page.getByTestId('character-picker');
	// Every character is in the pool, less the restricted ones.
	await expect(list.getByRole('button', { name: 'Vortox', exact: true })).toBeVisible();
	await expect(list.getByRole('button', { name: 'Pit-Hag', exact: true })).toBeVisible();
	await expect(list.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0);
	await expect(list.getByRole('button', { name: 'Atheist', exact: true })).toHaveCount(0);
});

/** Starts a 5-player Trouble Brewing game in `mode`; it opens on the draft or choose screen. */
async function startIn(page: Page, mode: string) {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	await chooseMode(page, mode);
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
}

const rows = (page: Page) =>
	page.getByTestId('character-picker').locator('button[data-character-id]');

test('Sushi Buffet drafts seat by seat on one device: offers of 3, 2 and 1, then the board', async ({
	page
}) => {
	// https://grimbits.com/draft-buffet/
	await startIn(page, 'Sushi Buffet');
	await expect(page.getByRole('heading', { name: 'Draft', level: 1 })).toBeVisible();
	await expect(page.getByTestId('seats-left')).toHaveText('5 seats left');
	await expect(page.getByText('Pass to Seat 1')).toBeVisible();
	await page.getByRole('button', { name: 'Show' }).tap();
	await expect(rows(page)).toHaveCount(3);
	await page.getByRole('button', { name: 'Refuse offer' }).tap();
	await expect(rows(page)).toHaveCount(2);
	await page.getByRole('button', { name: 'Refuse offer' }).tap();
	await expect(rows(page)).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Refuse offer' })).toBeDisabled();
	const kept: string[] = [];
	for (let seat = 1; seat <= 5; seat++) {
		if (seat > 1) {
			await expect(page.getByText(`Pass to Seat ${seat}`)).toBeVisible();
			await page.getByRole('button', { name: 'Show' }).tap();
		}
		const first = rows(page).first();
		kept.push((await first.getAttribute('data-character-id'))!);
		await first.tap();
	}
	expect(new Set(kept).size).toBe(5);
	await page.getByRole('button', { name: 'Finish' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
	await noSidewaysScroll(page);
});

test('Whale Buffet deals a type and each player chooses; the Storyteller can ask for a new choice', async ({
	page
}) => {
	// https://whalebuffet.com/
	await startIn(page, 'Whale Buffet');
	await expect(page.getByRole('heading', { name: 'Choose characters', level: 1 })).toBeVisible();
	await page.getByRole('button', { name: 'Show' }).tap();
	await expect(page.getByText(/^Choose a (Townsfolk|Minion|Demon)$/)).toBeVisible();
	await expect(rows(page).first()).toBeVisible();
	await expect(page.locator('button[data-character-id="drunk"]')).toHaveCount(0);
	await rows(page).first().tap();
	await expect(page.getByText('Pass to Seat 2')).toBeVisible();
	await page.getByRole('button', { name: 'Choose again' }).tap();
	await expect(page.getByText('Pass to Seat 1')).toBeVisible();
	for (let seat = 1; seat <= 5; seat++) {
		await page.getByRole('button', { name: 'Show' }).tap();
		await rows(page).first().tap();
	}
	await page.getByRole('button', { name: 'Finish' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
});

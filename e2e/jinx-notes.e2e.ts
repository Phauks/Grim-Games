import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Every jinx shown where it matters (L107): when both characters of a jinx are in play, its own
// text shows on each one's night step and as a mark on each one's row in the day view.
// https://wiki.bloodontheclocktower.com/Djinn

/** TPI's text for the jinx between `a` and `b` (listed under `a`), word for word. */
function tpiJinx(a: string, b: string): string {
	const data = JSON.parse(readFileSync('static/data/jinxes.json', 'utf8')) as {
		id: string;
		jinx: { id: string; reason: string }[];
	}[];
	const reason = data.find((e) => e.id === a)?.jinx.find((j) => j.id === b)?.reason;
	if (!reason) throw new Error(`No ${a} and ${b} jinx in jinxes.json`);
	return reason;
}

const seatSheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function setCharacter(page: Page, seat: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${seat}:`) }).tap();
	const sheet = seatSheet(page);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${seat}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

/**
 * A game on a custom script of `ids` (named `name`), with `seats` (character names) on seats
 * 1, 2 and so on.
 */
async function startGame(page: Page, name: string, ids: string[], seats: string[]) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(JSON.stringify([{ id: '_meta', name }, ...ids]));
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText(name);

	await page.goto('/new');
	await pickScript(page, name);
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	for (const [i, character] of seats.entries()) await setCharacter(page, i + 1, character);
}

const SPY_POPPY = ['chef', 'empath', 'poppygrower', 'spy', 'imp'];

/** Opens a night step from the walk-through under the board. */
async function openStep(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		await page
			.locator('[data-tray]')
			.getByRole('button', { name: /^(Start game|Run Night Order)$/ })
			.tap();
		const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
		await expect(strip.or(ask)).toBeVisible();
		if (await ask.isVisible())
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	}
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	for (const way of ['Next step', 'Previous step']) {
		const button = strip.getByRole('button', { name: way });
		for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) {
			if (await button.isDisabled()) break;
			await button.tap();
		}
	}
	await expect(name).toHaveText(title);
	await strip.locator('button.step').tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

test("a jinx's text shows on both characters' night steps once both are in play", async ({
	page
}) => {
	const reason = tpiJinx('spy', 'poppygrower');
	await startGame(page, 'Jinx Steps', SPY_POPPY, ['Spy', 'Poppy Grower']);

	for (const title of ['Poppy Grower', 'Spy']) {
		const step = await openStep(page, title);
		const notes = step.getByTestId('step-jinxes');
		await expect(step.getByRole('heading', { name: 'Jinxes', level: 3 })).toBeVisible();
		const note = notes.getByTestId('jinx-note');
		await expect(note).toHaveCount(1);
		// Both characters as badges, then TPI's text as it is.
		await expect(note.locator('.pair .badge[data-character-id="spy"]')).toBeVisible();
		await expect(note.locator('.pair .badge[data-character-id="poppygrower"]')).toBeVisible();
		await expect(note.locator('.jinx-text')).toHaveText(reason);
		await page.screenshot({
			path: `test-results/jinx-step-${title.replace(' ', '-')}-${test.info().project.name}.png`
		});
		await step.getByRole('button', { name: 'Close' }).first().tap();
		await expect(step).toBeHidden();
	}
});

test('a night step shows no jinx while only one of the pair is in play', async ({ page }) => {
	// The Poppy Grower is on the script but not in play.
	await startGame(page, 'Jinx Steps', SPY_POPPY, ['Spy']);
	const step = await openStep(page, 'Spy');
	await expect(step.getByTestId('step-ability')).toBeVisible();
	await expect(step.getByTestId('step-jinxes')).toHaveCount(0);
});

// The day lists characters with something to do by day: the Slayer's shot, here jinxed with the
// Lleech (https://wiki.bloodontheclocktower.com/Lleech#Related_Jinxes).
test("the day view marks a jinxed character's row, and the mark opens the jinx", async ({
	page
}) => {
	const reason = tpiJinx('lleech', 'slayer');
	await startGame(
		page,
		'Jinx Day',
		['chef', 'empath', 'slayer', 'spy', 'lleech'],
		['Slayer', 'Lleech']
	);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
	await expect(day).toBeVisible();

	const row = day.locator('li[data-character="slayer"]').first();
	const mark = row.getByTestId('jinx-mark');
	await expect(mark).toHaveAccessibleName('Jinxed with Lleech');
	await page.screenshot({ path: `test-results/jinx-day-row-${test.info().project.name}.png` });
	const before = await row.boundingBox();
	await mark.tap();
	const jinxes = page.getByRole('dialog', { name: 'Jinxes' });
	const note = jinxes.getByTestId('jinx-note');
	await expect(note.locator('.pair .badge[data-character-id="lleech"]')).toBeVisible();
	await expect(note.locator('.pair .badge[data-character-id="slayer"]')).toBeVisible();
	await expect(note.locator('.jinx-text')).toHaveText(reason);
	await page.screenshot({ path: `test-results/jinx-day-${test.info().project.name}.png` });
	await jinxes.getByRole('button', { name: 'Close' }).tap();
	await expect(jinxes).toBeHidden();
	// Opened in a dialog: the row never moved.
	expect(await row.boundingBox()).toEqual(before);
});

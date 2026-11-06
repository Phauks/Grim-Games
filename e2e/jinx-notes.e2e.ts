import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { nightStep } from './night-step.ts';

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
	const dialog = nightStep(page, title);
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
		// Both characters as one split badge (Trevor, 2026-11-02), each half its own button, then
		// TPI's text as it is.
		await expect(note.locator('.pair .badge[data-character-id="spy"]')).toHaveAttribute(
			'data-joined',
			'start'
		);
		await expect(note.locator('.pair .badge[data-character-id="poppygrower"]')).toHaveAttribute(
			'data-joined',
			'end'
		);
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

// A jinx that says only one can be in play shows the other as impossible when changing a seat's
// character (L100; Trevor: "show it as impossible if they try to click it in the selector"): the
// Pit-Hag cannot create a Heretic (https://wiki.bloodontheclocktower.com/Djinn). The Storyteller
// may still go ahead after a confirm (warn, never lock).
test('the character picker fades a character a jinx forbids, and asks before using it', async ({
	page
}) => {
	const reason = tpiJinx('heretic', 'pithag');
	await startGame(
		page,
		'Jinx Pick',
		['chef', 'empath', 'heretic', 'pithag', 'imp'],
		['Pit-Hag', 'Chef']
	);
	const open = async () => {
		await page.getByRole('button', { name: /^Seat 2:/ }).tap();
		await seatSheet(page).getByRole('button', { name: 'Seat actions' }).tap();
		await page.getByRole('button', { name: 'Change character' }).tap();
		const picker = page.getByRole('dialog', { name: 'Character for Seat 2' });
		await expect(picker).toBeVisible();
		return picker;
	};
	let picker = await open();
	const heretic = picker.getByRole('button', { name: 'Heretic, Jinxed', exact: true });
	await expect(heretic).toBeEnabled();
	await expect(picker.locator('.ring-row[data-type="outsider"][data-disabled]')).toHaveCount(1);
	await expect(picker.getByRole('button', { name: 'Empath', exact: true })).toBeVisible();
	await page.screenshot({ path: `test-results/jinx-pick-${test.info().project.name}.png` });

	// Tapped: the jinx, word for word, and Cancel keeps the Chef.
	await heretic.tap();
	const ask = page.getByRole('alertdialog', { name: 'Jinxed' });
	await expect(ask.getByTestId('jinx-note').locator('.jinx-text')).toHaveText(reason);
	await page.screenshot({ path: `test-results/jinx-pick-ask-${test.info().project.name}.png` });
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(ask).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();
	await expect(page.getByRole('button', { name: /^Seat 2:.*Chef/ })).toBeVisible();

	// Confirmed: the change goes ahead as usual.
	picker = await open();
	await picker.getByRole('button', { name: 'Heretic, Jinxed', exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const change = page.getByRole('alertdialog', { name: 'Change character?' });
	await change.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(change).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();
	await expect(page.getByRole('button', { name: /^Seat 2:.*Heretic/ })).toBeVisible();
});

// Players see every jinx on the script, whatever is in play: the Storyteller's player view
// (the board's Script button, the same component as /play) keeps Jinxes open with no jinxed
// character in play, so whether it opens says nothing about which characters are in play.
// https://wiki.bloodontheclocktower.com/Djinn
test("the players' script shows its jinxes open with no jinxed character in play", async ({
	page
}) => {
	// Wiki: "If there are jinxed characters on the character sheet, even if there are no jinxed characters in play, the Storyteller tells all players what the Djinn's special rule is at the start of the game."
	await startGame(page, 'Jinx Sheet', SPY_POPPY, ['Chef', 'Empath']);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Jinx Sheet' });
	const jinxes = sheet.getByRole('button', { name: 'Jinxes' });
	await expect(jinxes).toHaveAttribute('aria-expanded', 'true');
	await expect(sheet.locator('.jinx')).toContainText(tpiJinx('spy', 'poppygrower'));
});

// Show to player from a seat lists the character's jinxes in effect in this game, both
// characters in play (Trevor, 2026-11-04), under its ability; none while only one is.
// https://wiki.bloodontheclocktower.com/Djinn
test('Show to player lists the jinx in effect on the character card', async ({ page }) => {
	// Wiki: "The Djinn special rule allows Jinxed characters to both be on the same script, and even both in play at the same time."
	await startGame(page, 'Jinx Card', SPY_POPPY, ['Spy']);
	const showSeat = async (seat: number) => {
		await page.getByRole('button', { name: new RegExp(`^Seat ${seat}:`) }).tap();
		await seatSheet(page).getByRole('button', { name: 'Show to player' }).tap();
		const shown = page.locator('[data-testid="show-to-player"][open]');
		await expect(shown).toBeVisible();
		return shown;
	};
	let shown = await showSeat(1);
	await expect(shown.getByTestId('shown-character')).toBeVisible();
	await expect(shown.getByTestId('shown-jinxes')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();

	await setCharacter(page, 2, 'Poppy Grower');
	shown = await showSeat(1);
	const jinxes = shown.getByTestId('shown-jinxes');
	await expect(jinxes.getByTestId('jinx-note')).toHaveCount(1);
	await expect(jinxes).toContainText(tpiJinx('spy', 'poppygrower'));
});

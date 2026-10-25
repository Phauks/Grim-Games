import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, nameStoryteller, toBoard } from './new-game.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { openMenu, openSettingsDialog } from './shell.ts';

// The Storyteller's grimoire board: saved games, seats and the seat sheet (ROADMAP Phase 2).

async function startGame(page: Page, script = 'Trouble Brewing') {
	await page.goto('/new');
	await pickScript(page, script);
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

/** A seat by the start of its label; the board is hidden from the a11y tree under a sheet. */
const seatLabelled = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

/** Runs an action from the toolbar's More menu. */
async function menu(page: Page, action: string) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: action }).tap();
}

/**
 * Opens Game info: from the corner script name, or from ⋯ while the corner name is hidden
 * (a phone before setup), the only time ⋯ has it.
 */
async function openGameInfo(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) return entry.tap();
	await page.keyboard.press('Escape');
	await expect(more).toBeHidden();
	await page.getByTestId('mode-menu').tap();
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet;
}

type Sheet = Awaited<ReturnType<typeof openSeat>>;

/** Names the open seat in place: pencil, type, then the keyboard's Done (Enter). */
async function nameSeat(sheet: Sheet, name: string) {
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
}

/** Runs an action from the open seat's … menu. */
async function seatMenu(page: Page, sheet: Sheet, action: string) {
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: action }).last().tap();
}

/**
 * The reminder bank's phase button, at its right end (Trevor, 2026-10-19): Set up while
 * tokens are still to be handed out, Start game, End night, End day, or Run night (Run Night
 * Order) for a walk-through stopped mid-night.
 */
const bankNight = (
	page: Page,
	name: 'Set up' | 'Start game' | 'Run Night Order' | 'End night' | 'Execution'
) =>
	page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name, exact: true });

/**
 * Ending the day asks who was executed (Trevor, 2026-10-22); No execution unless a player
 * is named.
 */
async function chooseExecution(page: Page, choice = 'No execution') {
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: choice, exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

/**
 * The walk-through under the board, on this step: the night order left the board (Trevor,
 * 2026-10-18), so Run night starts it and Next (which ticks each step) or Previous finds it.
 */
/** Whether the walk-through shows its last step ("9 of 9"). */
async function lastStep(strip: Locator) {
	const [at, of] = ((await strip.locator('.count').textContent()) ?? '').split(' of ');
	return at === of;
}

async function walkTo(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	// A step closing hides the board from the a11y tree for a moment; wait it out.
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		const start = page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: /^(Start game|Run Night Order|Execution)$/ });
		const day = (await start.getAttribute('aria-label')) === 'Execution';
		await start.tap();
		if (day) await chooseExecution(page);
		// Setup reminders still to place: Start game asks first (Trevor, 2026-10-20).
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
			// Next stays enabled on the last step, where it points at End night.
			if (way === 'Next step' && (await lastStep(strip))) break;
			await button.tap();
		}
	}
	await expect(name).toHaveText(title);
	return strip;
}

/** Opens a night step to be filled in, from the walk-through. */
async function openStep(page: Page, title: string) {
	const strip = await walkTo(page, title);
	await strip.locator('button.step').tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

/** End night in the bank, confirmed. */
async function endNight(page: Page) {
	await bankNight(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
}

/** The Demon died: the game end prompt asks first; Cancel keeps playing. */
async function keepPlaying(page: Page) {
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	await prompt.getByRole('button', { name: 'Cancel' }).tap();
	await expect(prompt).toBeHidden();
}

test('New game and Resume game are screens of their own', async ({ page }) => {
	// Home is blank for now (Trevor, 2026-10-16); the sidebar leads to each screen.
	await page.goto('/new');
	// The shared page frame: one title per page (Shared page structure).
	await expect(page.getByRole('heading', { name: 'New game', level: 1 })).toBeVisible();
	// The setup table under the player count follows it.
	const current = page.getByTestId('setup-table').locator('thead th[data-current]');
	await expect(current).toHaveText('8');
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(current).toHaveText('9');
	await page.getByRole('button', { name: 'Fewer players' }).tap();
	// No Back button (Trevor, 2026-10-16): Home in the menu goes home.
	await expect(page.getByRole('link', { name: 'Back' })).toHaveCount(0);
	await (await openMenu(page)).getByRole('link', { name: 'Home' }).tap();
	await expect(page).toHaveURL(/\/$/);
	await startGame(page);

	// Resume game lists every saved game with where it is up to.
	await page.goto('/games');
	await expect(page.getByRole('heading', { name: 'Resume game', level: 1 })).toBeVisible();
	const saved = page.getByRole('link', { name: /Trouble Brewing.*Setting up · 8 seats/ });
	await expect(saved).toBeVisible();
	await saved.tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
});

test('a new game offers no "Is The Drunk" before anyone has a token', async ({ page }) => {
	// Trevor (2026-10-18): the Drunk's reminder was offered before the bag was set up.
	// https://wiki.bloodontheclocktower.com/Drunk : the Drunk is in play only if chosen.
	await startGame(page);
	await expect(page.getByText('Is The Drunk')).toHaveCount(0);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	await expect(picker.getByRole('group', { name: 'Drunk' })).toHaveCount(0);
});

test('Resume game deletes every saved game at once, and leaves History alone', async ({ page }) => {
	// One ended game, in History.
	await startGame(page);
	await menu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();
	// Two still being played.
	await startGame(page);
	await startGame(page, 'Sects & Violets');

	await page.goto('/games');
	const games = page.getByRole('region', { name: 'Saved games' }).getByRole('link');
	await expect(games).toHaveCount(2);
	// Trevor (2026-10-18): one button clears the whole list, after asking.
	const clear = page.getByRole('button', { name: 'Delete all saved games' });
	// On the title's line, phones too (Trevor, 2026-10-19).
	const title = (await page.getByRole('heading', { name: 'Resume game', level: 1 }).boundingBox())!;
	const button = (await clear.boundingBox())!;
	expect(Math.abs(button.y + button.height / 2 - (title.y + title.height / 2))).toBeLessThan(
		title.height / 2
	);
	expect(button.x).toBeGreaterThan(title.x + title.width);
	await clear.tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete all 2 saved games?' });
	await confirm.getByRole('button', { name: 'Cancel' }).tap();
	await expect(games).toHaveCount(2);
	await clear.tap();
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(games).toHaveCount(0);
	await expect(page.getByText('None', { exact: true })).toBeVisible();
	await expect(clear).toBeDisabled();
	await page.reload();
	await expect(games).toHaveCount(0);

	await page.goto('/history');
	await expect(
		page.getByRole('region', { name: 'Games' }).getByRole('link', { name: /Trouble Brewing/ })
	).toHaveCount(1);
});

test('the seat sheet names, assigns, shrouds and survives a reload', async ({ page }) => {
	await startGame(page);
	let sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Ana');
	await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible();

	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character for Ana' });
	await picker.getByRole('button', { name: 'Imp', exact: true }).tap();
	await expect(picker).toBeHidden();
	await expect(sheet.getByText('Imp', { exact: true }).first()).toBeVisible();

	// Status is one list: Alive, then the causes of death.
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	const cause = page.getByRole('dialog', { name: 'Status of Ana' });
	await expect(cause.getByRole('button', { name: 'Alive' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await cause.getByRole('button', { name: 'Executed' }).tap();
	await keepPlaying(page);
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
	// Alive brings them back, after saying what changes.
	await sheet.getByRole('button', { name: 'Status: Dead: Executed' }).tap();
	await cause.getByRole('button', { name: 'Alive' }).tap();
	const revive = page.getByRole('alertdialog', { name: 'Bring Ana back to life?' });
	await expect(revive).toContainText(/Now\s*Dead: Executed\s*Becomes\s*Alive/);
	await revive.getByRole('button', { name: 'Cancel' }).tap();
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
	// The ghost vote can be marked used and given back (Trevor, 2026-10-17); it shows on the
	// skull badge (Trevor, 2026-10-19: one badge for both), hollow once used.
	const ghostMark = page.locator(
		'[data-testid="seat"][aria-label^="Seat 1:"] [data-testid="dead-mark"]'
	);
	await expect(ghostMark).toHaveAttribute('data-vote', 'unused');
	// One toggle, as wide as the Status button above it (Trevor, 2026-10-18).
	const ghost = sheet.getByRole('button', { name: 'Ghost vote' });
	const width = async (l: Locator) => (await l.boundingBox())!.width;
	expect(
		Math.abs(
			(await width(ghost)) -
				(await width(sheet.getByRole('button', { name: 'Status: Dead: Executed' })))
		)
	).toBeLessThan(1);
	await expect(ghost).toHaveAttribute('aria-pressed', 'false');
	// The sheet shows the board's badge (Trevor, 2026-10-19: one ghost vote look).
	const sheetMark = ghost.getByTestId('sheet-ghost-vote');
	await expect(sheetMark).toHaveAttribute('data-vote', 'unused');
	// Badge and "Not used" sit in the middle of the button (Trevor, 2026-10-23).
	const box = (await ghost.boundingBox())!;
	const mark = (await sheetMark.boundingBox())!;
	const words = (await ghost.locator('.ghost-text').boundingBox())!;
	expect(Math.abs(mark.x - box.x - (box.x + box.width - (words.x + words.width)))).toBeLessThan(2);
	await expect(sheetMark.locator('[data-icon="ph:ghost-fill"]')).toBeAttached();
	const markBefore = (await sheetMark.boundingBox())!;
	await ghost.tap();
	await expect(ghost).toHaveAttribute('aria-pressed', 'true');
	await expect(ghost).toContainText('Used');
	// Grey like the spent ghost, not red, and only the words change (Trevor, 2026-10-19).
	await expect(ghost).toHaveCSS('border-top-color', 'rgb(90, 86, 96)');
	const markAfter = (await sheetMark.boundingBox())!;
	expect(Math.abs(markAfter.x - markBefore.x)).toBeLessThan(1);
	await expect(ghostMark).toHaveAttribute('data-vote', 'used');
	await expect(sheetMark).toHaveAttribute('data-vote', 'used');
	await expect(sheetMark).toHaveAttribute('data-used-look', 'hollow');
	await expect(sheetMark.locator('[data-icon="ph:ghost"]')).toBeAttached();
	await ghost.tap();
	await expect(ghost).toHaveAttribute('aria-pressed', 'false');
	await expect(ghostMark).toHaveAttribute('data-vote', 'unused');
	// A good Imp: the token stays upright and takes the good colour (Trevor, 2026-10-18).
	const impIcon = page.locator('[data-testid="seat"][aria-label^="Seat 1:"] .token img');
	const evilSrc = await impIcon.getAttribute('src');
	await seatMenu(page, sheet, 'Change alignment');
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(sheet).toContainText(/Imp\s*Demon · Good · Seat 1/);
	await expect(impIcon).not.toHaveAttribute('src', evilSrc!);
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 1:"] .disc > .face')).toHaveCSS(
		'rotate',
		'none'
	);

	await page.reload();
	const seat = page.getByRole('button', { name: /^Seat 1:/ });
	await expect(seat).toHaveAccessibleName('Seat 1: Ana, Imp, dead, good');
	sheet = await openSeat(page, 1);
	await expect(sheet.getByRole('button', { name: 'Executed' })).toBeVisible();
});

test('tapping the seat token shows the character; changing it goes through the … menu and asks', async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	// No "Ability works" line: only an impairment is stated.
	await expect(sheet).not.toContainText('Ability works');

	await sheet.getByRole('button', { name: 'About the Imp' }).tap();
	const details = page.getByRole('dialog', { name: 'Imp' });
	await expect(details).toContainText('Demon');
	// Opened from a seat, the details name the seat and its alignment too (plan L26).
	await expect(details.getByTestId('character-seat')).toHaveText('Seat 1 · Evil');
	await details.getByRole('button', { name: 'Close' }).tap();
	await expect(sheet).toContainText(/Imp\s*Demon · Evil · Seat 1/);

	// The … menu names the character first.
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	const actions = page.getByRole('dialog', { name: 'Seat 1' }).last();
	await expect(actions.locator('[data-character-id="imp"]')).toBeVisible();
	await actions.getByRole('button', { name: 'Change character' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Baron', exact: true })
		.tap();
	const confirm = page.getByRole('alertdialog', { name: 'Change character?' });
	// The seat by number and name, both roles, and the reminders the change takes off.
	await expect(confirm).toContainText(/Player\s*Seat 1\s*Current role/);
	await expect(confirm).toContainText('New role');
	await expect(confirm.locator('[data-character-id="imp"]')).toBeVisible();
	await expect(confirm.locator('[data-character-id="baron"]')).toBeVisible();
	await expect(confirm).toContainText('Reminders from the previous character will be removed.');
	await expect(confirm).toContainText(/Removed\s*None/);
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(sheet).toContainText(/Baron\s*Minion · Evil · Seat 1/);
	// The seat keeps its changes, in a window of their own from the ⋯ menu (Trevor, 2026-10-18).
	await seatMenu(page, sheet, 'Character history');
	const changes = page.getByRole('dialog', { name: 'Character history for Seat 1' });
	await expect(changes.getByTestId('seat-changes')).toContainText(/Imp\s*→\s*Baron/);
	await changes.getByRole('button', { name: 'Close' }).tap();

	// Alignment says what it is and what it becomes.
	await seatMenu(page, sheet, 'Change alignment');
	const alignment = page.getByRole('dialog', { name: 'Alignment' });
	await expect(alignment).toContainText('Now');
	await expect(alignment).toContainText('Evil');
	await expect(alignment).toContainText('Becomes');
	await alignment.getByRole('button', { name: 'Confirm' }).tap();
	await expect(sheet).toContainText(/Baron\s*Minion · Good · Seat 1/);
});

test('history, add seat and remove', async ({ page }) => {
	await startGame(page);
	// Adding a seat asks where it goes: between two neighbours. The new seat then opens.
	await menu(page, 'Add seat');
	await page.getByRole('button', { name: 'Place between Seat 2 and Seat 3' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(9);
	await expect(page.getByRole('button', { name: /^Place between/ })).toHaveCount(0);
	// The new seat just appears; nothing opens by itself (Trevor, 2026-10-16).
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toHaveCount(0);

	// History lists the change; going back to before it asks first.
	await menu(page, 'History');
	const history = page.getByRole('dialog', { name: 'History' });
	const added = history.getByRole('listitem').filter({ hasText: 'Added Seat 3' });
	await added.getByRole('button', { name: 'Restore' }).tap();
	const back = page.getByRole('alertdialog', { name: 'Restore?' });
	await expect(back).toContainText('Undoes 1 change');
	await back.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	// The undone change stays, greyed out, and can be restored.
	await added.getByRole('button', { name: 'Restore' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Restore?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByTestId('seat')).toHaveCount(9);
	await history.getByRole('button', { name: 'Close' }).tap();

	const sheet = await openSeat(page, 5);
	await nameSeat(sheet, 'Ben');
	// No Swap seats: players are moved on the board (Arrange seats).
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await expect(page.getByRole('dialog').getByRole('button', { name: 'Swap seats' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	// The trash sits beside the close X (Trevor, 2026-10-17).
	await page.locator('.head-actions').getByRole('button', { name: 'Remove seat' }).tap();
	const remove = page.getByRole('alertdialog', { name: 'Remove Ben?' });
	// The player count change, and whether the characters still fit the setup sheet.
	await expect(remove.getByTestId('table-check')).toContainText('9 → 8');
	await expect(remove.getByTestId('table-check')).toContainText('the setup sheet');
	await remove.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
});

test('an orphan character is flagged and names are suggested', async ({ page }) => {
	await startGame(page);
	let sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Zed');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character for Zed' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Zombuul', exact: true }).tap();
	await expect(sheet.getByText('Not on the script')).toBeVisible();
	await expect(seatLabelled(page, 'Seat 1: Zed, Zombuul, not on the script')).toBeAttached();

	// A name used before on this device is offered on another seat, once nobody has it.
	await nameSeat(sheet, 'Amy');
	await closeSheet(page);
	sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Z');
	await sheet
		.getByRole('group', { name: 'Name suggestions' })
		.getByRole('button', { name: 'Zed' })
		.tap();
	await expect(page.getByRole('heading', { name: 'Zed' })).toBeVisible();
});

test('Travellers join as a new seat, and Fabled sit in the middle', async ({ page }) => {
	await startGame(page);
	// A Traveller joins as a new seat: Add seat, then choose them for it.
	await menu(page, 'Add seat');
	await page.getByRole('button', { name: 'Place between Seat 8 and Seat 1' }).tap();
	await openSeat(page, 9);
	await page
		.locator('[data-scope="drawer"][data-part="content"]')
		.getByRole('button', { name: 'Choose' })
		.first()
		.tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 9' })
		.getByRole('button', { name: 'Thief, Recommended', exact: true })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();
	await expect(seatLabelled(page, 'Seat 9: no name, Thief')).toBeAttached();
	await closeSheet(page);

	await menu(page, 'Add Fabled or Loric');
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Spirit of Ivory', exact: true })
		.tap();
	const fabled = page
		.getByRole('list', { name: 'Fabled and Loric' })
		.getByRole('button', { name: 'Spirit of Ivory' });
	await expect(fabled).toBeVisible();
	// Or small along the edge (Trevor, 2026-10-17), set beside the background.
	await menu(page, 'Board');
	const looks = page.getByRole('dialog', { name: 'Settings' });
	// A drop-down (Trevor, 2026-10-17).
	await looks.getByRole('combobox', { name: 'Location', exact: true }).tap();
	await page.getByRole('option', { name: 'Corner', exact: true }).tap();
	await looks.getByRole('button', { name: 'Close' }).tap();
	await expect(
		page.locator('.rules-edge').getByRole('button', { name: 'Spirit of Ivory' })
	).toBeVisible();
	await fabled.tap();
	// Its token opens its entry, as a seat's token does (Trevor, 2026-10-18).
	await page.getByRole('button', { name: 'About the Spirit of Ivory' }).tap();
	const entry = page.getByRole('dialog', { name: 'Spirit of Ivory' }).last();
	await expect(entry.locator('header.character')).toBeVisible();
	await entry.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('dialog', { name: 'Spirit of Ivory' })).toHaveCount(1);
	// The trash sits beside the close X (Trevor, 2026-10-17).
	await page
		.getByRole('dialog', { name: 'Spirit of Ivory' })
		.locator('.head-actions')
		.getByRole('button', { name: 'Remove from the game' })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'Remove from the game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(fabled).toBeHidden();
});

test('Demon bluffs open from the toolbar, and a seat shows its token to the player', async ({
	page
}) => {
	await startGame(page);
	await menu(page, 'Demon bluffs');
	await expect(page.getByRole('heading', { name: 'Demon bluffs' })).toBeVisible();
	await page.keyboard.press('Escape');

	const sheet = await openSeat(page, 1);
	// The eye beside ⋯ shows the token (Trevor, 2026-10-16); it is no longer in the ⋯ menu.
	const show = sheet.getByRole('button', { name: 'Show to player' });
	await expect(show).toBeDisabled();
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Seat 1' }).getByRole('button', { name: 'Show to player' })
	).toHaveCount(0);
	await page.keyboard.press('Escape');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await show.tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown).toBeVisible();
	// The token follows the character name setting, off by default (Trevor, 2026-10-18);
	// token-settings.e2e covers it switched on.
	await expect(shown.getByTestId('token-name')).toHaveCount(0);
	// The seat's sheet stays open underneath the whole time (Trevor, 2026-10-17).
	await expect(sheet).toHaveAttribute('data-state', 'open');
	// A tap on the player view doesn't reach the sheet, and Esc closes only the view.
	await shown.tap({ position: { x: 20, y: 200 } });
	await expect(shown).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(shown).toBeHidden();
	await expect(sheet).toHaveAttribute('data-state', 'open');
	await show.tap();
	await expect(shown).toBeVisible();
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toBeHidden();
	await expect(sheet).toBeVisible();
	await expect(sheet).toHaveAttribute('data-state', 'open');
});

test('the board leads to setup and the day; setup ends on the setup reminders', async ({
	page
}) => {
	await startGame(page);
	const board = page.url();
	// Set up is the bank's end cell while tokens are still to be handed out (Trevor,
	// 2026-10-19: "a lot of the game flow comes from that button"), and nowhere else.
	await expect(page.getByRole('button', { name: 'Set up' })).toHaveCount(1);
	await expect(bankNight(page, 'Start game')).toHaveCount(0);
	// Arranging seats keeps Set up there, disabled until Done (Trevor, 2026-10-22).
	await menu(page, 'Arrange seats');
	await expect(bankNight(page, 'Set up')).toBeDisabled();
	await expect(bankNight(page, 'Start game')).toHaveCount(0);
	await page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button', { name: 'Done' }).tap();
	await bankNight(page, 'Set up').tap();
	await expect(page).toHaveURL(`${board}/setup`);
	// The last setup step opens the board, whose bank starts with the setup reminders.
	await page.goto(`${board}#setup-reminders`);
	await expect(page).toHaveURL(board);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Day' })).toBeVisible();
	await expect(page).toHaveURL(board);
});

test('a new game can use a custom script from the Library', async ({ page }) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	await dialog
		.getByLabel('Script JSON')
		.fill(JSON.stringify([{ id: '_meta', name: 'Pocket Storm' }, 'chef', 'saint', 'imp']));
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Pocket Storm');

	await startGame(page, 'Pocket Storm');
	await expect(page.locator('.corner-title .script-name')).toHaveText('Pocket Storm');
});

test("reminders: add several from the picker, this seat's first, then move and remove", async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();

	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	// Not in play, but never in the bag: only the Drunk's global reminder, which marks who is
	// secretly the Drunk.
	await expect(picker.getByRole('group', { name: 'Drunk' })).toContainText('Is The Drunk');
	await expect(picker.getByRole('group', { name: 'Washerwoman' })).toHaveCount(0);
	const poisoner = picker.getByRole('group', { name: 'Poisoner' });
	await poisoner.getByRole('button', { name: 'Poisoned' }).tap();
	await picker.getByRole('group', { name: 'Drunk' }).getByRole('button').first().tap();
	// The top row is what is on this seat now (Trevor, 2026-10-17); no count of them (Trevor,
	// 2026-10-19).
	const top = picker.getByRole('group', { name: 'On this seat' }).getByRole('button');
	await expect(top).toHaveCount(2);
	await expect(picker).not.toContainText('On this seat:');
	// Reminders have two looks, the board's token and the in-line badge; the picker uses the
	// badge as the seat sheet does, and Add reminder is a + alone (Trevor, 2026-10-19).
	const fontSize = (el: Element) => getComputedStyle(el).fontSize;
	expect(await top.first().getByTestId('reminder-token').evaluate(fontSize)).toBe(
		await sheet.getByTestId('reminder-token').first().evaluate(fontSize)
	);
	// Under the picker, so out of the accessibility tree: found by its label.
	await expect(sheet.locator('button[aria-label="Add reminder"]')).toHaveText('');
	// Each token is placed once: the Poisoner has one "Poisoned", shown as on this seat.
	await expect(poisoner.getByRole('button', { name: /Poisoned/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// Tapping a reminder on this seat takes it off (asking first when it stays put), and
	// tapping it again puts it back (Trevor, 2026-10-16).
	const drunk = picker.getByRole('group', { name: 'Drunk' }).getByRole('button').first();
	await drunk.tap();
	await page
		.getByRole('alertdialog', { name: 'Confirm change?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(picker.getByRole('group', { name: 'On this seat' }).getByRole('button')).toHaveCount(
		1
	);
	await expect(drunk).toHaveAttribute('aria-pressed', 'false');
	// Taken off, it leaves the top row.
	await expect(top).toHaveCount(1);
	await drunk.tap();
	await expect(picker.getByRole('group', { name: 'On this seat' }).getByRole('button')).toHaveCount(
		2
	);
	// Only characters in play: no way to add the Washerwoman's reminders here.
	await expect(picker.getByRole('group', { name: 'Washerwoman' })).toHaveCount(0);
	await picker.getByRole('button', { name: 'Close' }).tap();

	await expect(seatLabelled(page, 'Seat 1: no name, Poisoner, 2 reminders')).toBeAttached();
	// The Poisoner is evil, so its reminder's icon is the red one (not the blue good icon).
	await expect(
		page.locator('[data-testid="board-reminder"][aria-label="Poisoned reminder"] img')
	).toHaveAttribute('src', /poisoner_e\.webp$/);
	await sheet.getByRole('button', { name: 'Actions for Poisoned' }).tap();
	await page
		.getByRole('dialog', { name: 'Poisoned' })
		.getByRole('button', { name: 'Move to another seat' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Move Poisoned to' })
		.getByRole('button', { name: /^3/ })
		.tap();
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
	await sheet.getByRole('button', { name: 'Actions for Is The Drunk' }).tap();
	await page
		.getByRole('dialog', { name: 'Is The Drunk' })
		.getByRole('button', { name: 'Remove reminder' })
		.tap();
	// It normally stays put, so taking it off asks first.
	await page
		.getByRole('alertdialog', { name: 'Confirm change?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(sheet.getByText('None', { exact: true }).last()).toBeVisible();
});

test('seats can be arranged: dragged anywhere, kept through a rotation, spread evenly', async ({
	page
}) => {
	await startGame(page);
	const seat = (n: number) => page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) });
	const centre = async (n: number) => {
		const box = (await seat(n).boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	const board = (await page.locator('.board').boundingBox())!;
	const seat2 = await centre(2);

	await menu(page, 'Arrange seats');
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await expect(toolbar).toContainText('Arrange seats');
	await expect(page.getByRole('dialog', { name: 'Grimoire' })).toBeHidden();

	// Drag seat 1 inside the circle (clear of the centre buttons); the others stay put.
	const from = await centre(1);
	const to = { x: board.x + board.width / 2, y: board.y + board.height * 0.3 };
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 4 });
	await page.mouse.up();
	const moved = await centre(1);
	expect(Math.abs(moved.x - to.x)).toBeLessThan(4);
	expect(Math.abs(moved.y - to.y)).toBeLessThan(4);
	expect(await centre(2)).toEqual(seat2);

	// No gap buttons: spacing is set by dragging seats (Trevor, 2026-10-16).
	await expect(page.getByRole('button', { name: /^Space after seat/ })).toHaveCount(0);

	// Rotating moves the players, not the places: the hand-placed spot stays put.
	await toolbar.getByRole('button', { name: 'Rotate players clockwise' }).tap();
	// Seat 8's player is in seat 1 now, and keeps the name "Seat 8" (Trevor, 2026-10-22).
	await expect(seatLabelled(page, 'Seat 1: Seat 8')).toBeAttached();
	const turned = await centre(1);
	expect(Math.abs(turned.x - to.x)).toBeLessThan(4);
	expect(Math.abs(turned.y - to.y)).toBeLessThan(4);
	await toolbar.getByRole('button', { name: 'Done' }).tap();

	// The layout is kept on this device, and seats open their sheet again.
	await page.reload();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	const after = await centre(1);
	expect(Math.abs(after.x - to.x)).toBeLessThan(4);
	await openSeat(page, 1);
	await closeSheet(page);

	// Spread evenly puts everyone back round the table.
	await menu(page, 'Arrange seats');
	await toolbar.getByRole('button', { name: 'Spread evenly' }).tap();
	await expect(toolbar.getByRole('button', { name: 'Spread evenly' })).toBeDisabled();
	const spread = await centre(1);
	expect(Math.abs(spread.x - from.x)).toBeLessThan(4);
	expect(Math.abs(spread.y - from.y)).toBeLessThan(4);

	// A seat dragged past its neighbours stays there: seats renumber to match (Trevor,
	// 2026-10-16), then spread evenly. Seat 2 goes just past seat 4, towards seat 5.
	const at = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => centre(n));
	const [c2, c4, c5] = [await at[1], await at[3], await at[4]];
	// Inside the circle, clear of the seats, so it is a placement, not a drop on a seat.
	const mid = { x: board.x + board.width / 2, y: board.y + board.height / 2 };
	const edge = { x: c4.x * 0.7 + c5.x * 0.3, y: c4.y * 0.7 + c5.y * 0.3 };
	const past = { x: edge.x * 0.6 + mid.x * 0.4, y: edge.y * 0.6 + mid.y * 0.4 };
	await page.mouse.move(c2.x, c2.y);
	await page.mouse.down();
	await page.mouse.move((c2.x + past.x) / 2, (c2.y + past.y) / 2, { steps: 4 });
	await page.mouse.move(past.x, past.y, { steps: 4 });
	await page.mouse.up();
	await toolbar.getByRole('button', { name: 'Spread evenly' }).tap();
	// Seats 3 and 4 move up one place; the dragged seat is now Seat 4, where seat 4 was.
	const four = await centre(4);
	expect(Math.abs(four.x - c4.x)).toBeLessThan(4);
	expect(Math.abs(four.y - c4.y)).toBeLessThan(4);
	expect(await centre(1)).toEqual(spread);
});

test('the name is edited in place; Done saves and closes the keyboard', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	const name = sheet.getByRole('textbox', { name: 'Player name' });
	await expect(name).toBeFocused();
	await name.fill('Ana');
	await expect(name).toHaveAttribute('enterkeyhint', 'done');
	await name.press('Enter');
	await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible();
	// Focus leaving the field is what closes a phone's on-screen keyboard.
	await expect(name).toBeHidden();
	await expect(seatLabelled(page, 'Seat 1: Ana')).toBeAttached();

	// Escape puts the name back as it was.
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await name.fill('Bob');
	await name.press('Escape');
	await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible();
	await expect(sheet).toBeVisible();
});

test('a reminder on the board drags to another seat (the Sailor picks again)', async ({ page }) => {
	await startGame(page, 'Bad Moon Rising');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Sailor', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	await picker.getByRole('group', { name: 'Sailor' }).getByRole('button', { name: 'Drunk' }).tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);

	// The token is drawn on the board, not as a number.
	const token = page.getByRole('button', { name: 'Drunk reminder' });
	await expect(token).toBeVisible();
	const centre = async (locator: ReturnType<Page['getByRole']>) => {
		const box = (await locator.boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	const drag = async (to: { x: number; y: number }) => {
		const from = await centre(token);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
		await page.mouse.move(to.x, to.y, { steps: 4 });
		await page.mouse.up();
	};

	// While dragged, the board says where the token came from.
	{
		const from = await centre(token);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move(from.x + 30, from.y + 30, { steps: 4 });
		// Nothing names where it came from: tapping the reminder says (Trevor, 2026-10-24).
		await expect(page.getByTestId('drag-source')).toHaveCount(0);
		// The seat it comes from is marked unlike the others (Trevor, 2026-10-20).
		await expect(page.locator('[data-testid="seat"][data-from]')).toHaveCount(1);
		await expect(seatLabelled(page, 'Seat 1:')).toHaveAttribute('data-from', 'true');
		await page.mouse.move(from.x, from.y, { steps: 2 });
		await page.mouse.up();
	}

	// Dropped away from any seat: nothing changes.
	const board = (await page.locator('.board').boundingBox())!;
	await drag({ x: board.x + board.width / 2, y: board.y + board.height / 2 });
	await expect(seatLabelled(page, 'Seat 1: no name, Sailor, 1 reminder')).toBeAttached();

	// Dropped on seat 3: moved there, and History has it.
	await drag(await centre(page.getByRole('button', { name: /^Seat 3:/ })));
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 1: no name, Sailor')).toHaveAttribute(
		'aria-label',
		'Seat 1: no name, Sailor'
	);
	await menu(page, 'History');
	// The entry says where the token came from as well as where it went.
	await expect(page.getByRole('dialog', { name: 'History' })).toContainText(
		/Drunk moved from\s+Sailor.* to Seat 3/
	);
	// Filtered by player (Trevor, 2026-10-19): only entries naming Seat 1, the Sailor's seat;
	// the Drunk reminder's own character is no filter.
	const history = page.getByRole('dialog', { name: 'History' });
	const filter = history.getByRole('group', { name: 'Show changes for' });
	await expect(filter.getByRole('button', { name: 'Sailor' })).toHaveCount(0);
	await expect(filter.getByRole('button', { name: 'Seat 3' })).toBeVisible();
	await filter.getByRole('button', { name: 'Seat 1', exact: true }).tap();
	await expect(filter.getByRole('button', { name: 'All' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(history.locator('.history > li')).not.toHaveCount(0);
	for (const text of await history.locator('.history > li .text').allTextContents())
		expect(text).toMatch(/Sailor/);
	await filter.getByRole('button', { name: 'All' }).tap();
	await expect(history).toContainText('New game:');
	await page.keyboard.press('Escape');

	// A tap opens only the reminder, its character's ability first (Trevor, 2026-10-17), not
	// the seat's sheet under it (Trevor, 2026-10-18).
	// The same tap's click, which the browser sends after the dialog has opened under the
	// finger, reaches nothing in the dialog (Trevor, 2026-10-18).
	await page.evaluate(() => {
		const w = window as unknown as { clicksInDialog: number };
		w.clicksInDialog = 0;
		document.addEventListener(
			'click',
			(event) => {
				if ((event.target as Element).closest('[role="dialog"]')) w.clicksInDialog += 1;
			},
			true
		);
	});
	await token.tap();
	const reminder = page.getByRole('dialog', { name: 'Drunk' });
	await expect(reminder).toBeVisible();
	await page.waitForTimeout(600);
	expect(
		await page.evaluate(() => (window as unknown as { clicksInDialog: number }).clicksInDialog)
	).toBe(0);
	// Named once, in "From" (Trevor, 2026-10-18).
	await expect(reminder).toContainText(/From\s*Sailor/);
	await expect(reminder.getByText('Sailor', { exact: true })).toHaveCount(1);
	await expect(reminder.locator('header.character')).toContainText(/choose an alive player/i);
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
	await reminder.getByRole('button', { name: 'Close' }).tap();
	await expect(reminder).toBeHidden();
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
});

test('every reminder on a crowded seat is shown and can be dragged off', async ({ page }) => {
	await startGame(page);
	// Three characters in play, each with two reminders, plus the Drunk's: seven on one seat.
	for (const [seat, name] of [
		[1, 'Washerwoman'],
		[2, 'Librarian'],
		[3, 'Investigator']
	] as const) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${seat}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const sheet = await openSeat(page, 4);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 4' });
	for (const group of ['Washerwoman', 'Librarian', 'Investigator', 'Drunk']) {
		const buttons = picker.getByRole('group', { name: group }).getByRole('button');
		for (let i = 0; i < (await buttons.count()); i++) await buttons.nth(i).tap();
	}
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 7 reminders')).toBeAttached();

	// Tokens put where they don't usually go say so in toasts; they leave by themselves.
	await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0, { timeout: 15000 });

	// Each one is on the board and on top where it sits, so a finger can take any of them.
	// (The bank, under the board, keeps its generic ∞ reminder.)
	const tokens = page.locator('[data-testid="board-reminder"]:not([data-tray] *)');
	await expect(tokens).toHaveCount(7);
	for (let i = 0; i < 7; i++) {
		const box = (await tokens.nth(i).boundingBox())!;
		const hit = await tokens
			.nth(i)
			.evaluate(
				(el, [x, y]) => el.contains(document.elementFromPoint(x, y)),
				[box.x + box.width / 2, box.y + box.height / 2]
			);
		expect(hit).toBe(true);
	}

	// The last one drags onto Seat 6.
	const last = tokens.last();
	const from = (await last.boundingBox())!;
	const to = (await page.getByRole('button', { name: /^Seat 6:/ }).boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 20, { steps: 6 });
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 });
	await page.mouse.up();
	// It is the Drunk's, which normally stays put, so the move asks first.
	await page
		.getByRole('alertdialog', { name: 'Confirm change?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(seatLabelled(page, 'Seat 6: no name, no character, 1 reminder')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 6 reminders')).toBeAttached();
});

test('the night order is walked through from the bank, and End night starts the day', async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Sam');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Sam' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await closeSheet(page);

	// The night order left the board's menu (Trevor, 2026-10-18): the bank runs it, and the
	// Script screen lists it.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: 'Night order' })
	).toHaveCount(0);
	await page.keyboard.press('Escape');
	const strip = await walkTo(page, 'Empath');
	await expect(strip).toContainText('Sam');

	// End night at the end of the reminder bank ends the night and starts Day 1 (Trevor,
	// 2026-10-18), once Dusk has started it.
	// The day timer is on the board from the start (Trevor, 2026-10-17).
	const boardTimer = page.locator('.board-timer').getByTestId('day-timer');
	await expect(boardTimer).toBeVisible();
	await endNight(page);
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(boardTimer).toBeVisible();
	await expect(boardTimer.getByRole('button', { name: 'Start timer' })).toBeVisible();
	// Day has come: the button can't start another day; Execution, in place of End day,
	// starts the next night (Trevor, 2026-10-19; 2026-10-22).
	await expect(bankNight(page, 'End night')).toHaveCount(0);
	await expect(bankNight(page, 'Execution')).toBeEnabled();
});

test('a night step offers the info tokens its text names', async ({ page }) => {
	// https://wiki.bloodontheclocktower.com/Imp : a Minion who becomes the Imp is shown
	// "You are" and the Imp token (Trevor, 2026-10-19: such tokens are ready in the step).
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await closeSheet(page);
	await walkTo(page, 'Dusk');
	await endNight(page);
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(day).toBeHidden();

	// Tapped at its count: the middle of the Imp's text is a glossary word with its own popover.
	await (await walkTo(page, 'Imp')).locator('button.step .count').tap();
	const step = page.getByRole('dialog', { name: 'Imp' });
	const tiles = step.getByTestId('step-info-tokens');
	await expect(tiles.getByRole('button')).toHaveCount(1);
	// The Imp's rules fill in its own token (Trevor, 2026-10-24), so the card shows at once.
	await tiles.getByRole('button', { name: 'You are (Imp)', exact: true }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('img', { name: /Imp token/ })).toBeVisible();
	// The step stays open under the sheet, for the rest of the Imp's turn.
	await shown.getByRole('button', { name: 'Close' }).tap();
	await page.keyboard.press('Escape');
	await expect(step).toBeVisible();
});

test('a filled-in info token with room left opens its picker with the filled ones picked', async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Cerenovus : the target learns the Cerenovus chose
	// them and which character to be mad about (Trevor, 2026-10-24: its own token is filled in).
	await startGame(page, 'Sects & Violets');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Cerenovus', exact: true })
		.tap();
	await closeSheet(page);

	await (await walkTo(page, 'Cerenovus')).locator('button.step .count').tap();
	const step = page.getByRole('dialog', { name: 'Cerenovus' });
	await step
		.getByTestId('step-info-tokens')
		.getByRole('button', { name: 'This character selected you (Cerenovus)', exact: true })
		.tap();
	// The Cerenovus is already picked; the Storyteller adds the madness character.
	const confirm = page.getByRole('button', { name: 'Confirm' });
	await expect(confirm).toBeEnabled();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Clockmaker');
	await page.getByRole('button', { name: /^Clockmaker/ }).tap();
	await confirm.tap();
	await expect(
		page.getByRole('dialog', { name: 'This character selected you: Cerenovus: Clockmaker' })
	).toBeVisible();
});

test("the Dreamer's card shows the chosen player's character and one of the other alignment", async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Dreamer : one good and one evil character, one of
	// which is the chosen player's (Trevor, 2026-10-24: filled in, then shown in random order).
	await startGame(page, 'Sects & Violets');
	for (const [seat, name] of [
		[1, 'Dreamer'],
		[2, 'Clockmaker']
	] as const) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${seat}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}

	await (await walkTo(page, 'Dreamer')).locator('button.step .count').tap();
	const step = page.getByRole('dialog', { name: 'Dreamer' });
	await step
		.getByTestId('step-info-tokens')
		.getByRole('button', { name: 'This player is', exact: true })
		.tap();
	// Which player the Dreamer chose, then the picker with their character already picked.
	await page
		.getByRole('dialog', { name: 'Dreamer chose' })
		.getByRole('button', { name: /Clockmaker Seat 2/ })
		.tap();
	await expect(page.getByRole('checkbox', { name: 'Evil only' })).toBeChecked();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('No Dashii');
	await page.getByRole('button', { name: /^No Dashii/ }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(
		page.getByRole('dialog', {
			name: /^This player is: (Clockmaker: No Dashii|No Dashii: Clockmaker)$/
		})
	).toBeVisible();
});

test('Share in the toolbar shows the room code, QR and join link, never the game', async ({
	page
}) => {
	await startGame(page);
	const url = page.url();
	// Share sits in the toolbar, never hidden in the menu, and opens over the board.
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	const share = page.getByRole('dialog', { name: 'Share' });
	await expect(share.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	await expect(share.getByRole('img', { name: 'QR code to join the room' })).toBeVisible();
	const code = (await share.getByTestId('share-code').textContent())!.replace(/\D/g, '');
	// The link is the room's: phones that join get the script, names and deaths only. The
	// view-only grimoire link sits below it on the same screen (Trevor, 2026-10-22), off.
	const watch = share.getByTestId('watch-link');
	await expect(share.getByTestId('share-url').first()).toHaveValue(new RegExp(`/join/${code}$`));
	await expect(watch.getByTestId('share-url')).toHaveValue('');
	await expect(watch.getByTestId('share-code')).toHaveCount(0);
	expect(page.url()).toBe(url);
	await share.getByRole('button', { name: 'Close', exact: true }).tap();
	await expect(share).toBeHidden();
	await expect(seatLabelled(page, 'Seat 1:')).toBeVisible();
});

// Trevor (2026-10-22): the join code in the board's corner, to read without opening Share.
test('the join code shows under the script name, a Board setting, read only', async ({ page }) => {
	await startGame(page);
	const corner = page.getByTestId('board-room-code');
	await expect(corner).toContainText('Join code');
	// Script comes before Share in the toolbar (Trevor, 2026-10-23).
	const toolbar = page.getByRole('button', { name: /^(Script|Share)$/ });
	await expect(toolbar).toHaveCount(2);
	await expect(toolbar.first()).toHaveAccessibleName('Script');
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	const share = page.getByRole('dialog', { name: 'Share' });
	const code = share.getByTestId('share-code');
	await expect(code).toHaveText(/^\d{3} \d{3}$/);
	const shown = (await code.textContent())!;
	await share.getByRole('button', { name: 'Close', exact: true }).tap();
	// The day or night and Game time join the code's line where a phone's corner has no line
	// to spare for them.
	const codeLine = new RegExp(`^Join code ${shown}(\\s*·\\s*Game time Setup)?$`);
	await expect(corner).toHaveText(codeLine);
	// Only read: Share is the toolbar's button, not the corner (Trevor, 2026-10-24).
	await expect(page.getByRole('button', { name: /Join code/ })).toHaveCount(0);

	await menu(page, 'Board');
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings.getByText('Join code on the board', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(corner).toHaveCount(0);

	// The same switch on Share, where the code is (Trevor, 2026-10-23).
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	const onShare = share.getByRole('checkbox', { name: 'Join code on the board' });
	await expect(onShare).not.toBeChecked();
	await share.getByText('Join code on the board', { exact: true }).tap();
	await expect(onShare).toBeChecked();
	await share.getByRole('button', { name: 'Close', exact: true }).tap();
	await expect(corner).toHaveText(codeLine);
});

// Trevor (2026-10-23): the Storyteller's name under the author, in the lower left corner.
test("the board's corner names the Storyteller under the author, when named", async ({ page }) => {
	await startGame(page);
	const corner = page.getByTestId('script-title');
	await expect(corner).toContainText('by The Pandemonium Institute');
	await expect(page.getByTestId('board-storyteller')).toHaveCount(0);
	await nameStoryteller(page, 'Sam');
	await expect(page.getByTestId('board-storyteller')).toHaveText('Storyteller: Sam');
	// The Board preview shows it too.
	await menu(page, 'Board');
	await expect(
		page.getByRole('dialog', { name: 'Settings' }).getByTestId('preview-storyteller')
	).toHaveText('Storyteller: Sam');
});

// Trevor (2026-10-23): "when grim is not main screen, we should blur out for game integrity".
test('the board is blurred behind every sheet and dialog over it', async ({ page }) => {
	await startGame(page);
	const blur = (scope: 'dialog' | 'drawer') =>
		page
			.locator(`[data-scope="${scope}"][data-part="backdrop"]`)
			.last()
			.evaluate((el) => getComputedStyle(el).backdropFilter);
	await openSeat(page, 1);
	expect(await blur('drawer')).toMatch(/^blur\(/);
	await closeSheet(page);
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	expect(await blur('dialog')).toMatch(/^blur\(/);
	await page
		.getByRole('dialog', { name: 'Share' })
		.getByRole('button', { name: 'Close', exact: true })
		.tap();
	// Away from the board, a dialog only dims what is behind it: the page is no longer marked.
	await page.goto('/library');
	await expect(page.locator('html[data-board-shown]')).toHaveCount(0);
});

// Trevor (2026-10-23): starting the night opens the walk-through strip under the board; the
// seats close up to make room, but the tokens keep their size.
test('tokens keep their size when the night walk-through opens', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await closeSheet(page);
	const token = page.getByTestId('seat').first();
	const before = (await token.boundingBox())!.width;
	// The script's logo behind the seats keeps its size too (Trevor, 2026-10-23).
	const logo = page.locator('.board-logo');
	await expect(logo).toBeVisible();
	const logoBefore = (await logo.boundingBox())!;
	await bankNight(page, 'Start game').tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect
		.poll(async () => Math.abs((await token.boundingBox())!.width - before))
		.toBeLessThan(1);
	const logoAfter = (await logo.boundingBox())!;
	expect(Math.abs(logoAfter.width - logoBefore.width)).toBeLessThan(1);
	expect(Math.abs(logoAfter.height - logoBefore.height)).toBeLessThan(1);
});

// Trevor (2026-10-23): "change board look to board preview", and its bank looks like the board's.
test("the Board preview's bank has the board bank's outline and colour", async ({ page }) => {
	await startGame(page);
	const look = (el: Element) => {
		const style = getComputedStyle(el);
		return [style.borderTopWidth, style.borderTopColor, style.borderRadius, style.backgroundColor];
	};
	const board = await page.locator('[data-tray]').evaluate(look);
	await menu(page, 'Board');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog.getByRole('heading', { name: 'Board preview' })).toBeVisible();
	expect(await dialog.getByTestId('preview-bank').evaluate(look)).toEqual(board);
});

// Trevor (2026-10-23): a full screen button on the board, for those who don't know how.
test('the board can go full screen from its toolbar, and back', async ({ page }) => {
	await startGame(page);
	const button = page.getByRole('button', { name: 'Full screen', exact: true });
	await expect(button).toHaveAttribute('aria-pressed', 'false');
	// Its symbol alone, last on the toolbar after ⋯ (Trevor, 2026-10-24).
	await expect(button).toHaveText('');
	await expect(
		page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button').last()
	).toHaveAccessibleName('Full screen');
	await button.tap();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
	await button.tap();
	await expect(button).toHaveAttribute('aria-pressed', 'false');
	expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test("a Traveller's alignment can wait for the night order", async ({ page }) => {
	await startGame(page);
	// A Traveller joins as a new seat: Add seat, then choose them for it.
	await menu(page, 'Add seat');
	await page.getByRole('button', { name: 'Place between Seat 8 and Seat 1' }).tap();
	await openSeat(page, 9);
	await page
		.locator('[data-scope="drawer"][data-part="content"]')
		.getByRole('button', { name: 'Choose' })
		.first()
		.tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 9' })
		.getByRole('button', { name: 'Thief, Recommended', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await expect(seatLabelled(page, 'Seat 9: no name, Thief')).toHaveAttribute(
		'aria-label',
		/alignment not set/
	);
	await closeSheet(page);

	// The night starts by asking for it, after Dusk (core withTravellerAlignmentStep).
	await bankNight(page, 'Start game').tap();
	const strip = page.getByTestId('night-strip');
	await expect(strip.locator('.step .name strong')).toHaveText('Dusk');
	await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(strip.locator('.step .name strong')).toHaveText('Traveller alignment');
	await strip.locator('button.step').tap();
	const step = page.getByRole('dialog', { name: 'Traveller alignment' });
	await step.getByRole('button', { name: 'Evil' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toHaveAccessibleName(
		/evil/
	);
});

test('the cause of death offers only characters that could have killed the player', async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Slayer : the Slayer only kills the Demon.
	await startGame(page);
	for (const [number, name] of [
		[1, 'Slayer'],
		[2, 'Empath'],
		[3, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	let sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	let cause = page.getByRole('dialog', { name: 'Status of Seat 2' });
	await expect(cause.getByRole('button', { name: 'Executed' })).toBeVisible();
	await expect(cause.getByRole('button', { name: 'Slayer' })).toBeHidden();
	// A death always has a cause: there is no "None", and Cancel leaves the player alive.
	await expect(cause.getByRole('button', { name: 'None' })).toHaveCount(0);
	await cause.getByRole('button', { name: 'Cancel' }).tap();
	await expect(sheet.getByRole('button', { name: 'Status: Alive' })).toBeVisible();
	await closeSheet(page);

	sheet = await openSeat(page, 3);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	cause = page.getByRole('dialog', { name: 'Status of Seat 3' });
	await cause.getByRole('button', { name: 'Slayer' }).tap();
	await keepPlaying(page);
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Slayer' })).toBeVisible();
	await closeSheet(page);

	// Dead (Trevor, 2026-10-16): the token dimmed with a badge, which carries the ghost vote.
	// Tapping the badge on the board spends it and gives it back, without opening the seat
	// (Trevor, 2026-10-19). A solid ghost while the vote is there; once used, a grey outline
	// ghost, or struck through when Settings says so (Trevor, 2026-10-19).
	const imp = seatLabelled(page, 'Seat 3:');
	const skull = imp.getByTestId('dead-mark');
	await expect(skull).toBeVisible();
	await expect(skull).toHaveAttribute('data-vote', 'unused');
	await expect(skull.locator('[data-icon="ph:ghost-fill"]')).toBeAttached();
	await skull.tap();
	await expect(skull).toHaveAttribute('data-vote', 'used');
	await expect(skull.locator('[data-icon="ph:ghost"]')).toBeAttached();
	await expect(skull).toHaveAttribute('data-used-look', 'hollow');
	await expect(imp).toHaveAttribute('aria-label', /dead, ghost vote used/);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await menu(page, 'Board');
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings.getByText('Strike through used ghost votes', { exact: true }).tap();
	await expect(skull).toHaveAttribute('data-used-look', 'struck');
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await skull.tap();
	await expect(skull).toHaveAttribute('data-vote', 'unused');
	await expect(seatLabelled(page, 'Seat 2:').getByTestId('dead-mark')).toHaveCount(0);
});

test('the bank fades at an end with more tokens past it, and its captions stay inside the row', async ({
	page
}) => {
	// Trevor (2026-10-19): a cue that more reminders lie to the left or right, and the
	// "Reminders" caption must not show until its line has scrolled clear of the Run night button.
	await startGame(page);
	for (const [number, name] of [
		[1, 'Washerwoman'],
		[2, 'Librarian'],
		[3, 'Investigator'],
		[4, 'Fortune Teller']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	await expect(tray.getByRole('button', { name: 'Red Herring reminder' })).toBeAttached();
	// Seven setup reminders run past the end: that end fades, the start does not.
	await expect(tray).toHaveAttribute('data-more-end', 'true');
	await expect(tray).not.toHaveAttribute('data-more-start');
	const other = page.getByTestId('bank-reminders');
	const inside = async () => {
		const row = (await tray.boundingBox())!;
		if ((await other.count()) === 0) return true;
		const box = (await other.boundingBox())!;
		return box.x + box.width <= row.x + row.width + 1;
	};
	expect(await inside()).toBe(true);

	// Scrolled to the far end: the start fades instead, and the caption sits inside the row.
	await tray.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
	await expect(tray).toHaveAttribute('data-more-start', 'true');
	await expect(tray).not.toHaveAttribute('data-more-end');
	await expect(other).toHaveText('Reminders');
	expect(await inside()).toBe(true);
});

// Trevor (2026-10-22, screenshot): with setup reminders and reminders in the bank, the ∞ sat
// over the Reminders stretch instead of over its own token.
test('the ∞ caption sits over the generic token, wherever the stretches before it end', async ({
	page
}) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Washerwoman'],
		[2, 'Librarian'],
		[3, 'Monk'],
		[4, 'Fortune Teller'],
		[5, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	const caption = page.getByTestId('bank-generic');
	const cell = tray.getByRole('button', { name: 'Generic reminder' });
	await expect
		.poll(async () => {
			const token = (await cell.boundingBox())!;
			// Off the row's end (a phone), the caption waits until it is scrolled into view.
			if ((await caption.count()) === 0) {
				const row = (await tray.boundingBox())!;
				return token.x > row.x + row.width / 2;
			}
			const mark = (await caption.boundingBox())!;
			// From the stretch's line, as the other captions are, so over the token's start.
			return mark.x < token.x + token.width / 2 && mark.x + mark.width > token.x - token.width / 2;
		})
		.toBe(true);
});

test('a dead player whose ability has ended moves their reminders to the end of the bank', async ({
	page
}) => {
	// Trevor (2026-10-19): after Reminders and the ∞ cell, a Dead players stretch. A dead
	// Witch curses no one (https://wiki.bloodontheclocktower.com/Witch); the Sweetheart's
	// drunkenness starts with their death (https://wiki.bloodontheclocktower.com/Sweetheart),
	// so theirs stays with the living.
	await startGame(page, 'Sects & Violets');
	for (const [number, name] of [
		[1, 'Witch'],
		[2, 'Seamstress'],
		[3, 'Sweetheart']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	for (const number of [1, 3]) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
		await page
			.getByRole('dialog', { name: `Status of Seat ${number}` })
			.getByRole('button', { name: 'Executed' })
			.tap();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const last = bank.locator('li.divider').last();
	const after = (name: string) =>
		last.evaluate(
			(line, name) =>
				[...line.parentElement!.children]
					.slice([...line.parentElement!.children].indexOf(line) + 1)
					.some((li) => li.querySelector(`[aria-label="${name}"]`)),
			name
		);
	expect(await after('Cursed reminder')).toBe(true);
	expect(await after('No Ability reminder')).toBe(false);
	expect(await after('Drunk reminder')).toBe(false);
	await bank.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
	const deadCaption = page.getByTestId('bank-dead');
	await expect(deadCaption).toHaveText('Dead players');
	// Over its own one token: past its line, inside the row, clear of the ∞ caption (Trevor,
	// 2026-10-19: it ran into Start game and over the ∞).
	const caption = (await deadCaption.boundingBox())!;
	const line = (await last.boundingBox())!;
	const row = (await bank.boundingBox())!;
	expect(caption.x).toBeGreaterThanOrEqual(line.x);
	expect(caption.x + caption.width).toBeLessThanOrEqual(row.x + row.width + 1);
	const generic = page.getByTestId('bank-generic');
	if (await generic.count()) {
		const mark = (await generic.boundingBox())!;
		expect(mark.x + mark.width).toBeLessThanOrEqual(caption.x + 1);
	}
});

test('the reminder bank holds setup reminders, placed by hand, then every reminder left', async ({
	page
}) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Washerwoman'],
		[2, 'Empath']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	// While setup reminders are waiting, the bank under the board shows them.
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	await expect(tray.getByRole('button', { name: 'Townsfolk reminder' })).toBeVisible();
	await expect(seatLabelled(page, 'Seat 2: no name, Empath')).toHaveAttribute(
		'aria-label',
		'Seat 2: no name, Empath'
	);

	// Tap: why it is needed and which seats fit (https://wiki.bloodontheclocktower.com/Washerwoman).
	await tray.getByRole('button', { name: 'Townsfolk reminder' }).tap();
	const details = page.getByRole('dialog', { name: 'Townsfolk' });
	await details.getByRole('button', { name: 'Place on Seat 2' }).tap();
	await expect(seatLabelled(page, 'Seat 2: no name, Empath, 1 reminder')).toBeAttached();
	await expect(tray.getByRole('button', { name: 'Townsfolk reminder' })).toBeHidden();
	await expect(details).toBeHidden();

	// Drag: any seat will do.
	const wrong = tray.getByRole('button', { name: 'Wrong reminder' });
	const from = (await wrong.boundingBox())!;
	const to = (await page.getByRole('button', { name: /^Seat 4:/ }).boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 1 reminder')).toBeAttached();
	// Every setup reminder placed: the bank now holds every reminder left.
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();

	// Dragged back onto the bank, it waits there again, once confirmed: it normally stays put.
	const placed = page.getByRole('button', { name: 'Wrong reminder' }).first();
	const back = (await placed.boundingBox())!;
	const trayBox = (await page.locator('[data-tray]').boundingBox())!;
	await page.mouse.move(back.x + back.width / 2, back.y + back.height / 2);
	await page.mouse.down();
	await page.mouse.move(trayBox.x + trayBox.width / 2, trayBox.y + trayBox.height / 2, {
		steps: 8
	});
	await page.mouse.up();
	const back2 = page.getByRole('alertdialog', { name: 'Confirm change?' });
	await expect(back2).toContainText(/Now\s*On Seat 4\s*Becomes\s*Back in the reminder bank/);
	await back2.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(seatLabelled(page, 'Seat 4: no name, no character')).toHaveAttribute(
		'aria-label',
		'Seat 4: no name, no character'
	);
	await expect(tray.getByRole('button', { name: 'Wrong reminder' })).toBeVisible();

	// Every reminder still off the board after the setup ones (Trevor, 2026-10-18: no switch).
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await expect(bank.getByRole('button', { name: 'Wrong reminder' })).toHaveCount(1);
	await expect(bank.getByRole('button', { name: 'Townsfolk reminder' })).toHaveCount(0);
	// The setup reminder still to place comes first, left of a line, then the Reminders, then
	// the generic ∞ in its own cell (Trevor, 2026-10-19).
	await expect(bank.locator('li.divider')).toHaveCount(2);
	await expect(bank.locator('li:has(+ li.divider)').first()).toContainText('Wrong');
	await expect(
		bank.locator('li.divider + li').last().getByRole('button', { name: 'Generic reminder' })
	).toBeAttached();
	await expect(page.getByTestId('bank-setup')).toHaveText('Setup');
	await expect(page.getByTestId('bank-reminders')).toHaveText('Reminders');

	// From the seat sheet too: Return to reminder bank.
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Actions for Townsfolk' }).tap();
	const actions = page.getByRole('dialog', { name: 'Townsfolk' });
	await expect(actions).toContainText(/From\s*Washerwoman\s*Seat 1\s*on\s*\S+\s*Seat 2/);
	// In the seat sheet a reminder is just its token, tapped for these actions, delete among
	// them (Trevor, 2026-10-19): no tick box, no owner, no ⋯.
	await expect(actions.getByRole('button', { name: 'Remove reminder' })).toBeVisible();
	const row = sheet.locator('ul.reminders > li').first();
	await expect(row.locator('button')).toHaveCount(1);
	await expect(row.getByTestId('reminder-origin')).toHaveCount(0);
	await actions.getByRole('button', { name: 'Return to reminder bank' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Confirm change?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(seatLabelled(page, 'Seat 2: no name, Empath')).toHaveAttribute(
		'aria-label',
		'Seat 2: no name, Empath'
	);
});

test("a seat's character can be searched by name or ability", async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByRole('searchbox', { name: 'Search characters' }).fill('poison');
	// The Poisoner by its ability; the Washerwoman is filtered out.
	await expect(picker.getByRole('button', { name: 'Poisoner', exact: true })).toBeVisible();
	await expect(picker.getByRole('button', { name: 'Washerwoman', exact: true })).toBeHidden();
	await picker.getByRole('button', { name: 'Poisoner', exact: true }).tap();
	await expect(sheet).toContainText(/Poisoner\s*Minion · Evil · Seat 1/);
});

test('players rotate one seat, or are dragged to a new place in the order', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Ana');
	await closeSheet(page);

	// Rotating is part of arranging: one tap, one place, no confirm.
	await menu(page, 'Arrange seats');
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await toolbar.getByRole('button', { name: 'Rotate players clockwise' }).tap();
	await expect(seatLabelled(page, 'Seat 2: Ana')).toBeAttached();
	// Every name moves with its player, a seat number too (Trevor, 2026-10-22).
	await expect(seatLabelled(page, 'Seat 3: Seat 2')).toBeAttached();
	await toolbar.getByRole('button', { name: 'Rotate players anticlockwise' }).tap();
	await expect(seatLabelled(page, 'Seat 1: Ana')).toBeAttached();

	// Arranging: dropping a seat onto another seat changes the seating order.
	const centre = async (n: number) => {
		const box = (await page
			.getByRole('button', { name: new RegExp(`^Seat ${n}:`) })
			.boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	const from = await centre(1);
	const to = await centre(4);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 4 });
	await page.mouse.up();
	await expect(seatLabelled(page, 'Seat 4: Ana')).toBeAttached();
	await toolbar.getByRole('button', { name: 'Done' }).tap();

	await menu(page, 'History');
	const history = page.getByRole('dialog', { name: 'History' });
	await expect(history).toContainText('Ana moved to seat 4');
	await expect(history).toContainText('Rotated the seats clockwise');
	await page.keyboard.press('Escape');
	await openSeat(page, 4);
	await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible();
});

test("every button in the More menu has an edge, and End game is red with the buttons' text", async ({
	page
}) => {
	// Trevor, 2026-10-22: End game's red text was hard to read, and buttons matched the
	// surface behind them. Edges reach 3:1 (WCAG 1.4.11); the label keeps the buttons' colour.
	await startGame(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const grimoireMenu = page.getByRole('dialog', { name: 'Grimoire' });
	const end = grimoireMenu.getByRole('button', { name: 'End game' });
	const other = grimoireMenu.getByRole('button', { name: 'Board', exact: true });
	await expect(end).toBeVisible();
	const look = (button: Locator) =>
		button.evaluate((el) => {
			const rgb = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
			const lum = (css: string) => {
				const [r, g, b] = rgb(css).map((v) => {
					const c = v / 255;
					return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
				});
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			};
			const ratio = (a: string, b: string) => {
				const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
				return (hi + 0.05) / (lo + 0.05);
			};
			const style = getComputedStyle(el);
			// The dialog panel behind the button.
			let panel = el.parentElement;
			while (panel && getComputedStyle(panel).backgroundColor === 'rgba(0, 0, 0, 0)')
				panel = panel.parentElement;
			const surface = panel ? getComputedStyle(panel).backgroundColor : 'rgb(0, 0, 0)';
			const edge = style.boxShadow.match(/rgba?\([^)]*\)/)?.[0] ?? style.backgroundColor;
			return {
				fill: style.backgroundColor,
				text: style.color,
				edge: ratio(edge, surface),
				label: ratio(
					style.color,
					style.backgroundColor === 'rgba(0, 0, 0, 0)' ? surface : style.backgroundColor
				)
			};
		});
	const ended = await look(end);
	const board = await look(other);
	const [r, g, b] = (ended.fill.match(/\d+/g) ?? []).map(Number);
	expect(r).toBeGreaterThan(g * 2);
	expect(r).toBeGreaterThan(b * 2);
	expect(ended.text).toBe(board.text);
	expect(ended.label).toBeGreaterThanOrEqual(4.5);
	for (const button of [ended, board]) expect(button.edge).toBeGreaterThanOrEqual(3);
	await end.scrollIntoViewIfNeeded();
	await grimoireMenu.screenshot({ path: `test-results/more-menu-${test.info().project.name}.png` });
	await end.tap();
	await page
		.getByRole('alertdialog', { name: 'End game?' })
		.screenshot({ path: `test-results/end-game-${test.info().project.name}.png` });
});

test('the game toolbar opens the app menu; leaving the game asks first and keeps it', async ({
	page
}) => {
	await startGame(page);
	const board = page.url();
	// Exit game is gone from More: leaving is through the app's menu (Trevor, 2026-10-16).
	await page.getByRole('button', { name: 'More' }).tap();
	const grimoireMenu = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(grimoireMenu.getByRole('button', { name: 'Exit game' })).toHaveCount(0);
	await expect(grimoireMenu.getByRole('button', { name: 'End game' })).toBeVisible();
	await page.keyboard.press('Escape');

	// Settings open over the board, so the game is never left.
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	const drawer = page.getByRole('dialog', { name: APP_NAME });
	await drawer.getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await expect(settings).toBeVisible();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(page).toHaveURL(board);

	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await drawer.getByRole('link', { name: 'Search' }).tap();
	const leave = page.getByRole('alertdialog', { name: 'Leave the game?' });
	await expect(leave).toContainText('Trouble Brewing');
	await leave.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page).toHaveURL(board);

	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await drawer.getByRole('link', { name: 'Resume game' }).tap();
	await leave.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page).toHaveURL(/\/games$/);
	await expect(page.getByRole('link', { name: /Trouble Brewing.*8 seats/ }).first()).toBeVisible();
});

test('copies of a reminder are picked one by one, or stacked with a count', async ({ page }) => {
	await startGame(page, 'Bad Moon Rising');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Shabaloth', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	const shabaloth = picker.getByRole('group', { name: 'Shabaloth' });
	// TPI's data gives the Shabaloth two "Dead" tokens: each is its own chip.
	await expect(shabaloth.getByRole('button', { name: /^Dead, copy/ })).toHaveCount(2);
	await shabaloth.getByRole('button', { name: 'Dead, copy 1 of 2' }).tap();
	// A Dead token on a living player asks whether to mark them dead; not here.
	await page
		.getByRole('alertdialog', { name: /^Mark .* dead\?$/ })
		.getByRole('button', { name: 'Cancel', exact: true })
		.tap();
	// The placed copy shows as on this seat: tapping it again would take it off.
	await expect(shabaloth.getByRole('button', { name: 'Dead, copy 2 of 2' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(shabaloth.getByRole('button', { name: 'Dead, copy 1 of 2' })).toBeEnabled();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);

	// With "Stack duplicate reminders" on, they show as one token with what is left.
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board' })
		.tap();
	await settings.getByText('Stack duplicate reminders', { exact: true }).tap();
	await expect(
		settings.getByRole('checkbox', { name: 'Stack duplicate reminders', includeHidden: true })
	).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(settings).toBeHidden();
	const again = await openSeat(page, 1);
	await again.getByRole('button', { name: 'Add reminder' }).tap();
	await expect(shabaloth.getByRole('button', { name: /^Dead/ })).toHaveCount(1);
	await expect(shabaloth.getByRole('button', { name: 'Dead, 1 left' })).toBeEnabled();
});

test('the board background can be an image from the device, kept after a reload', async ({
	page
}) => {
	await startGame(page);
	// The official script's name and author, in the lower left corner only (Trevor, 2026-10-18).
	await expect(page.locator('.corner-title')).toContainText('Trouble Brewing');
	await expect(page.locator('.corner-title')).toContainText('by The Pandemonium Institute');
	await expect(page.locator('.watermark, .toolbar-title')).toHaveCount(0);

	// Background is set in Board, the one way in (Trevor, 2026-10-18).
	await expect(page.getByRole('button', { name: 'Background', exact: true })).toHaveCount(0);
	await menu(page, 'Board');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog.getByTestId('background-now')).toHaveText('None (plain board)');
	await expect(dialog.getByRole('button', { name: 'No script background' })).toBeDisabled();
	// A 2×2 PNG, as if picked from the photo library.
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNoUFAAIgYIBQAWjgMBwmTFJwAAAABJRU5ErkJggg==',
		'base64'
	);
	await dialog
		.getByLabel('Background image file')
		.setInputFiles({ name: 'table.png', mimeType: 'image/png', buffer: png });
	// It stays open, so several can be tried (Trevor, 2026-10-17).
	await expect(dialog.getByTestId('background-now')).toHaveText('Your image, for this game');
	await dialog.getByRole('button', { name: 'Close' }).tap();
	const backdrop = page.getByTestId('board-background');
	await expect(backdrop).toHaveAttribute('style', /blob:/);
	await expect(page.getByTestId('vignette')).toBeAttached();
	// A change to the game keeps the same image: a new link for it flashed the board as it
	// loaded again, e.g. on a ghost vote (Trevor, 2026-10-23).
	const image = await backdrop.getAttribute('style');
	const node = await backdrop.elementHandle();
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Ana');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Ana' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: Ana')).toBeAttached();
	// Starting the night too, as the seats close up for the walk-through (Trevor, 2026-10-23).
	const box = await backdrop.boundingBox();
	await bankNight(page, 'Start game').tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect(backdrop).toHaveAttribute('style', image!);
	expect(await backdrop.boundingBox()).toEqual(box);
	expect(await node!.evaluate((el) => el.isConnected)).toBe(true);

	await page.reload();
	await expect(page.getByTestId('board-background')).toHaveAttribute('style', /blob:/);
	await menu(page, 'Board');
	await expect(dialog.getByTestId('background-now')).toHaveText('Your image, for this game');
	await expect(dialog).not.toContainText('never uploaded');
	// None is the first in the list (Trevor, 2026-10-18).
	const none = dialog
		.getByRole('group', { name: 'Background', exact: true })
		.getByRole('button')
		.first();
	await expect(none).toHaveAccessibleName('None');
	await none.tap();
	await expect(page.getByTestId('board-background')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();

	// Built-in backgrounds, drawn in CSS (Trevor, 2026-10-16), kept after a reload.
	await menu(page, 'Board');
	await dialog
		.getByRole('group', { name: 'Background', exact: true })
		.getByRole('button', { name: 'Green felt' })
		.tap();
	await expect(page.getByTestId('board-background')).toHaveAttribute('data-preset', 'felt');
	// The whole screen, under the toolbar too (Trevor, 2026-10-18).
	const viewport = page.viewportSize()!;
	expect(await page.getByTestId('board-background').boundingBox()).toEqual({
		x: 0,
		y: 0,
		width: viewport.width,
		height: viewport.height
	});
	// The board's looks are here too, the same values as in Settings (Trevor, 2026-10-17).
	await expect(page.getByTestId('vignette')).toBeAttached();
	await dialog.getByText('Vignette', { exact: true }).tap();
	await expect(page.getByTestId('vignette')).toHaveCount(0);
	// Always shown, with no switch (Trevor, 2026-10-23).
	await expect(dialog.getByText('Script name on the board', { exact: true })).toHaveCount(0);
	await expect(page.locator('.corner-title')).toContainText('Trouble Brewing');
	// One place only (Trevor, 2026-10-18): no choice of where.
	await expect(dialog.getByRole('combobox', { name: 'Script name', exact: true })).toHaveCount(0);
	// The player name badge size is an option (Trevor, 2026-10-17), live on the board. It is
	// set in Tokens, with the character token (Trevor, 2026-10-20).
	await expect(dialog.getByRole('slider', { name: 'Player name size' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await menu(page, 'Tokens');
	const nameSize = dialog.getByRole('slider', { name: 'Player name size' });
	await nameSize.fill('1.4');
	await expect(nameSize).toHaveAttribute('aria-valuetext', '140%');
	const nameWidth = () =>
		page
			.getByTestId('seat')
			.first()
			.evaluate(
				(el) =>
					el.querySelector('[data-testid="token-player-name"]')?.getBoundingClientRect().width ?? 0
			);
	const bigger = await nameWidth();
	await nameSize.fill('0.6');
	await expect.poll(nameWidth).toBeLessThan(bigger);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await page.reload();
	await expect(page.getByTestId('board-background')).toHaveAttribute('data-preset', 'felt');
	await expect(page.getByTestId('vignette')).toHaveCount(0);

	// The board and token settings open over the board from its menu (Trevor, 2026-10-17).
	await menu(page, 'Board');
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await expect(settings.getByRole('heading', { name: 'Board', level: 2 })).toBeVisible();
	// Only that section, with no way back into the full Settings list (Trevor, 2026-10-17).
	await expect(settings.getByRole('navigation', { name: 'Settings sections' })).toHaveCount(0);
	await expect(settings.getByRole('button', { name: 'All settings' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(settings).toBeHidden();
	// Tokens has its own menu item, beside Board (Trevor, 2026-10-18).
	await menu(page, 'Tokens');
	await expect(settings.getByRole('heading', { name: 'Tokens', level: 2 })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(settings).toBeHidden();
	await expect(page.getByTestId('board-background')).toBeVisible();
	// The app's own Settings still lists every section.
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
	await expect(settings.getByRole('navigation', { name: 'Settings sections' })).toBeAttached();
});

test('info tokens open from the toolbar and show player cards at once', async ({ page }) => {
	await startGame(page);
	await page.getByRole('button', { name: 'Info tokens' }).tap();
	// The Storyteller points at the players (Trevor, 2026-10-16), so nothing is asked first.
	await page.getByRole('button', { name: 'This is the Demon', exact: true }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('This is the Demon');
	await shown.getByRole('button', { name: 'Close' }).tap();
	// No bluffs yet: "not in play" opens the bluffs sheet.
	await page.getByRole('button', { name: 'These characters are not in play', exact: true }).tap();
	await expect(page.getByTestId('bluff-set')).toHaveCount(1);
});

test('a night step is filled in with help, and the night can be walked through', async ({
	page
}) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Poisoner'],
		[2, 'Empath']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}

	// Tap a step: TPI's text, its reminder placed on a chosen seat, then its X closes it.
	const guide = await openStep(page, 'Poisoner');
	await expect(guide).toContainText('Seat 1');
	await expect(guide).toContainText('Not placed');
	await guide.getByRole('button', { name: 'Place' }).tap();
	// Each row: the seat's number, its character once (the in-line badge), then the player
	// (Trevor, 2026-10-20).
	const row = page
		.getByRole('dialog', { name: 'Put Poisoned on' })
		.getByRole('button', { name: /Empath Seat 2/ });
	await expect(row).toHaveText(/^2\s*Empath\s*Seat 2$/);
	await expect(row.locator('img')).toHaveCount(1);
	await row.tap();
	await expect(guide).toContainText('On Seat 2');
	// It can go back to the reminder bank from here (Trevor, 2026-10-17), then be placed again.
	await guide.getByRole('button', { name: 'Return Poisoned to the reminder bank' }).tap();
	await expect(guide).toContainText('Not placed');
	await expect(
		guide.getByRole('button', { name: 'Return Poisoned to the reminder bank' })
	).toBeDisabled();
	await guide.getByRole('button', { name: 'Place' }).tap();
	await page
		.getByRole('dialog', { name: 'Put Poisoned on' })
		.getByRole('button', { name: /Empath Seat 2/ })
		.tap();
	await expect(guide).toContainText('On Seat 2');

	// Info tokens and Show to player (an eye) sit beside the X, with no Done (Trevor,
	// 2026-10-20), and open over the step, which stays open under them.
	await expect(guide.getByRole('button', { name: 'Done' })).toHaveCount(0);
	const head = guide.locator('.head-actions');
	await expect(head.getByRole('button', { name: 'Info tokens' })).toBeVisible();
	await expect(head.getByRole('button', { name: 'Show to player' })).toBeVisible();
	await head.getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await shown.locator('.close button').tap();
	await expect(guide).toBeVisible();
	await head.getByRole('button', { name: 'Info tokens' }).tap();
	const info = page.getByRole('dialog', { name: 'Info tokens' });
	await expect(info).toBeVisible();
	// The step is still open under the sheet.
	await expect(page.locator('[role="group"][aria-label="Night step"]')).toBeAttached();
	await page.getByRole('button', { name: 'This is the Demon', exact: true }).tap();
	await shown.locator('.close button').tap();
	await expect(info).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(info).toBeHidden();
	await expect(guide).toBeVisible();

	await guide.getByRole('button', { name: 'Close' }).tap();
	await expect(seatLabelled(page, 'Seat 2: no name, Empath, 1 reminder')).toBeAttached();

	// Walk through: one step at a time under the board, with Previous and Next.
	const strip = page.getByTestId('night-strip');
	const count = strip.locator('.count');
	await walkTo(page, 'Poisoner');
	const at = await count.textContent();
	await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(count).not.toHaveText(at!);
	const after = await count.textContent();
	// A reload (or an app update) keeps the walk-through where it was (Trevor, 2026-10-16).
	await page.reload();
	await expect(count).toHaveText(after!);
	await strip.getByRole('button', { name: 'Previous step' }).tap();
	await expect(count).toHaveText(at!);
	// The step's reminder already on the board is ringed too (Trevor, 2026-10-18).
	for (let i = 0; i < 10 && !(await strip.textContent())?.includes('Poisoner'); i++)
		await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(
		page.locator('.chip-slot.now').getByRole('button', { name: 'Poisoned reminder' })
	).toBeVisible();
	await strip.getByRole('button', { name: 'Stop the walk-through' }).tap();
	await expect(strip).toHaveCount(0);
	await expect(page.locator('.chip-slot.now')).toHaveCount(0);

	// A step shows the game state that matters: the Empath is poisoned (core nightStepAlerts).
	// In its own Afflictions section, not at the top (Trevor, 2026-10-17).
	const empath = await openStep(page, 'Empath');
	await expect(empath.getByTestId('step-afflictions')).toContainText(
		/Poisoned\s*Empath\s*Seat 2\s*by\s*Poisoner\s*Seat 1/
	);
	await expect(empath.getByTestId('night-alerts')).toHaveCount(0);
	await empath.getByRole('button', { name: 'Close' }).tap();

	// Next stops at the last step; End night goes on into the day, where its announcements are
	// (Trevor, 2026-10-18).
	const nextStep = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && !(await lastStep(strip)); i++) await nextStep.tap();
	expect(await lastStep(strip)).toBe(true);
	await endNight(page);
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await expect(strip).toHaveCount(0);
});

test('moving a reminder that normally stays put asks first, saying why', async ({ page }) => {
	await startGame(page);
	// Tokens given out by hand, so any player may secretly be the Drunk.
	const other = await openSeat(page, 2);
	await other.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 2' })
		.getByRole('button', { name: 'Chef', exact: true })
		.tap();
	await closeSheet(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	await picker.getByRole('group', { name: 'Drunk' }).getByRole('button').first().tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await sheet.getByRole('button', { name: 'Actions for Is The Drunk' }).tap();
	await page
		.getByRole('dialog', { name: 'Is The Drunk' })
		.getByRole('button', { name: 'Move to another seat' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Move Is The Drunk to' })
		.getByRole('button', { name: /^3/ })
		.tap();
	const confirm = page.getByRole('alertdialog', { name: 'Confirm change?' });
	await expect(confirm).toContainText(/Drunk.*'s\s*Is The Drunk\s*reminder/);
	await expect(confirm).toContainText('Marks which player is the Drunk.');
	await expect(confirm).toContainText(/Now\s*On Seat 1\s*Becomes\s*On Seat 3/);
	await confirm.getByRole('button', { name: 'Cancel' }).tap();
	await expect(seatLabelled(page, 'Seat 1: no name, no character, 1 reminder')).toBeAttached();

	await sheet.getByRole('button', { name: 'Actions for Is The Drunk' }).tap();
	await page
		.getByRole('dialog', { name: 'Is The Drunk' })
		.getByRole('button', { name: 'Move to another seat' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Move Is The Drunk to' })
		.getByRole('button', { name: /^3/ })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'Confirm change?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
});

test('the Apprentice gains a Townsfolk ability and is marked "Is The Apprentice"', async ({
	page
}) => {
	await startGame(page);
	await menu(page, 'Add seat');
	await page.getByRole('button', { name: 'Place between Seat 8 and Seat 1' }).tap();
	await openSeat(page, 9);
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 9' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Apprentice', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Good' }).tap();
	await seatMenu(page, sheet, 'Gained ability…');
	const gains = page.getByRole('dialog', { name: 'Ability Seat 9 gains' });
	// Good, so only Townsfolk are offered.
	await expect(gains.getByRole('button', { name: 'Poisoner', exact: true })).toHaveCount(0);
	await gains.getByRole('button', { name: 'Monk', exact: true }).tap();
	await expect(seatLabelled(page, 'Seat 9: no name, Monk, 1 reminder')).toBeAttached();
	await expect(sheet.getByRole('button', { name: 'Actions for Is The Apprentice' })).toBeVisible();
});

test("a Traveller's alignment can be drawn from face-down tokens", async ({ page }) => {
	await startGame(page);
	await menu(page, 'Add seat');
	await page.getByRole('button', { name: 'Place between Seat 8 and Seat 1' }).tap();
	const sheet = await openSeat(page, 9);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 9' })
		.getByRole('button', { name: 'Thief, Recommended', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await closeSheet(page);

	const step = await openStep(page, 'Traveller alignment');
	await step.getByRole('button', { name: 'Draw' }).tap();
	// The Storyteller sets 4 tokens, none evil: the player still picks one.
	const draw = page.getByRole('dialog', { name: 'Alignment draw' });
	await expect(draw.getByLabel('Tokens', { exact: true })).toHaveText('4');
	await draw.getByRole('button', { name: 'Fewer evil' }).tap();
	await expect(draw.getByLabel('Evil tokens')).toHaveText('0');
	await draw.getByRole('button', { name: 'Confirm' }).tap();
	const pick = page.getByRole('dialog', { name: 'Choose a token' });
	// The counts are not shown to the player.
	await expect(pick).not.toContainText('Evil');
	await expect(pick).not.toContainText('%');
	await pick.getByRole('button', { name: 'Token 3' }).tap();
	const shown = page.getByRole('dialog', { name: 'Good' });
	await expect(shown.getByRole('button', { name: 'Token 3: Good' })).toBeVisible();
	await shown.getByRole('button', { name: 'Done' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toHaveAccessibleName(
		/good/
	);
});

// Trevor, 2026-10-19: a Traveller joining can draw their alignment straight away, and the
// Storyteller sees each side's chance and their mix of tokens is remembered on the device.
test('a joining Traveller draws their alignment, with the last mix remembered', async ({
	page
}) => {
	await startGame(page);
	for (const [number, after, name] of [
		[9, 8, 'Thief'],
		[10, 9, 'Beggar']
	] as const) {
		await menu(page, 'Add seat');
		await page.getByRole('button', { name: `Place between Seat ${after} and Seat 1` }).tap();
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name: `${name}, Recommended`, exact: true })
			.tap();
		await page
			.getByRole('dialog', { name: 'Alignment' })
			.getByRole('button', { name: 'Draw' })
			.tap();
		const draw = page.getByRole('dialog', { name: 'Alignment draw' });
		if (number === 9) {
			// Each side's chance is shown to the Storyteller.
			await expect(draw.getByTestId('evil-chance')).toHaveText('Evil 1 · 25%');
			await expect(draw.getByTestId('good-chance')).toHaveText('Good 3 · 75%');
			// All evil: the player still feels they chose.
			for (let n = 1; n < 4; n++) await draw.getByRole('button', { name: 'More evil' }).tap();
		}
		await expect(draw.getByTestId('evil-chance')).toHaveText('Evil 4 · 100%');
		await expect(draw.getByTestId('good-chance')).toHaveText('Good 0 · 0%');
		await expect(draw.getByLabel('Evil tokens')).toHaveText('4');
		await draw.getByRole('button', { name: 'Confirm' }).tap();
		await page
			.getByRole('dialog', { name: 'Choose a token' })
			.getByRole('button', { name: 'Token 1' })
			.tap();
		const shown = page.getByRole('dialog', { name: 'Evil' });
		await shown.getByRole('button', { name: 'Done' }).tap();
		await expect(
			page.getByRole('button', { name: new RegExp(`^Seat ${number}: no name, ${name}`) })
		).toHaveAccessibleName(/evil/);
	}
});

test("the Undertaker's step suggests the executed player's character", async ({ page }) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Undertaker'],
		[2, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	// The first night ends; Seat 2 is executed on Day 1
	// (https://wiki.bloodontheclocktower.com/Undertaker).
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await endNight(page);
	// The day opens after End night; the execution is marked on the board (Trevor, 2026-10-20).
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();
	const executed = await openSeat(page, 2);
	await executed.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 2' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	// During the day, Executed asks as the day's Execution does (Trevor, 2026-10-23).
	await page
		.getByRole('alertdialog', { name: 'End the day?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await keepPlaying(page);

	const suggested = (await openStep(page, 'Undertaker')).getByTestId('night-suggested');
	await expect(suggested.locator('[data-character-id="imp"]').first()).toBeVisible();
	await page.screenshot({ path: `test-results/undertaker-${test.info().project.name}.png` });
	// A section under its own heading, not a box (Trevor, 2026-10-19).
	await expect(suggested).toHaveAccessibleName('Valid Information');
	await expect(suggested.getByRole('heading', { name: 'Valid Information' })).toBeVisible();
	await expect(suggested).toHaveCSS('border-top-style', 'none');
	// Whoever it names shows with their character (Trevor, 2026-10-17).
	await expect(suggested.locator('.because')).toContainText('Seat 2');
	await expect(suggested.locator('.because [data-character-id="imp"]').first()).toBeVisible();
	// The logic behind it, beside it with no Why button (Trevor, 2026-10-22): the executed
	// player and their true character.
	await expect(suggested.getByRole('button', { name: 'Why' })).toHaveCount(0);
	const why = suggested.getByTestId('why-facts');
	await expect(why).toContainText('Seat 2');
	await expect(why.locator('[data-character-id="imp"]')).toBeVisible();
	await suggested.getByRole('button', { name: 'Show to player' }).tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toContainText('Imp');
});

test('a character is taken away with None in Change character', async ({ page }) => {
	await startGame(page, 'Bad Moon Rising');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Sailor', exact: true })
		.tap();
	// No separate Remove character (Trevor, 2026-10-17): None is the first choice.
	await seatMenu(page, sheet, 'Change character');
	await page.getByRole('dialog', { name: 'Character for Seat 1' }).getByTestId('picker-none').tap();
	await page
		.getByRole('alertdialog', { name: 'Remove character?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, no character')).toBeAttached();
});

test('a met game end condition offers End game, listing every outcome', async ({ page }) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Saint'],
		[2, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	// Executions are marked on the board (Trevor, 2026-10-20).
	const execute = async (seat: number) => {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
		await page
			.getByRole('dialog', { name: `Status of Seat ${seat}` })
			.getByRole('button', { name: 'Executed' })
			.tap();
	};
	// The Saint executed: its team loses (https://wiki.bloodontheclocktower.com/Saint).
	await execute(1);
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	await expect(prompt.getByTestId('game-end-prompt')).toContainText('Evil wins');
	await expect(
		prompt.locator('[data-rule="executed-loses"] [data-character-id="saint"]')
	).toBeVisible();
	await expect(prompt.getByRole('combobox', { name: 'Winner' })).toContainText('Evil');
	// How it ended is preselected from the grimoire (Trevor, 2026-10-18), for History's stats.
	await expect(prompt.getByRole('combobox', { name: 'How it ended' })).toContainText('Saint');
	await page.screenshot({ path: `test-results/game-end-${test.info().project.name}.png` });
	// A recommendation: Cancel keeps playing, and the same condition doesn't ask again.
	await prompt.getByRole('button', { name: 'Cancel' }).tap();
	await expect(prompt).toBeHidden();
	await closeSheet(page);
	// The Demon dies too: both outcomes are listed and the Storyteller picks the winner.
	await execute(2);
	await expect(prompt.locator('[data-rule]')).toHaveCount(2);
	await expect(prompt.locator('[data-rule="demon-dead"]')).toContainText('Good wins');
	await expect(prompt.getByRole('combobox', { name: 'Winner' })).toContainText('Not recorded');
	await expect(prompt.getByRole('combobox', { name: 'How it ended' })).toBeDisabled();
	await prompt.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await expect(prompt.getByRole('combobox', { name: 'How it ended' })).toContainText('Demon died');
	await prompt.getByRole('button', { name: 'Confirm' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
});

test("the Demon executed with a living Mastermind doesn't offer End game", async ({ page }) => {
	await startGame(page, 'Bad Moon Rising');
	for (const [number, name] of [
		[1, 'Pukka'],
		[2, 'Mastermind']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	// The execution is marked on the board (Trevor, 2026-10-20).
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	const status = page.getByRole('dialog', { name: 'Status of Seat 1' });
	await status.getByRole('button', { name: 'Executed' }).tap();
	// The Mastermind plays one more day (https://wiki.bloodontheclocktower.com/Mastermind).
	await expect(status).toBeHidden();
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
	await expect(page.getByRole('alertdialog', { name: 'End game?' })).toHaveCount(0);
});

test('End game keeps the Storyteller on the board, says it is over, and can be reopened', async ({
	page
}) => {
	await startGame(page);
	const board = page.url();
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Ana');
	await closeSheet(page);
	await menu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await expect(end).toContainText(/Now\s*In Resume game\s*Becomes\s*Ended, in History/);
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Evil', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// Still on the board (Trevor, 2026-10-17), which says the game is over.
	expect(page.url()).toBe(board);
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Evil won');
	// Ended games are listed apart from Resume game (Trevor, 2026-10-16), and open to look
	// around in without being reopened (Trevor, 2026-10-17).
	await page.goto('/history');
	const listed = page
		.getByRole('region', { name: 'Games' })
		.getByRole('link', { name: /Trouble Brewing\s*Evil won/ });
	await listed.tap();
	await expect(page).toHaveURL(board);
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Evil won');
	// History only shows the board at an earlier point; the saved game stays as it ended.
	await menu(page, 'History');
	const history = page.getByRole('dialog', { name: 'History' });
	await history.getByRole('button', { name: 'Show' }).last().tap();
	await expect(page.getByTestId('game-over')).toContainText('Shown from History');
	await expect(seatLabelled(page, 'Seat 1: Ana')).toHaveCount(0);
	await page.goto('/games');
	await expect(page.getByRole('link', { name: /Trouble Brewing/ })).toHaveCount(0);
	await page.goto(board);
	await expect(seatLabelled(page, 'Seat 1: Ana')).toHaveCount(1);
	// Previous and Next step through History on the board itself, in the reminder bank's
	// place (Trevor, 2026-10-18).
	const steps = page.getByTestId('history-strip');
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toHaveCount(0);
	await expect(steps.getByRole('button', { name: 'Next change' })).toBeDisabled();
	await expect(steps).toContainText(/(\d+) of \1.*Ana/);
	await steps.getByRole('button', { name: 'Previous change' }).tap();
	await expect(seatLabelled(page, 'Seat 1: Ana')).toHaveCount(0);
	await expect(page.getByTestId('game-over')).toContainText('Shown from History');
	// Read-only: nothing pops up in the middle (Trevor, 2026-10-18), and the game over line
	// sits in History's strip, out of the circle, so ending moves nothing (2026-10-24).
	await expect(page.getByRole('button', { name: 'Set up' })).toHaveCount(0);
	const over = (await page.getByTestId('game-over').boundingBox())!;
	const strip = (await steps.boundingBox())!;
	expect(over.y).toBeGreaterThanOrEqual(strip.y);
	expect(over.y + over.height).toBeLessThanOrEqual(strip.y + strip.height + 1);
	expect(over.y).toBeGreaterThanOrEqual(
		(await page.locator('.board').boundingBox())!.y +
			(await page.locator('.board').boundingBox())!.height
	);
	await steps.getByRole('button', { name: 'Next change' }).tap();
	await expect(seatLabelled(page, 'Seat 1: Ana')).toHaveCount(1);
	await expect(steps.getByRole('button', { name: 'Next change' })).toBeDisabled();
	// Changes are refused until the game is reopened.
	await nameSeat(await openSeat(page, 1), 'Bo');
	await expect(page.getByText('The game is over. Reopen it to change it.')).toBeVisible();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: Ana')).toHaveCount(1);

	// Reopening from the board puts it back in Resume game.
	await page.getByTestId('game-over').tap();
	await page
		.getByRole('alertdialog', { name: 'Reopen game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(page.getByTestId('game-over')).toHaveCount(0);
	await page.goto('/games');
	await expect(page.getByRole('link', { name: /Trouble Brewing.*Setting up/ })).toBeVisible();
});

test('History shows stats from ended games', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Scarlet Woman', exact: true })
		.tap();
	await closeSheet(page);
	await nameStoryteller(page, 'Sam');
	await menu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	// Nothing in the grimoire gave good the win, so it's the Storyteller's call until they
	// say how; the Mayor is on the script (https://wiki.bloodontheclocktower.com/Mayor).
	const how = end.getByRole('combobox', { name: 'How it ended' });
	await expect(how).toContainText('Other');
	await how.tap();
	await page.getByRole('option', { name: 'Mayor', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// End game stays on the board (Trevor, 2026-10-17); History is in the sidebar.
	await expect(page.getByTestId('game-over')).toBeVisible();
	await page.goto('/history');
	const summary = page.getByRole('region', { name: 'Summary' });
	await expect(summary).toContainText(
		/Games\s*1\s*Good won\s*1\s*\(100%\)\s*Evil won\s*0\s*\(0%\)/
	);
	// How games end (Trevor, 2026-10-18): alternate wins and the final 3, each with its share.
	await expect(summary).toContainText(/Alternate wins\s*1\s*\(100%\)/);
	await expect(summary).toContainText(/Final 3\s*\d+\s*\(\d+%\)/);
	await expect(summary).toContainText(/Final 3, good won\s*\d+\s*\((\d+%|None)\)/);
	const scripts = page.getByTestId('history-scripts');
	await expect(scripts).toContainText(/Trouble Brewing/);
	// Who ran each game (Trevor, 2026-10-19: the Storyteller's name).
	await expect(page.getByTestId('history-storytellers')).toContainText(/Sam\s*1\s*1\s*0/);
	// A long name stays inside its badge, even in a phone's narrow column (Trevor, 2026-10-18:
	// names ran out of their badges over the next column).
	const badge = page
		.getByTestId('history-characters')
		.locator('[data-character-id="scarletwoman"]');
	await expect(badge).toContainText('Scarlet Woman');
	const name = badge.locator('.name');
	expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	// Header filters narrow a table (Trevor, 2026-10-16: filters live in the header row).
	await scripts.getByRole('button', { name: /Filter Script/ }).tap();
	await page.getByRole('searchbox', { name: 'Filter Script' }).fill('violets');
	await page.keyboard.press('Enter');
	await expect(scripts).toContainText('None match.');
	// The old address still works.
	await page.goto('/previous-games');
	await expect(page).toHaveURL(/\/history$/);
});

/** Ends a game as an Evil win, with the Imp in Seat 1 and a private note on that seat. */
async function endWithNote(page: Page) {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await closeSheet(page);
	await menu(page, 'Notes');
	await page.getByRole('button', { name: 'Notes for Seat 1: None' }).tap();
	const notes = page.getByRole('dialog', { name: 'Note: Seat 1' });
	await notes.getByRole('textbox').tap();
	await page.keyboard.type('Secret word: lantern');
	await notes.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);
	await menu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Evil', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();
}

test('a finished game exports as a recap file and a grimoire image', async ({ page }) => {
	await endWithNote(page);

	// Trevor, 2026-10-19: the history log, the final grimoire and the Storyteller's notes.
	await menu(page, 'Export game');
	const dialog = page.getByRole('dialog', { name: 'Export game' });
	const read = async (button: string) => {
		const download = page.waitForEvent('download');
		await dialog.getByRole('button', { name: button, exact: true }).tap();
		const file = await download;
		const path = `test-results/export-${test.info().project.name}-${file.suggestedFilename()}`;
		await file.saveAs(path);
		return { name: file.suggestedFilename(), text: readFileSync(path, 'utf8') };
	};
	const recap = await read('Download');
	expect(recap.name).toMatch(/^trouble-brewing-.*\.html$/);
	expect(recap.text).toContain('Evil won');
	expect(recap.text).toContain('Imp');
	expect(recap.text).toContain('Secret word: lantern');
	expect(recap.text).toContain('Storyteller: None');
	expect(recap.text).toMatch(/<img src="data:image\/png;base64,/);
	// Each part can be left out: private notes stay off a copy for others.
	await dialog.getByText('Storyteller notes', { exact: true }).tap();
	expect((await read('Download')).text).not.toContain('Secret word: lantern');
	const image = await read('Image');
	expect(image.name).toBe('trouble-brewing.png');
	await page.keyboard.press('Escape');

	// The same from History.
	await page.goto('/history');
	await page.getByRole('button', { name: /^Export Trouble Brewing ended/ }).tap();
	await expect(page.getByRole('dialog', { name: 'Export game' })).toBeVisible();
});

test("a finished game is shared to the players' phones, without the notes", async ({
	page,
	context
}) => {
	await endWithNote(page);
	await menu(page, 'Export game');
	await page
		.getByRole('dialog', { name: 'Export game' })
		.getByRole('button', { name: 'Share', exact: true })
		.tap();
	// Trevor, 2026-10-19: "if the storyteller allows (allow them to denote what information
	// to share)". The notes start off.
	const dialog = page.getByRole('dialog', { name: 'Share with players' });
	await expect(dialog.getByRole('checkbox', { name: 'Storyteller notes' })).not.toBeChecked();
	await dialog.getByRole('button', { name: 'Share', exact: true }).tap();
	const link = dialog.getByTestId('share-url');
	await expect(link).toHaveValue(/\/recap\/[\w-]{22}$/);
	const url = await link.inputValue();
	// The script's logo sits in the middle of the QR code (Trevor, 2026-10-19).
	const qr = dialog.getByRole('img', { name: 'QR code for the game recap' });
	await expect(qr.getByTestId('script-logo')).toHaveAttribute('data-logo', '/data/logos/tb.webp');

	// A player's phone opens the link.
	const phone = await context.newPage();
	await phone.goto(url);
	const recap = phone.frameLocator('[data-testid="recap-frame"]');
	await expect(recap.getByText('Evil won')).toBeVisible();
	await expect(recap.getByText('Imp', { exact: true })).toBeVisible();
	await expect(recap.locator('img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
	await expect(recap.locator('body')).not.toContainText('Secret word: lantern');
	const download = phone.waitForEvent('download');
	await phone.getByRole('button', { name: 'Save', exact: true }).tap();
	expect((await download).suggestedFilename()).toMatch(/^trouble-brewing-.*\.html$/);
	// Its Share is the one share screen, with the recap's QR code and link (Trevor, 2026-10-23).
	await phone.getByRole('button', { name: 'Share', exact: true }).tap();
	const passOn = phone.getByRole('dialog', { name: /^Share / });
	await expect(passOn.getByTestId('share-url')).toHaveValue(url);
	await expect(passOn.getByRole('img', { name: 'QR code for the game recap' })).toBeVisible();
	await phone.keyboard.press('Escape');

	// Reopening the dialog finds the same share; Stop sharing deletes it.
	await page.keyboard.press('Escape');
	await menu(page, 'Export game');
	await page
		.getByRole('dialog', { name: 'Export game' })
		.getByRole('button', { name: 'Share', exact: true })
		.tap();
	await expect(link).toHaveValue(url);
	await dialog.getByRole('button', { name: 'Stop sharing' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Stop sharing this game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(link).toHaveValue('');
	await phone.reload();
	await expect(phone.getByRole('alert')).toHaveText('This recap is no longer shared.');
});

/** Whether an element is fully inside the window. */
const inView = (el: Element) => {
	const r = el.getBoundingClientRect();
	return r.top >= 0 && r.bottom <= window.innerHeight;
};

test("the Script button opens the players' copy of the script", async ({ page }) => {
	await startGame(page);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Trouble Brewing' });
	// The same component as /play's Script tab (Trevor, 2026-10-16): 22 characters plus the
	// edition's 5 recommended Travellers (wiki: Trouble Brewing).
	await expect(sheet.locator('[data-character]')).toHaveCount(27);
	// Like /play's title line (Trevor, 2026-10-19): who wrote it, Print and Share.
	await expect(sheet.getByTestId('script-byline')).toHaveText('by The Pandemonium Institute');
	for (const name of ['Print script', 'Share script'])
		await expect(sheet.getByRole('button', { name })).toBeEnabled();
	await expect(sheet.locator('[data-character="empath"]')).toContainText(
		'Each night, you learn how many of your 2 alive neighbors'
	);
	// In a game, Travellers and Jinxes start closed while none of theirs is in play
	// (Trevor, 2026-10-18); the header still opens them.
	const travellers = sheet.getByRole('button', { name: 'Recommended Travellers' });
	await expect(travellers).toHaveAttribute('aria-expanded', 'false');
	await expect(sheet.getByRole('button', { name: 'Jinxes' })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await expect(sheet.getByTestId('no-jinxes')).toBeHidden();
	await travellers.tap();
	await expect(sheet.locator('[data-character="gunslinger"]')).toBeVisible();
	// It scrolls to the end (Trevor, 2026-10-16: it couldn't be scrolled).
	const scroller = sheet.getByTestId('script-scroll');
	const box = (await scroller.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	const last = sheet.locator('[data-character]').last();
	for (let i = 0; i < 30 && !(await last.evaluate(inView)); i++) await page.mouse.wheel(0, 600);
	await expect(last).toBeInViewport();
	expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	// Every tab players' /play has, Grim and Notes too (Trevor, 2026-10-23: "feature parity").
	await expect(sheet.getByRole('tab')).toHaveText(['Script', 'Night', 'Grim', 'Notes']);
	await sheet.getByRole('tab', { name: 'Night' }).tap();
	await expect(sheet.locator('section[data-night="first"] li[data-step="empath"]')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	// Arrange seats moved into More to make room.
	await page.getByRole('button', { name: 'More' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: 'Arrange seats' })
	).toBeVisible();
});

// Trevor, 2026-10-19: a Traveller in play shows on the script with its player, as the town
// knows it (Travellers say who they are: https://wiki.bloodontheclocktower.com/Travellers).
test('a Traveller in play is marked on the script with its player', async ({ page }) => {
	await startGame(page);
	await menu(page, 'Add seat');
	await page.getByRole('button', { name: 'Place between Seat 8 and Seat 1' }).tap();
	const sheet = await openSeat(page, 9);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 9' })
		.getByRole('button', { name: 'Thief, Recommended', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await closeSheet(page);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const script = page.getByRole('dialog', { name: 'Trouble Brewing' });
	const travellers = script.getByRole('button', { name: 'Recommended Travellers' });
	await expect(travellers).toHaveAttribute('aria-expanded', 'true');
	await expect(
		script.locator('[data-character="thief"]').getByTestId('traveller-in-play')
	).toHaveText('In play: Seat 9');
	await expect(script.getByTestId('traveller-in-play')).toHaveCount(1);
});

test("the day's Announcements explain a kill that didn't happen", async ({ page }) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Imp'],
		[2, 'Soldier']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day' });
	// Nothing to explain yet: the button is there but off, so nothing moves (Trevor).
	await expect(day.getByTestId('prevented-button')).toBeDisabled();
	await day.getByRole('button', { name: 'Close' }).tap();

	// The Storyteller puts the Imp's Dead token on the Soldier, who doesn't die (Trevor,
	// 2026-10-16; https://wiki.bloodontheclocktower.com/Soldier).
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 2' });
	await picker.getByRole('group', { name: 'Imp' }).getByRole('button', { name: 'Dead' }).tap();
	// The Soldier lives, so the Storyteller says no to marking them dead.
	await page
		.getByRole('alertdialog', { name: /^Mark .* dead\?$/ })
		.getByRole('button', { name: 'Cancel', exact: true })
		.tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);

	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await day.getByTestId('prevented-button').tap();
	const prevented = page.getByRole('dialog', { name: 'What didn’t happen' });
	await expect(prevented.getByTestId('prevented')).toContainText('chose');
	// The Soldier's own TPI ability text says why.
	await expect(prevented.locator('[data-character="soldier"]')).toContainText(
		'You are safe from the Demon.'
	);
	await page.screenshot({ path: `test-results/prevented-${test.info().project.name}.png` });
});

test('the Storyteller keeps game and player notes in one sheet, marked on the token', async ({
	page
}) => {
	await startGame(page);
	const seat = await openSeat(page, 1);
	await nameSeat(seat, 'Ana');
	// Player notes live in the ⋯ Notes sheet, not as a row of the seat sheet (Trevor, 2026-10-19).
	await expect(seat.getByRole('button', { name: /^Notes/ })).toHaveCount(0);
	await closeSheet(page);

	await menu(page, 'Notes');
	const sheet = page.getByTestId('notes-sheet');
	// Every player, headed by their character, seat and name (Trevor, 2026-10-19).
	await expect(sheet.locator('li[data-seat]')).toHaveCount(8);
	// Game notes as the player's notebook keeps them (Trevor, 2026-10-23): several, each with a
	// title, starting as a "+ New note" card with a dashed edge.
	const add = sheet.getByTestId('new-note');
	const cards = sheet.locator('[data-note]');
	await expect(cards).toHaveCount(0);
	await expect(add).toHaveText('New note');
	await expect(add).toHaveCSS('border-top-style', 'dashed');
	await add.tap();
	const gameDialog = page.getByRole('dialog', { name: 'Note' });
	await gameDialog.getByRole('textbox', { name: 'Title' }).fill('Fang Gu');
	await gameDialog.getByRole('textbox', { name: 'Text' }).fill('Ana asked about the Fang Gu');
	await gameDialog.getByRole('button', { name: 'Close' }).tap();
	await expect(cards).toHaveCount(1);
	await expect(cards).toHaveText(/^\s*Fang Gu\s*Ana asked about the Fang Gu\s*$/);
	// A new note left blank is not kept.
	await add.tap();
	await page.keyboard.press('Escape');
	await expect(cards).toHaveCount(1);
	// A second note goes after the first, and the trash deletes it after asking.
	await add.tap();
	await gameDialog.getByRole('textbox', { name: 'Title' }).fill('Bluffs');
	await gameDialog.getByRole('button', { name: 'Close' }).tap();
	await expect(cards).toHaveText([/Fang Gu/, /Bluffs/]);
	await cards.nth(1).tap();
	await gameDialog.getByRole('button', { name: 'Delete note' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Delete this note?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(cards).toHaveCount(1);
	// Each note hides its own text in the list, keeping its title.
	await cards.first().tap();
	await gameDialog.getByRole('button', { name: 'Hide contents' }).tap();
	await page.keyboard.press('Escape');
	await expect(cards).toHaveText(/^\s*Fang Gu\s*Hidden\s*$/);
	await page.screenshot({ path: `test-results/game-notes-${test.info().project.name}.png` });

	const notes = sheet.getByRole('button', { name: /^Notes for Seat 1 \(Ana\):/ });
	await expect(notes).toHaveAccessibleName('Notes for Seat 1 (Ana): None');
	await notes.tap();
	// "Note: Ana", the character on the next line (Trevor, 2026-10-19).
	const dialog = page.getByRole('dialog', { name: 'Note: Ana' });
	const field = dialog.getByRole('textbox');
	await expect(dialog.getByText('None', { exact: true })).toBeVisible();
	// Nothing grabs focus (and the keyboard) when it opens; Enter starts a new line.
	await expect(field).not.toBeFocused();
	await field.tap();
	await page.keyboard.type('Secret word: lantern');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Amnesiac: learns a Minion');
	await expect(dialog).toBeVisible();
	// No resize grip; the field grows with its lines instead (Trevor, 2026-10-19).
	await expect(field).toHaveCSS('resize', 'none');
	const height = (await field.boundingBox())?.height ?? 0;
	for (let i = 0; i < 6; i++) await page.keyboard.press('Enter');
	expect((await field.boundingBox())?.height ?? 0).toBeGreaterThan(height);
	for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
	// No Save or Cancel (Trevor, 2026-10-17): closing it any way keeps the note.
	await expect(dialog.getByRole('button', { name: 'Save' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await expect(notes).toContainText('Secret word: lantern');
	// Dismissed without a button (as a swipe down does), it keeps the edit too.
	await notes.tap();
	await field.tap();
	await page.keyboard.press('Control+End');
	await page.keyboard.type(' (kept)');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(notes).toContainText('(kept)');
	await closeSheet(page);

	await expect(seatLabelled(page, 'Seat 1: Ana, no character, has a note')).toBeAttached();
	const mark = page.getByTestId('note-mark');
	await expect(mark).toHaveCount(1);
	// Tapping the pen mark opens just that player's note (Trevor, 2026-10-19).
	await mark.tap();
	await expect(dialog).toBeVisible();
	await expect(field).toHaveValue(/Secret word: lantern/);
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: 'Edit player name' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	// The seat's own ⋯ menu edits the same notes (Trevor, 2026-10-19).
	const again = await openSeat(page, 1);
	await again.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Ana' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await again.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog', { name: 'Ana' }).getByRole('button', { name: 'Notes' }).tap();
	await expect(dialog).toBeVisible();
	await expect(field).toHaveValue(/Secret word: lantern/);
	await expect(dialog.locator('[data-character-id="poisoner"]')).toBeVisible();
	await page.screenshot({ path: `test-results/seat-note-${test.info().project.name}.png` });
	await field.tap();
	await page.keyboard.press('Control+End');
	await page.keyboard.type(' (from the seat)');
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await closeSheet(page);
	await menu(page, 'Notes');
	await expect(notes).toContainText('(from the seat)');
	await closeSheet(page);
	// Saved with the game, and listed in History.
	await page.reload();
	await expect(page.getByTestId('note-mark')).toHaveCount(1);
	await menu(page, 'History');
	const history = page.getByRole('dialog', { name: 'History' });
	await expect(history).toContainText('Note on Ana');
	await expect(history).toContainText('Game note: Fang Gu');
	await expect(history).toContainText('Deleted a game note');
});

test("a seat's reminder list shows who has each reminder and moves it here", async ({ page }) => {
	await startGame(page);
	let sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Ana');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Ana' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	let picker = page.getByRole('dialog', { name: 'Reminders for Ana' });
	await picker.getByRole('group', { name: 'Poisoner' }).getByRole('button').first().tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);

	// On Seat 3's list the Poisoner's token names Ana, and a tap moves it here.
	sheet = await openSeat(page, 3);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	picker = page.getByRole('dialog', { name: 'Reminders for Seat 3' });
	const poisoned = picker.getByRole('button', { name: 'Poisoned, on Ana: move here' });
	await expect(poisoned.getByTestId('reminder-holder')).toHaveText('Ana');
	await poisoned.tap();
	await expect(picker.getByRole('group', { name: 'On this seat' }).getByRole('button')).toHaveCount(
		1
	);
	await expect(
		picker.getByRole('group', { name: 'Poisoner' }).getByRole('button').first()
	).toHaveAttribute('aria-pressed', 'true');
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 1: Ana, Poisoner')).toHaveAttribute(
		'aria-label',
		'Seat 1: Ana, Poisoner'
	);
});

test("on a crowded table one seat's reminders never cover another's", async ({ page }) => {
	// Fifteen players (Trevor, 2026-10-16): neighbours sit close together.
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'More players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(15);
	for (const [seat, name] of [
		[1, 'Washerwoman'],
		[2, 'Librarian'],
		[3, 'Investigator']
	] as const) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${seat}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	// Neighbours 4 and 5 hold four and three reminders.
	for (const [seat, groups] of [
		[4, ['Washerwoman', 'Librarian']],
		[5, ['Investigator', 'Drunk']]
	] as const) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Add reminder' }).tap();
		const picker = page.getByRole('dialog', { name: `Reminders for Seat ${seat}` });
		for (const group of groups) {
			const buttons = picker.getByRole('group', { name: group }).getByRole('button');
			for (let i = 0; i < (await buttons.count()); i++) await buttons.nth(i).tap();
		}
		await picker.getByRole('button', { name: 'Close' }).tap();
		await closeSheet(page);
	}
	const boxes = (seat: number) =>
		page
			.locator(`.chip-slot[data-seat="${seat}"] [data-testid="board-reminder"]`)
			.evaluateAll((els) =>
				els.map((el) => {
					const r = el.getBoundingClientRect();
					return { x: r.x, y: r.y, w: r.width, h: r.height };
				})
			);
	const four = await boxes(4);
	const five = await boxes(5);
	// Each sits nearer its own seat than the neighbour's (Trevor, 2026-10-17).
	const centre = async (n: number) => {
		const b = (await page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) }).boundingBox())!;
		return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
	};
	const [s4, s5] = [await centre(4), await centre(5)];
	const d = (b: { x: number; y: number; w: number; h: number }, s: { x: number; y: number }) =>
		Math.hypot(b.x + b.w / 2 - s.x, b.y + b.h / 2 - s.y);
	for (const b of four) expect(d(b, s4)).toBeLessThan(d(b, s5));
	for (const b of five) expect(d(b, s5)).toBeLessThan(d(b, s4));
	await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0, { timeout: 15000 });
	await page.screenshot({ path: `test-results/crowded-${test.info().project.name}.png` });
	expect(four).toHaveLength(4);
	expect(five).toHaveLength(3);
	for (const a of four)
		for (const b of five)
			expect(
				a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1
			).toBe(false);
});

test("a night step lists every copy of a character's reminder (the Mathematician's five)", async ({
	page
}) => {
	await startGame(page, 'Sects & Violets');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Mathematician', exact: true })
		.tap();
	await closeSheet(page);

	const guide = await openStep(page, 'Mathematician');
	// The whole ability sits at the top, beside the icon and name.
	await expect(guide.getByTestId('step-ability')).toContainText('abnormally');
	await expect(guide.getByTestId('step-ability')).toBeInViewport();
	await page.screenshot({ path: `test-results/step-ability-${test.info().project.name}.png` });
	// https://wiki.bloodontheclocktower.com/Mathematician : five "Abnormal" tokens in TPI's data.
	const place = guide.getByRole('button', { name: 'Place' });
	await expect(place).toHaveCount(5);
	for (const seat of [2, 3]) {
		await place.first().tap();
		await page
			.getByRole('dialog', { name: 'Put Abnormal on' })
			.getByRole('button', { name: new RegExp(`^${seat} .*Seat ${seat}$`) })
			.tap();
	}
	await expect(place).toHaveCount(3);
	await expect(guide).toContainText('On Seat 2');
	await expect(guide).toContainText('On Seat 3');
	// The X stays in reach however long the step is.
	await guide.getByRole('button', { name: 'Close' }).tap();
	await expect(guide).toBeHidden();
});

for (const desktop of [false, true]) {
	test(`the eye shows a sensibly sized token, its name and its ability on one screen${desktop ? ' (computer window)' : ''}`, async ({
		page
	}, info) => {
		if (desktop) {
			test.skip(info.project.name !== 'tablet', 'one computer-sized run is enough');
			await page.setViewportSize({ width: 1440, height: 900 });
		}
		await startGame(page);
		const sheet = await openSeat(page, 1);
		await sheet.getByRole('button', { name: 'Choose' }).tap();
		await page
			.getByRole('dialog', { name: 'Character for Seat 1' })
			.getByRole('button', { name: 'Fortune Teller', exact: true })
			.tap();
		await sheet.getByRole('button', { name: 'Show to player' }).tap();

		const shown = page.locator('[data-testid="show-to-player"][open]');
		const view = page.viewportSize()!;
		const token = (await shown.getByRole('img', { name: /Fortune Teller token/ }).boundingBox())!;
		// Never the whole screen (Trevor, 2026-10-17).
		expect(token.width).toBeLessThanOrEqual(view.width * 0.75 + 1);
		expect(token.height).toBeLessThanOrEqual(view.height * 0.55 + 1);
		// The name (as a badge) and the ability are there and on screen, without scrolling.
		const name = shown.locator('[data-character-id="fortuneteller"]');
		await expect(name).toBeInViewport({ ratio: 1 });
		const ability = shown.getByText(/^Each night, choose 2 players/);
		await expect(ability).toBeInViewport({ ratio: 1 });
	});
}

test('marking a player as the Marionette asks to make them evil', async ({ page }) => {
	// The Marionette is a Minion, so evil (https://wiki.bloodontheclocktower.com/Marionette).
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste
		.getByLabel('Script JSON')
		.fill(
			JSON.stringify([{ id: '_meta', name: 'Strings' }, 'clockmaker', 'chef', 'marionette', 'imp'])
		);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Strings');
	await startGame(page, 'Strings');
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 2' })
		.getByRole('button', { name: 'Clockmaker', exact: true })
		.tap();
	await expect(sheet.getByText('Good · Seat 2')).toBeVisible();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 2' });
	await picker
		.getByRole('group', { name: 'Marionette' })
		.getByRole('button', { name: 'Is The Marionette' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Make this player evil?' });
	await expect(ask).toContainText('Current alignment');
	await expect(ask).toContainText('New alignment');
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await expect(sheet.getByText('Evil · Seat 2')).toBeVisible();
});

test('an extra Demon bluff set can be renamed, and the name is kept with the game', async ({
	page
}) => {
	await startGame(page);
	await menu(page, 'Demon bluffs');
	await page.getByRole('button', { name: 'Add a set' }).tap();
	await page
		.getByRole('group', { name: 'Bluff characters' })
		.getByRole('button', { name: /^Monk(, .*)?$/ })
		.tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const set = page.getByTestId('bluff-set').nth(1);
	await expect(set).toHaveAttribute('data-set', 'Set 2');

	// Renamed where its characters are chosen: the pencil on the set's name line (Trevor,
	// 2026-10-19). The Demon's set keeps its name (Trevor, 2026-10-17).
	const field = page.getByRole('textbox', { name: 'Set name' });
	await page
		.getByTestId('bluff-set')
		.first()
		.getByRole('button', { name: /^Choose the/ })
		.tap();
	await expect(field).toHaveCount(0);
	await page.getByRole('button', { name: 'Cancel' }).tap();
	const edit = () => set.getByRole('button', { name: /^Choose the .* bluffs$/ }).tap();
	await edit();
	await field.fill('Legion');
	await field.press('Enter');
	await expect(set).toHaveAttribute('data-set', 'Legion');

	// Cancel leaves the name as it was.
	await edit();
	await field.fill('Something else');
	await page.getByRole('button', { name: 'Cancel' }).tap();
	await expect(set).toHaveAttribute('data-set', 'Legion');

	// Saved with the game.
	await page.reload();
	await menu(page, 'Demon bluffs');
	await expect(page.getByTestId('bluff-set').nth(1)).toHaveAttribute('data-set', 'Legion');

	// Clearing the name brings back the default.
	await edit();
	await page.locator('form.picked-name').getByRole('button', { name: 'Clear' }).tap();
	await field.press('Enter');
	await expect(set).toHaveAttribute('data-set', 'Set 2');
});

/** A real finger swipe (touch events through the browser's input pipeline). */
async function swipe(page: Page, ...points: { x: number; y: number }[]) {
	const [from] = points;
	const cdp = await page.context().newCDPSession(page);
	const point = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
	for (let leg = 1; leg < points.length; leg++) {
		const [a, b] = [points[leg - 1], points[leg]];
		for (let i = 1; i <= 10; i++) {
			const at = { x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10 };
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(at) });
		}
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

test('in the reminder bank a sideways swipe scrolls; an upward one picks the token up', async ({
	page
}) => {
	// Trevor, 2026-10-17: swiping to scroll sometimes dragged a reminder instead.
	await startGame(page);
	for (const [number, name] of [
		[1, 'Washerwoman'],
		[2, 'Librarian'],
		[3, 'Investigator'],
		[5, 'Fortune Teller'],
		[6, 'Poisoner'],
		[7, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const tokens = bank.getByTestId('board-reminder');
	const first = (await tokens.nth(1).boundingBox())!;
	const start = { x: first.x + first.width / 2, y: first.y + first.height / 2 };
	const scrolled = () => bank.evaluate((el) => el.scrollLeft);
	expect(await bank.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

	// Sideways, starting on a token: the row scrolls and nothing is placed.
	await swipe(page, start, { x: start.x - 150, y: start.y + 4 });
	await expect.poll(scrolled).toBeGreaterThan(20);
	await expect(seatLabelled(page, 'Seat 4: no name, no character')).toHaveAttribute(
		'aria-label',
		'Seat 4: no name, no character'
	);

	// Up towards the board: the token is picked up and lands on the seat. Waits for the
	// row to stop scrolling, then takes a token wholly in view (slow runners scroll on).
	await expect
		.poll(async () => {
			const before = await scrolled();
			await page.waitForTimeout(200);
			return before === (await scrolled());
		})
		.toBe(true);
	const lift = await bank.evaluate((el) => {
		const row = el.getBoundingClientRect();
		const inView = [...el.querySelectorAll('[data-testid="board-reminder"]')]
			.map((t) => t.getBoundingClientRect())
			.find((r) => r.left >= row.left && r.right <= row.right);
		if (!inView) throw new Error('no reminder wholly in view');
		return { x: inView.left + inView.width / 2, y: inView.top + inView.height / 2 };
	});
	const seat = (await page.getByRole('button', { name: /^Seat 4:/ }).boundingBox())!;
	await swipe(
		page,
		lift,
		{ x: lift.x, y: lift.y - 80 },
		{ x: seat.x + seat.width / 2, y: seat.y + seat.height / 2 }
	);
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 1 reminder')).toBeAttached();
});

test('a reminder dragged out of the bank at a shallow angle, or after a hold, is picked up', async ({
	page
}) => {
	// Trevor, 2026-10-19: drags out of the bank at under 45 degrees scrolled it instead.
	await startGame(page);
	for (const [number, name] of [
		[1, 'Washerwoman'],
		[2, 'Librarian'],
		[3, 'Investigator'],
		[5, 'Fortune Teller'],
		[6, 'Poisoner'],
		[7, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	expect(await bank.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
	const scrolled = () => bank.evaluate((el) => el.scrollLeft);
	const tokenAt = async (n: number) => {
		const box = (await bank.getByTestId('board-reminder').nth(n).boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	const centre = async (name: RegExp) => {
		const box = (await page.getByRole('button', { name }).boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};

	// About 30 degrees up and to the right, then on to seat 4.
	const lift = await tokenAt(0);
	await swipe(page, lift, { x: lift.x + 52, y: lift.y - 30 }, await centre(/^Seat 4:/));
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 1 reminder')).toBeAttached();
	expect(await scrolled()).toBe(0);

	// Held still for a moment, then level along the bank, then up to seat 8.
	const held = await tokenAt(1);
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : []
		});
	await touch('touchStart', held);
	await page.waitForTimeout(400);
	for (let i = 1; i <= 6; i++) await touch('touchMove', { x: held.x + i * 10, y: held.y });
	const seat8 = await centre(/^Seat 8:/);
	for (let i = 1; i <= 10; i++)
		await touch('touchMove', {
			x: held.x + 60 + ((seat8.x - held.x - 60) * i) / 10,
			y: held.y + ((seat8.y - held.y) * i) / 10
		});
	await touch('touchEnd');
	await cdp.detach();
	await expect(seatLabelled(page, 'Seat 8: no name, no character, 1 reminder')).toBeAttached();
});

test('Back closes an open sheet first, then asks before leaving the game', async ({ page }) => {
	// Trevor, 2026-10-17: the browser's Back, a back swipe or Android's Back button.
	await startGame(page);
	const board = page.url();
	const leave = page.getByRole('alertdialog', { name: 'Leave the game?' });

	await openSeat(page, 1);
	await page.goBack();
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
	await expect(leave).toBeHidden();
	expect(page.url()).toBe(board);

	await page.goBack();
	await expect(leave).toBeVisible();
	await leave.getByRole('button', { name: 'Cancel' }).tap();
	expect(page.url()).toBe(board);

	// Asks again on the next Back, and Confirm leaves for where the game was opened from:
	// Character selection, the step before the board (G7).
	await page.goBack();
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(/\/setup$/);
});

test('once every token is placed, the board does not prompt for the Demon bluffs', async ({
	page
}) => {
	// They are chosen in setup, after the draw, instead (Trevor, 2026-10-18).
	await startGame(page);
	const names = ['Chef', 'Empath', 'Monk', 'Soldier', 'Mayor', 'Ravenkeeper', 'Undertaker', 'Imp'];
	for (const [i, name] of names.entries()) {
		const sheet = await openSeat(page, i + 1);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${i + 1}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	await expect(page.locator('.centre').getByRole('button', { name: 'Demon bluffs' })).toHaveCount(
		0
	);
});

test('a new Demon bluff set is named on the screen where its characters are chosen', async ({
	page
}) => {
	await startGame(page);
	await menu(page, 'Demon bluffs');
	// The Demon's set keeps its name, so its picker has no name field.
	await page.getByRole('button', { name: 'Choose' }).first().tap();
	// The heading is the set's name and the count, never "Set 2 bluffs" (read as "choose 2").
	await expect(page.getByRole('heading', { name: 'Demon bluffs · 0/3' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Set name' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Cancel' }).tap();

	await page.getByRole('button', { name: 'Add a set' }).tap();
	const name = page.getByRole('textbox', { name: 'Set name' });
	await expect(name).toHaveAttribute('placeholder', 'Set 2');
	await expect(page.getByRole('heading', { name: 'Set 2 · 0/3' })).toBeVisible();
	await name.fill('Spares');
	await page
		.getByRole('group', { name: 'Bluff characters' })
		.getByRole('button', { name: /^Monk(, .*)?$/ })
		.tap();
	await expect(page.getByRole('heading', { name: 'Spares · 1/3' })).toBeVisible();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const set = page.getByTestId('bluff-set').nth(1);
	await expect(set).toHaveAttribute('data-set', 'Spares');

	// Choosing again shows the name, and Cancel keeps it.
	await set.getByRole('button', { name: 'Choose' }).tap();
	await expect(name).toHaveValue('Spares');
	await name.fill('Other');
	await page.getByRole('button', { name: 'Cancel' }).tap();
	await expect(set).toHaveAttribute('data-set', 'Spares');
});

test('reminders can stay where dropped, after a warning listing what changes', async ({ page }) => {
	await startGame(page, 'Bad Moon Rising');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Sailor', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	await picker.getByRole('group', { name: 'Sailor' }).getByRole('button', { name: 'Drunk' }).tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);

	// Turning it on says what it changes first (Trevor, 2026-10-17). The switch sits apart, in
	// Board's closed Advanced part, marked with a warning before it is touched (Trevor,
	// 2026-10-23).
	await menu(page, 'Board');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	const mode = dialog.getByRole('combobox', { name: 'Reminders', exact: true });
	await expect(mode).toBeHidden();
	await openBoardAdvanced(dialog);
	await dialog.getByRole('button', { name: 'Warning' }).tap();
	await expect(page.getByText(/belong to no seat: no lines back to seats/)).toBeVisible();
	await mode.tap();
	await page.getByRole('option', { name: 'Stay where dropped', exact: true }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Reminders stay where dropped?' });
	await expect(confirm.getByTestId('reminder-mode-effects').locator('li')).toHaveCount(5);
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();

	const token = page.getByRole('button', { name: 'Drunk reminder' });
	const board = (await page.locator('.board').boundingBox())!;
	const to = { x: board.x + board.width * 0.35, y: board.y + board.height * 0.35 };
	// Once the dialog has gone and the token has stopped moving.
	await expect(dialog).toBeHidden();
	let last = '';
	await expect
		.poll(async () => {
			const b = JSON.stringify(await token.boundingBox());
			const still = b === last;
			last = b;
			return still;
		})
		.toBe(true);
	const box = (await token.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();

	// Drawn where it was dropped, also after a reload, and no longer the Sailor's seat's:
	// a reminder put down anywhere belongs to no one (Trevor, 2026-10-17).
	const near = async () => {
		const b = (await token.boundingBox())!;
		return Math.hypot(b.x + b.width / 2 - to.x, b.y + b.height / 2 - to.y) < board.width * 0.05;
	};
	await expect.poll(near).toBe(true);
	await expect(
		page.locator('[data-loose]').getByRole('button', { name: 'Drunk reminder' })
	).toBeVisible();
	await expect(
		page.locator('[data-testid="seat"][aria-label="Seat 1: no name, Sailor"]')
	).toBeAttached();
	await page.reload();
	await expect(token).toBeVisible();
	await expect.poll(near).toBe(true);

	// Only in the board's open area (Trevor, 2026-10-17): dropped on the middle's buttons it
	// stays where it was.
	const middle = page.locator('.centre > *').first();
	const m = (await middle.boundingBox())!;
	const from = (await token.boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect.poll(near).toBe(true);
});

/** Drags a token by mouse from its centre to a point, lifting it straight up first. */
async function dragTo(page: Page, token: Locator, to: { x: number; y: number } | Locator) {
	await token.scrollIntoViewIfNeeded();
	// A target is measured once the token is in view: scrolling to it can move the board.
	if ('boundingBox' in to) to = await centreOf(to);
	const box = (await token.boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y - box.height, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
}
const centreOf = async (locator: Locator) => {
	const b = (await locator.boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('a Fabled or Loric holds reminders, asking first for one not its own', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await closeSheet(page);
	await menu(page, 'Add Fabled or Loric');
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Angel', exact: true })
		.tap();
	const all = page.getByRole('list', { name: 'Reminder bank' });
	const angel = page.getByRole('list', { name: 'Fabled and Loric' }).getByRole('button', {
		name: 'Angel'
	});
	const held = page.getByRole('group', { name: "Angel's reminders" });

	// The Angel's own reminder goes straight on (https://wiki.bloodontheclocktower.com/Angel).
	await dragTo(page, all.getByRole('button', { name: 'Something Bad reminder' }), angel);
	await expect(held.getByRole('button', { name: 'Something Bad reminder' })).toBeVisible();

	// Another character's asks first, saying why (Trevor, 2026-10-17).
	await dragTo(page, all.getByRole('button', { name: 'Poisoned reminder' }), angel);
	const confirm = page.getByRole('alertdialog', { name: 'Confirm change?' });
	await expect(confirm).toContainText('Not a Fabled or Loric reminder.');
	await expect(confirm).toContainText(/Now\s*In the reminder bank/);
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// Packed on the token: the latest, and how many more (Trevor, 2026-10-18).
	await expect(held.getByRole('button')).toHaveCount(2);
	await expect(held.getByRole('button', { name: '1 more reminders' })).toBeVisible();
	// Its uncovered side, beside the latest reminder.
	const more = held.getByRole('button', { name: '1 more reminders' });
	const moreBox = (await more.boundingBox())!;
	await more.tap({ position: { x: moreBox.width * 0.85, y: moreBox.height / 2 } });
	const angelSheet = page.getByRole('dialog', { name: 'Angel' });
	await expect(
		angelSheet.getByRole('group', { name: 'Reminders' }).getByRole('button')
	).toHaveCount(2);
	await angelSheet.getByRole('button', { name: 'Close' }).tap();

	// Its dialog lists them; one opens on its own, with whose it is, and can be removed.
	await held.getByRole('button', { name: 'Poisoned reminder' }).tap();
	const reminder = page.getByRole('dialog', { name: 'Poisoned' });
	await expect(reminder).toContainText(/From\s*Poisoner\s*on\s*Angel/);
	await reminder.getByRole('button', { name: 'Remove reminder' }).tap();
	await expect(held.getByRole('button')).toHaveCount(1);
	await expect(all.getByRole('button', { name: 'Poisoned reminder' })).toBeVisible();
});

test('a reminder put down in the open belongs to no one, and can go back on a seat', async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await closeSheet(page);
	await page.evaluate(() =>
		localStorage.setItem('grim.boardLooks', JSON.stringify({ reminders: 'free' }))
	);
	await page.reload();
	const board = (await page.locator('.board').boundingBox())!;
	const open = { x: board.x + board.width * 0.35, y: board.y + board.height * 0.3 };
	await dragTo(
		page,
		page
			.getByRole('list', { name: 'Reminder bank' })
			.getByRole('button', { name: 'Poisoned reminder' }),
		open
	);
	const loose = page.locator('[data-loose]').getByRole('button', { name: 'Poisoned reminder' });
	await expect(loose).toBeVisible();
	await expect(page.locator('[data-testid="seat"][aria-label$=" reminder"]')).toHaveCount(0);

	// Tapped: it is on no seat, and can be put on one.
	await loose.tap();
	const dialog = page.getByRole('dialog', { name: 'Poisoned' });
	await expect(dialog).toContainText(/From\s*Poisoner\s*loose on the board/);
	await dialog.getByRole('button', { name: 'Move to a seat' }).tap();
	await page
		.getByRole('dialog', { name: 'Move Poisoned to' })
		.getByRole('button', { name: /Seat 3/ })
		.tap();
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
	await expect(page.locator('[data-loose]')).toHaveCount(0);
});

/** Picks how the walked-through step's reminders are shown. */
async function focusMode(page: Page, mode: string) {
	await page.getByTestId('night-strip').getByRole('button', { name: 'Character reminders' }).tap();
	await page
		.getByRole('dialog', { name: 'Character reminders' })
		.getByRole('combobox', { name: "Show this character's reminders" })
		.tap();
	await page.getByRole('option', { name: mode }).tap();
	await page.keyboard.press('Escape');
}

test("the walk-through points out the step's reminders: ringed, alone or first", async ({
	page
}) => {
	await startGame(page);
	// One of the game's own ∞ tokens (plan B9).
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.getByRole('button', { name: 'New token' })
		.tap();
	await page.getByTestId('reminder-note').fill('Red herring');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('reminder-note')).toBeHidden();
	for (const [number, name] of [
		[1, 'Poisoner'],
		[2, 'Monk']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	await bankNight(page, 'Start game').tap();
	const strip = page.getByTestId('night-strip');
	for (let i = 0; i < 6 && !(await strip.textContent())?.includes('Poisoner'); i++)
		await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(strip).toContainText('Poisoner');

	// Only this character covers the setup reminders too (Trevor, 2026-10-17), and still lists
	// the ∞ tokens after them: the plain ∞, the game's own and "+ New token" (Trevor, 2026-10-23).
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const listed = bank.locator('> li:not(.divider)');
	await focusMode(page, 'Only this character');
	const now = await bank.locator('> li.now').count();
	await expect(listed).toHaveCount(now + 3);
	await expect(listed.nth(-3).getByRole('button')).toHaveAccessibleName('Generic reminder');
	await expect(listed.nth(-2).getByRole('button')).toHaveAccessibleName(
		'Generic reminder: Red herring'
	);
	await expect(listed.last().getByRole('button')).toHaveAccessibleName('New token');
	await focusMode(page, 'Bring to front');
	const tokens = page.getByRole('list', { name: 'Reminder bank' }).locator('> li');
	// Bring to front, as before: the Poisoner's token first, ringed.
	await expect(tokens.first()).toHaveClass(/\bnow\b/);
	await expect(tokens.first()).toContainText('Poisoned');

	// One choice, as a drop-down (Trevor, 2026-10-17): always on, only how.
	await focusMode(page, 'Only this character');
	await expect(listed).toHaveCount(4);
	await expect(tokens.first()).toContainText('Poisoned');
	await focusMode(page, 'Highlight');
	await expect(page.locator('li.dim').first()).toBeAttached();
	await expect(tokens.first()).not.toHaveClass(/\bnow\b/);
	await expect(page.locator('li.now')).toHaveCount(1);
});

test("a script's own character can have another copy of a reminder (Cleopatra)", async ({
	page
}) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(
		JSON.stringify([
			{ id: '_meta', name: 'Little Rome' },
			{
				id: 'cleo',
				name: 'Cleo',
				team: 'townsfolk',
				ability: 'Each night, choose two players.',
				reminders: ['Chosen']
			},
			'chef',
			'imp'
		])
	);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Little Rome');
	await startGame(page, 'Little Rome');

	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Cleo', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	const cleo = picker.getByRole('group', { name: 'Cleo' });
	const another = cleo.getByRole('button', { name: 'Add another Chosen' });
	// There from the start, usable once the listed copy is placed; official characters never.
	await expect(another).toBeDisabled();
	await expect(picker.getByRole('button', { name: /^Add another/ })).toHaveCount(1);
	await cleo.getByRole('button', { name: 'Chosen' }).first().tap();
	await expect(another).toBeEnabled();
	await another.tap();
	await expect(picker.getByRole('group', { name: 'On this seat' }).getByRole('button')).toHaveCount(
		2
	);
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, Cleo, 2 reminders')).toBeAttached();
});

test("the step focus works for a script's own character too (Fall of Rome's Merchant)", async ({
	page
}) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(
		JSON.stringify([
			{ id: '_meta', name: 'Little Market' },
			{
				id: 'merch',
				name: 'Merch',
				team: 'townsfolk',
				ability: 'Each night, choose a player.',
				reminders: ['Paid'],
				firstNight: 30,
				firstNightReminder: 'The Merch chooses a player.',
				otherNight: 30,
				otherNightReminder: 'The Merch chooses a player.'
			},
			'chef',
			'poisoner',
			'imp'
		])
	);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Little Market');
	await startGame(page, 'Little Market');
	for (const [number, name] of [
		[1, 'Merch'],
		[2, 'Poisoner']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	await bankNight(page, 'Start game').tap();
	const strip = page.getByTestId('night-strip');
	for (let i = 0; i < 8 && !(await strip.textContent())?.includes('Merch'); i++)
		await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(strip).toContainText('Merch');

	const tokens = page.getByRole('list', { name: 'Reminder bank' }).locator('> li');
	await expect(tokens.first()).toHaveClass(/\bnow\b/);
	await expect(tokens.first()).toContainText('Paid');
	await focusMode(page, 'Only this character');
	// Paid, then the plain ∞ and "+ New token".
	await expect(tokens.and(page.locator(':not(.divider)'))).toHaveCount(3);
	await expect(tokens.first()).toContainText('Paid');
});

test('the Fabled and Loric can sit grouped in a corner, listed together when tapped', async ({
	page
}) => {
	await startGame(page);
	for (const name of ['Spirit of Ivory', 'Angel']) {
		await menu(page, 'Add Fabled or Loric');
		await page
			.getByRole('dialog', { name: 'Add Fabled or Loric' })
			.getByRole('button', { name, exact: true })
			.tap();
	}
	// The choice is on the Fabled's own sheet (Trevor, 2026-10-17).
	await page
		.getByRole('list', { name: 'Fabled and Loric' })
		.getByRole('button', { name: 'Angel' })
		.tap();
	// Where they sit and whether they are grouped are two choices (Trevor, 2026-10-17).
	const angel = page.getByRole('dialog', { name: 'Angel' });
	await angel.getByRole('combobox', { name: 'Location', exact: true }).tap();
	await page.getByRole('option', { name: 'Corner', exact: true }).tap();
	await angel.getByRole('combobox', { name: 'Grouping', exact: true }).tap();
	await page.getByRole('option', { name: 'Stacked' }).tap();
	await expect(page.locator('.rules-edge .rules-stack')).toBeVisible();
	await angel.getByRole('button', { name: 'Close' }).tap();

	const stack = page.getByRole('button', { name: 'Fabled and Loric: 2' });
	await expect(stack).toBeVisible();
	await expect(page.getByRole('list', { name: 'Fabled and Loric' })).toHaveCount(0);
	await stack.tap();
	const group = page.getByRole('dialog', { name: 'Fabled and Loric' });
	await expect(group.locator('.rules-group > li')).toHaveCount(2);
	await group.getByRole('button', { name: 'Remove Angel from the game' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Remove from the game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(group.locator('.rules-group > li')).toHaveCount(1);
	await group.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('button', { name: 'Fabled and Loric: 1' })).toBeVisible();
});

test('an open night step moves to the step before or after without ticking it', async ({
	page
}) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Poisoner'],
		[2, 'Empath']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const poisoner = await openStep(page, 'Poisoner');
	// Trevor, 2026-10-17: Previous and Next inside the step.
	await poisoner.getByRole('button', { name: 'Next step' }).tap();
	const next = page
		.getByRole('dialog')
		.filter({ has: page.getByRole('button', { name: 'Previous step' }) });
	await expect(next).not.toHaveAccessibleName('Poisoner');
	await next.getByRole('button', { name: 'Previous step' }).tap();
	await expect(page.getByRole('dialog', { name: 'Poisoner' })).toBeVisible();
	await page.keyboard.press('Escape');
	const strip = await walkTo(page, 'Poisoner');
	await expect(strip.locator('button.step')).not.toHaveClass(/ticked/);
});

test('Minion info and Demon info list every card they can show, with who it points at', async ({
	page
}) => {
	test.slow();
	await startGame(page);
	for (const [number, name] of [
		[1, 'Imp'],
		[2, 'Poisoner'],
		[3, 'Spy'],
		[4, 'Empath'],
		[5, 'Chef'],
		[6, 'Monk'],
		[7, 'Soldier']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const minionInfo = await openStep(page, 'Minion info');
	const cards = minionInfo.getByTestId('evil-info-card');
	// Every card, never one pick (Trevor, 2026-10-18).
	await expect(cards).toHaveCount(2);
	await expect(cards.nth(0)).toContainText('This is the Demon');
	await expect(cards.nth(0)).toContainText('Seat 1');
	await expect(cards.nth(1)).toContainText('These are your Minions');
	await expect(cards.nth(1)).toContainText('Seat 2');
	await expect(cards.nth(1)).toContainText('Seat 3');
	await minionInfo.getByRole('button', { name: 'Show This is the Demon' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('This is the Demon');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(minionInfo).toBeVisible();

	// Demon info with no bluffs yet: its Minions, and a way to choose the bluffs.
	await minionInfo.getByRole('button', { name: 'Next step' }).tap();
	const demonInfo = page.getByRole('dialog', { name: 'Demon info' });
	await expect(demonInfo.getByTestId('evil-info-card').nth(0)).toContainText(
		'These are your Minions'
	);
	await demonInfo.getByRole('button', { name: 'Choose bluffs' }).tap();
	await page.getByTestId('bluff-set').first().getByRole('button', { name: 'Choose' }).tap();
	for (const name of ['Fortune Teller', 'Washerwoman', 'Investigator'])
		await page
			.getByRole('group', { name: 'Bluff characters' })
			.getByRole('button', { name: new RegExp(`^${name}`) })
			.tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await page.keyboard.press('Escape');

	await openStep(page, 'Demon info');
	await expect(demonInfo.getByTestId('evil-info-card')).toHaveCount(2);
	await demonInfo
		.getByRole('button', { name: 'Show These characters are not in play · Demon' })
		.tap();
	await expect(shown).toContainText('Fortune Teller');
	await expect(shown).toContainText('Investigator');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await page.keyboard.press('Escape');

	// A bluff that comes into play is flagged, but can still be shown: the Storyteller decides.
	const sheet = await openSeat(page, 8);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 8' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await closeSheet(page);
	await openStep(page, 'Demon info');
	await expect(demonInfo.getByTestId('evil-info-card').nth(1)).toContainText('In play: replace');
	await demonInfo
		.getByRole('button', { name: 'Show These characters are not in play · Demon' })
		.tap();
	await expect(shown).toContainText('Fortune Teller');
});

test('an information step suggests every valid number, and no sets of players', async ({
	page
}) => {
	await startGame(page);
	const give = async (seat: number, name: string) => {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${seat}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	};
	await give(1, 'Washerwoman');
	await give(2, 'Chef');
	await give(3, 'Empath');
	await give(4, 'Imp');
	// Trevor (2026-10-18): "only show info suggest for numbers, not sets of characters".
	// Read from the walk-through: closing a step that has setup reminders on a phone hits a
	// dialog library crash, reported to the dialog's owner (2026-10-18).
	const washerwoman = await walkTo(page, 'Washerwoman');
	await expect(washerwoman.getByTestId('night-suggested')).toHaveCount(0);
	// No evil pair sits together: the Chef's 0 (https://wiki.bloodontheclocktower.com/Chef).
	const chef = await openStep(page, 'Chef');
	const rows = chef.getByRole('list', { name: 'Valid information' }).getByRole('listitem');
	await expect(rows).toHaveCount(1);
	await expect(rows.first().locator('.main')).toHaveText('0');
	await chef.getByRole('button', { name: 'Close' }).tap();
	// The walk-through's one line names them in brackets, not a count that reads as the number
	// to give (Trevor, 2026-10-22).
	const strip = await walkTo(page, 'Chef');
	await expect(strip.getByTestId('night-suggested')).toHaveText('Valid Information: (0)');
});

test('a number step offers the "Your number is" info token; a step icon opens its details', async ({
	page
}) => {
	await startGame(page);
	for (const [seat, name] of [
		[2, 'Chef'],
		[4, 'Imp']
	] as const) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${seat}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const shown = page.locator('[data-testid="show-to-player"][open]');
	// Over the step, whose modal dialog hides the rest of the page from the accessibility tree.
	const closeShown = async () => {
		await shown.locator('.close button').tap();
		await expect(shown).toHaveCount(0);
	};
	// TPI's night text has the Chef give a finger signal (steps without one: night-steps.test.ts).
	const chef = await openStep(page, 'Chef');
	// The suggested 0 (no evil pair sits together) is shown from its own row.
	await chef
		.getByRole('list', { name: 'Valid information' })
		.getByRole('button', { name: 'Show to player' })
		.tap();
	await expect(shown.locator('h2.title')).toHaveText('Your number is');
	await expect(shown.locator('.detail')).toHaveText('0');
	await closeShown();
	// Any other number from the step's own info token.
	const number = chef.getByTestId('step-number');
	await number.getByRole('button', { name: 'Higher number' }).tap();
	await number.getByRole('button', { name: 'Higher number' }).tap();
	await number.getByRole('button', { name: 'Show to player' }).tap();
	await expect(shown.locator('.detail')).toHaveText('2');
	await closeShown();
	// The step's token opens the Chef's details, as a badge does.
	const details = page
		.getByRole('dialog', { name: 'Chef', exact: true })
		.filter({ has: page.getByRole('link', { name: 'Open wiki' }) });
	await chef.getByRole('button', { name: 'About Chef' }).tap();
	await expect(details).toBeVisible();
	await details.getByRole('button', { name: 'Close' }).tap();
	await expect(details).toHaveCount(0);
	await chef.getByRole('button', { name: 'Close' }).tap();
	// And from the walk-through.
	const strip = await walkTo(page, 'Chef');
	await strip.getByRole('button', { name: 'About Chef' }).tap();
	await expect(details).toBeVisible();
});

test('the board menu sets the seats, the settings and End game apart with lines', async ({
	page
}) => {
	await startGame(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	// Trevor (2026-10-18, 2026-10-19): game actions, the seats, the settings, then End game.
	// Storyteller names who runs the game (Trevor, 2026-10-19). A line between Tokens and
	// Report an issue (Trevor, 2026-10-23).
	await expect(menu.getByRole('separator')).toHaveCount(4);
	const items = menu.locator('.menu > :is(button, hr), .menu > .menu-nav > button');
	const names = await items.evaluateAll((els) =>
		els.map((e) => (e.tagName === 'HR' ? '|' : (e.textContent ?? '').trim()))
	);
	expect(names.join(' ')).toMatch(
		/^History Demon bluffs Notes( Game info)?( Character selection)? \| Add seat Add Fabled or Loric Arrange seats \| Board Tokens \| (Navigation )?Report an issue \| End game$/
	);
	// The lines take the buttons' border colour (Trevor, 2026-10-19), only thicker.
	const line = await menu
		.getByRole('separator')
		.first()
		.evaluate((hr) => getComputedStyle(hr).borderTopColor);
	const border = await menu
		.getByRole('button', { name: 'History' })
		.evaluate((b) => getComputedStyle(b).boxShadow);
	expect(border).toContain(line);
	// Report an issue opens the one Report form over the board (Trevor, 2026-10-20).
	await menu.getByRole('button', { name: 'Report an issue' }).tap();
	await expect(page.getByRole('dialog', { name: 'Report' })).toBeVisible();
	await expect(menu).toBeHidden();
});

test('a Demon bluff in play can still be chosen, after a confirm', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Chef', exact: true })
		.tap();
	await closeSheet(page);
	await menu(page, 'Demon bluffs');
	await page.getByTestId('bluff-set').first().getByRole('button', { name: 'Choose' }).tap();
	// Hidden at first (Trevor, 2026-10-20); the toggle shows it.
	await page.getByText('Not in play only', { exact: true }).tap();
	// Marked as in play, never locked (the Storyteller can override anything).
	await page
		.getByRole('group', { name: 'Bluff characters' })
		.getByRole('button', { name: /^Chef/ })
		.tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Save bluffs that are in play?' });
	await expect(ask).toContainText('Chef');
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	const set = page.getByTestId('bluff-set').first();
	await expect(set).toContainText('Chef');
	await expect(set).toContainText('In play: replace');
});

test('Run Night Order skips dead players, except an ability set off by dying tonight', async ({
	page
}) => {
	await startGame(page);
	const seats = [
		[1, 'Washerwoman', false],
		[2, 'Empath', true],
		[3, 'Ravenkeeper', true]
	] as const;
	for (const [seat, name] of seats) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${seat}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	// The first night ends; the Empath is executed on Day 1 and the Ravenkeeper dies tonight.
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await endNight(page);
	await page.keyboard.press('Escape');
	for (const [seat, , dies] of seats) {
		const sheet = await openSeat(page, seat);
		if (dies) {
			await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
			await page
				.getByRole('dialog', { name: `Status of Seat ${seat}` })
				.getByRole('button', { name: 'Executed' })
				.tap();
			// During the day, Executed asks as the day's Execution does (Trevor, 2026-10-23),
			// and its Confirm ends the day.
			const ask = page.getByRole('alertdialog', { name: 'End the day?' });
			if (seat === 2) {
				await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 2');
				await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
				continue;
			}
			await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
		}
		await closeSheet(page);
	}
	// Trevor (2026-10-18): "If character is dead do not show them in assisted night order."
	// The Ravenkeeper still wakes on the night they die
	// (https://wiki.bloodontheclocktower.com/Ravenkeeper).
	const strip = page.getByTestId('night-strip');
	const names: string[] = [];
	for (let i = 0; i < 12; i++) {
		names.push((await strip.locator('.name strong').textContent()) ?? '');
		const next = strip.getByRole('button', { name: 'Next step' });
		// The last step; End night ends the night (Trevor, 2026-10-18).
		if (await lastStep(strip)) break;
		await next.tap();
	}
	expect(names).toContain('Ravenkeeper');
	expect(names).not.toContain('Empath');
});

test("a game mode is named where the script's name is, apart from it", async ({ page }) => {
	await startGame(page);
	await expect(page.getByTestId('game-mode')).toHaveCount(0);
	// Started in Sushi Buffet (the game modes thread keeps the mode beside the game).
	const gameId = page.url().split('/').pop()!;
	await page.evaluate(
		(id) =>
			localStorage.setItem(
				`grim-games:game-mode:v1:${id}`,
				JSON.stringify({ modeId: 'sushi-buffet', restrictions: { banned: [], allowed: [] } })
			),
		gameId
	);
	await page.reload();
	// Trevor (2026-10-18): different text and styling for alternative game modes.
	await expect(page.getByTestId('game-mode')).toHaveText('Sushi Buffet');
	await expect(page.getByTestId('script-title')).toContainText(/Trouble Brewing\s*Sushi Buffet/);
});

test('the script name in the corner keeps clear of every seat, and a town names its mode once', async ({
	page
}) => {
	// Trevor (2026-10-18, phone screenshot): the corner ran into Seat 4's name.
	// Four games in one test: give it the time, and let each corner settle before measuring.
	test.slow();
	const overlaps = (a: Box, b: Box) =>
		a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
	type Box = { x: number; y: number; width: number; height: number };
	// A mode named like the start of the script, as a town's script is ("Two Towns and a
	// Boomdandy 1"), so the name says it once.
	const trouble = {
		format: 1,
		id: 'trouble',
		name: 'Trouble',
		sources: [{ title: 'Our group', url: 'https://example.com/trouble' }],
		parts: {
			pool: { kind: 'all-characters' },
			restricted: { banned: [] },
			assignment: { kind: 'choose-own', when: 'first-night', reconsider: false }
		}
	};
	for (const players of [5, 9, 12, 15]) {
		await page.goto('/new');
		await page.evaluate((mode) => {
			localStorage.setItem('grim-games:custom-modes:v1', JSON.stringify([mode]));
		}, trouble);
		await page.reload();
		await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
		const count = page.getByTestId('player-count');
		for (let n = 8; n < players; n++)
			await page.getByRole('button', { name: 'More players' }).tap();
		for (let n = 8; n > players; n--)
			await page.getByRole('button', { name: 'Fewer players' }).tap();
		await expect(count).toContainText(String(players));
		await page.getByRole('button', { name: 'Start game' }).tap();
		await toBoard(page);
		await expect(page.getByTestId('seat')).toHaveCount(players);
		const gameId = page.url().split('/').pop()!;
		await page.evaluate(
			(id) =>
				localStorage.setItem(
					`grim-games:game-mode:v1:${id}`,
					JSON.stringify({ modeId: 'trouble', restrictions: { banned: [], allowed: [] } })
				),
			gameId
		);
		await page.reload();
		const corner = page.getByTestId('script-title');
		await expect(corner).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('game-mode')).toHaveText('Trouble Brewing');
		await expect(corner).not.toContainText(/Trouble.*Trouble/);
		const clashes = async () => {
			const box = (await corner.boundingBox())!;
			let count = 0;
			for (const seat of await page.getByTestId('seat').all()) {
				// The token itself: its slot has a --u of room either side.
				const slot = (await seat.boundingBox())!;
				const token = { ...slot, x: slot.x + (slot.width - slot.height) / 2, width: slot.height };
				if (overlaps(box, token)) count++;
			}
			for (const name of await page.getByText(/^Seat \d+$/).all())
				if (overlaps(box, (await name.boundingBox())!)) count++;
			return count;
		};
		await expect.poll(clashes).toBe(0);
	}
});

test('a reminder in hand marks its source seat, the seats it fits, or both', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await closeSheet(page);
	const all = page.getByRole('list', { name: 'Reminder bank' });
	const token = all.getByRole('button', { name: 'Poisoned reminder' });
	const box = (await token.boundingBox())!;
	const board = (await page.locator('.board').boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, box.y - box.height, { steps: 4 });
	await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2, { steps: 6 });
	// Trevor (2026-10-18): a ring on the Poisoner's seat, a glow on each seat it may go on.
	const seats = page.getByTestId('seat');
	await expect(seats.first()).toHaveAttribute('data-role', /^(source|both)$/);
	for (const seat of (await seats.all()).slice(1))
		await expect(seat).toHaveAttribute('data-role', 'target');
	await page.mouse.up();
	await expect(page.locator('[data-testid="seat"][data-role]')).toHaveCount(0);
});

test('the bank button starts the game, ends each night and day, and resumes a stopped night', async ({
	page
}) => {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Fewer players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	const board = page.url();
	// Always in place, so the bank never moves: Set up until the tokens are handed out
	// (Trevor, 2026-10-19), then Start game.
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	const button = (name: string) => bank.getByRole('button', { name, exact: true });
	const start = button('Start game');
	const run = button('Run Night Order');
	const end = button('End night');
	const endDay = button('Execution');
	await expect(button('Set up')).toBeEnabled();
	await expect(start).toHaveCount(0);
	await page.goto(`${new URL(board).pathname}/setup`);
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Chef', 'Fortune Teller', 'Poisoner', 'Imp'])
		await page.getByRole('button', { name, exact: true }).first().tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	for (let n = 1; n <= 7; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await page.goto(board);
	await expect(page.getByTestId('seat')).toHaveCount(7);
	// The Fortune Teller's Red Herring isn't placed, so Start game asks first (Trevor, 2026-10-20).
	const begin = async () => {
		await start.tap();
		await page
			.getByRole('alertdialog', { name: 'Start the game?' })
			.getByRole('button', { name: 'Confirm', exact: true })
			.tap();
	};
	// Trevor (2026-10-19): Start game before the first night.
	await begin();
	const strip = page.getByTestId('night-strip');
	await expect(strip).toBeVisible();
	// While a night runs it is End night, in the same place (Trevor, 2026-10-18).
	await expect(start).toHaveCount(0);
	await expect(end).toBeEnabled();
	// Stopped before anything is done, it is Start game again.
	await strip.getByRole('button', { name: 'Stop the walk-through' }).tap();
	await begin();
	// Stopped mid-night, Run night picks the walk-through up again, past the steps done.
	await strip.getByRole('button', { name: 'Next step' }).tap();
	await strip.getByRole('button', { name: 'Stop the walk-through' }).tap();
	await run.tap();
	await expect(strip.locator('.count')).toHaveText(/^2 of/);
	// The count is a badge, not loose text (Trevor, 2026-10-20).
	await expect(strip.locator('.count .count-badge')).toHaveText(/^2 of \d+$/);
	await end.tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await page.keyboard.press('Escape');
	// The day: Execution, which asks who was executed, then starts the next night (Trevor,
	// 2026-10-19; 2026-10-22).
	await expect(run).toHaveCount(0);
	await endDay.tap();
	await chooseExecution(page);
	await expect(strip).toBeVisible();
	// The night starts on Dusk, though End day has ticked it (Trevor, 2026-10-20).
	await expect(strip.locator('.step .name strong')).toHaveText('Dusk');
	await expect(strip.locator('.count')).toHaveText(/^1 of/);

	// With "Open the day after End night" off, set in the confirm itself, the Storyteller stays
	// on the grimoire (Trevor, 2026-10-18).
	await strip.getByRole('button', { name: 'Next step' }).tap();
	await end.tap();
	const confirm = page.getByRole('alertdialog', { name: 'End the night?' });
	const dayAfter = confirm.getByRole('checkbox', { name: 'Open the day after End night' });
	await expect(dayAfter).toBeChecked();
	await confirm.getByText('Open the day after End night', { exact: true }).tap();
	await expect(dayAfter).not.toBeChecked();
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(confirm).toHaveCount(0);
	await expect(page.getByRole('dialog', { name: 'Day 2' })).toHaveCount(0);
	await expect(endDay).toBeEnabled();
});

// https://wiki.bloodontheclocktower.com/Devil%27s_Advocate: a living player, different to last
// night (Trevor, 2026-10-23: last night's player is not suggested again, but can be chosen).
test("the Devil's Advocate's token is not suggested on last night's player", async ({ page }) => {
	await startGame(page, 'Bad Moon Rising');
	const first = await openSeat(page, 1);
	await first.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: "Devil's Advocate", exact: true })
		.tap();
	await closeSheet(page);
	await walkTo(page, 'Dusk');

	// Night 1: the Devil's Advocate chooses Seat 2.
	const picker = async (seat: number) => {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Add reminder' }).tap();
		const dialog = page.getByRole('dialog', { name: `Reminders for Seat ${seat}` });
		const token = dialog
			.getByRole('group', { name: "Devil's Advocate" })
			.getByRole('button')
			.filter({ hasText: 'Survives Execution' });
		return { dialog, token };
	};
	const night1 = await picker(2);
	await expect(night1.token).not.toHaveAttribute('data-misfit');
	await night1.token.tap();
	await page.keyboard.press('Escape');
	await closeSheet(page);
	await endNight(page);
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await page.keyboard.press('Escape');

	// Night 2: the token comes off Seat 2, which is then marked as not a usual place for it.
	const again = await picker(2);
	await again.dialog.getByRole('group', { name: 'On this seat' }).getByRole('button').tap();
	await expect(again.token).toHaveAttribute('data-misfit', '');
	await page.keyboard.press('Escape');
	await closeSheet(page);
	const other = await picker(3);
	await expect(other.token).not.toHaveAttribute('data-misfit');
	// Warn, never lock: placed on Seat 2 anyway, with a note saying why.
	await page.keyboard.press('Escape');
	await closeSheet(page);
	const back = await picker(2);
	await back.token.tap();
	await expect(page.getByText(/the ability says different to last night/)).toBeVisible();
});

// https://wiki.bloodontheclocktower.com/Investigator: the Minion shown is another player; the
// other player shown may be the Investigator (Trevor, 2026-10-18).
test("the Investigator's own seat fits its Wrong; its Minion is marked and warns if placed", async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Investigator', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	const investigator = picker.getByRole('group', { name: 'Investigator' });
	await expect(investigator.getByRole('button').filter({ hasText: 'Wrong' })).not.toHaveAttribute(
		'data-misfit'
	);
	const minion = investigator.getByRole('button').filter({ hasText: 'Minion' });
	await expect(minion).toHaveAttribute('data-misfit', '');
	// Warn, never lock: it is still placed, with a note saying why.
	await minion.tap();
	await expect(picker.getByRole('group', { name: 'On this seat' }).getByRole('button')).toHaveCount(
		1
	);
	// The Investigator is no Minion, so its Minion never fits its own seat (Trevor, 2026-10-23:
	// no rule about self is needed).
	await expect(page.getByText(/the character type is not one it goes on/)).toBeVisible();
});

test('Resume game names a game’s alternative mode beside its script', async ({ page }) => {
	await startGame(page);
	const plain = new URL(page.url()).pathname;
	await startGame(page, 'Sects & Violets');
	// Started in Sushi Buffet, as the game modes feature records it (game-mode-store).
	const gameId = new URL(page.url()).pathname.split('/').pop()!;
	await page.evaluate(
		(id) =>
			localStorage.setItem(
				`grim-games:game-mode:v1:${id}`,
				JSON.stringify({ modeId: 'sushi-buffet', restrictions: { banned: [], allowed: [] } })
			),
		gameId
	);
	await page.goto('/games');
	const saved = page.getByRole('region', { name: 'Saved games' });
	await expect(saved.getByRole('link', { name: /Sects & Violets · Sushi Buffet/ })).toBeVisible();
	// A standard game shows nothing extra.
	await expect(saved.locator(`a[href$="${plain}"]`).getByTestId('game-mode')).toHaveCount(0);
});

/** Opens Board's Advanced part, which remembers being open. */
async function openBoardAdvanced(dialog: Locator) {
	const toggle = dialog.getByRole('button', { name: /^Advanced/ });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function reminderMode(page: Page, mode: 'Held by seat' | 'Stay where dropped') {
	await menu(page, 'Board');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await openBoardAdvanced(dialog);
	await dialog.getByRole('combobox', { name: 'Reminders', exact: true }).tap();
	await page.getByRole('option', { name: mode, exact: true }).tap();
	if (mode === 'Stay where dropped')
		await page
			.getByRole('alertdialog', { name: 'Reminders stay where dropped?' })
			.getByRole('button', { name: 'Confirm' })
			.tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
}

test('loose reminders belong to no seat, leave the bank, and are marked back in seat mode', async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Washerwoman', exact: true })
		.tap();
	await closeSheet(page);
	await reminderMode(page, 'Stay where dropped');

	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const inBank = (label: string) => bank.getByRole('button', { name: `${label} reminder` });
	await expect(inBank('Townsfolk')).toHaveCount(1);
	// Trevor (2026-10-18): dropped on a seat or anywhere else, it is put there, belongs to no
	// seat, and leaves the bank either way.
	const board = (await page.locator('.board').boundingBox())!;
	await dragTo(page, inBank('Townsfolk'), seatLabelled(page, 'Seat 2'));
	await dragTo(page, inBank('Wrong'), {
		x: board.x + board.width * 0.35,
		y: board.y + board.height * 0.4
	});
	await expect(inBank('Townsfolk')).toHaveCount(0);
	await expect(inBank('Wrong')).toHaveCount(0);
	const loose = page.locator('[data-loose]');
	await expect(loose).toHaveCount(2);

	// Back to held by seat: the loose ones are marked until each goes on a seat.
	await reminderMode(page, 'Held by seat');
	await expect(page.locator('[data-loose][data-unassigned]')).toHaveCount(2);
	const wrong = loose.getByRole('button', { name: 'Wrong reminder' });
	await dragTo(page, wrong, seatLabelled(page, 'Seat 3'));
	await expect(page.locator('[data-loose][data-unassigned]')).toHaveCount(1);
});

test("a reminder's ⋯ duplicates it into the bank, from the board or the bank", async ({ page }) => {
	// Two seats and a placed reminder take most of the default 30 s on a slow runner.
	test.slow();
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	await picker
		.getByRole('group', { name: 'Poisoner' })
		.getByRole('button', { name: 'Poisoned' })
		.tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await closeSheet(page);
	// A second Poisoner: the game gives two Poisoned tokens, one still in the bank.
	const second = await openSeat(page, 2);
	await second.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 2' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await closeSheet(page);
	const inBank = page
		.getByRole('list', { name: 'Reminder bank' })
		.getByRole('button', { name: 'Poisoned reminder' });
	await expect(inBank).toHaveCount(1);

	const onSeat = page.locator('.chip-slot[data-seat="1"]');
	await onSeat.getByRole('button', { name: 'Poisoned reminder' }).tap();
	await page.getByRole('button', { name: 'More reminder actions' }).tap();
	await page.getByRole('button', { name: 'Duplicate reminder' }).tap();
	// Trevor (2026-10-18): allowed, but more than the game gives, so it says so. The copy lands
	// in the bank, not on the board (Trevor, 2026-10-20).
	await expect(page.getByText(/More copies of this reminder than the game gives/)).toBeVisible();
	await expect(onSeat).toHaveCount(1);
	await expect(inBank).toHaveCount(2);
	// The copy is marked in the bank as it is on the board (Trevor, 2026-10-22).
	const bankExtras = page.locator('[aria-label="Reminder bank"] li[data-extra]');
	await expect(bankExtras).toHaveCount(1);
	await expect(bankExtras.getByRole('button', { name: 'Poisoned reminder' })).toHaveCount(1);
	// From the bank too, in its "Put on" (Trevor, 2026-10-20).
	await inBank.first().tap();
	const put = page.getByRole('dialog', { name: 'Put Poisoned on' });
	await put.getByRole('button', { name: 'More reminder actions' }).tap();
	await page.getByRole('button', { name: 'Duplicate reminder' }).tap();
	await expect(put).toBeHidden();
	await expect(inBank).toHaveCount(3);
	await expect(bankExtras).toHaveCount(2);
	// A copy in the bank is removed with the red trash, as on the board (Trevor, 2026-10-24);
	// the game's own token has none.
	await inBank.first().tap();
	await expect(put.getByRole('button', { name: 'Remove reminder' })).toHaveCount(0);
	await put.getByRole('button', { name: 'Close' }).tap();
	await bankExtras.getByRole('button', { name: 'Poisoned reminder' }).first().tap();
	await put.getByRole('button', { name: 'Remove reminder' }).tap();
	await expect(put).toBeHidden();
	await expect(inBank).toHaveCount(2);
	await expect(bankExtras).toHaveCount(1);
	// Placed, an added copy is marked as more than the game gives.
	for (let n = 0; n < 2; n++) {
		await inBank.first().tap();
		await put.getByRole('button', { name: /Seat 2$/ }).tap();
	}
	await expect(inBank).toHaveCount(0);
	await expect(page.locator('.chip-slot[data-extra]')).toHaveCount(1);
});

test('"+ New token" makes a reusable ∞ token whose copies carry its look', async ({ page }) => {
	// Plan B9 (Trevor, 2026-10-23: "Tokens only").
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await bank.getByRole('button', { name: 'New token' }).tap();
	const text = page.getByTestId('reminder-note');
	await text.fill('Red herring');
	await text.press('Enter');
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option', { name: 'Star', exact: true }).tap();
	await page.getByRole('combobox', { name: 'Symbol colour' }).tap();
	await page.getByRole('option', { name: 'Red', exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(text).toBeHidden();
	const token = bank.getByRole('button', { name: 'Generic reminder: Red herring' });
	await expect(token.locator('[data-symbol^="ph:"]')).toBeAttached();
	// "+ New token" stays last, after the plain ∞ and the new token.
	await expect(bank.locator('> li').last().getByRole('button')).toHaveAccessibleName('New token');

	// A copy goes on a seat with the token's look; the token stays in the bank.
	await token.tap();
	await page
		.getByRole('dialog', { name: /^Put .* on$/ })
		.getByRole('button', { name: /None Seat 1/ })
		.tap();
	const placed = page.locator(
		'[data-testid="board-reminder"][aria-label="Generic reminder: Red herring"]'
	);
	await expect(placed).toHaveCount(2);
	await expect(placed.first().locator('[data-symbol^="ph:"]')).toBeAttached();
	await expect(token).toHaveCount(1);

	// Saved with the game.
	await page.reload();
	await expect(token).toHaveCount(1);

	// Edited from its Put on sheet: the copy already placed keeps its words.
	await token.tap();
	await page.getByRole('button', { name: 'Edit token' }).tap();
	await text.fill('Changed');
	await text.press('Enter');
	await page.keyboard.press('Escape');
	await expect(text).toBeHidden();
	const changed = bank.getByRole('button', { name: 'Generic reminder: Changed' });
	await expect(changed).toHaveCount(1);
	await expect(placed).toHaveCount(1);

	// The red trash takes it out of the bank; the copy on the seat stays.
	await changed.tap();
	await page.getByRole('button', { name: 'Edit token' }).tap();
	await page.getByRole('button', { name: 'Delete token' }).tap();
	await expect(text).toBeHidden();
	await expect(changed).toHaveCount(0);
	await expect(placed).toHaveCount(1);
});

test('an ∞ token is edited beside a live preview of it', async ({ page }, testInfo) => {
	// Trevor (2026-10-24): two panes, the preview on the left; on a phone it is on top.
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await bank.getByRole('button', { name: 'New token' }).tap();
	const dialog = page.getByRole('dialog', { name: /token/ });
	const preview = dialog.getByTestId('generic-token-preview');
	const previewBox = (await dialog.getByTestId('dialog-aside').boundingBox())!;
	const fieldsBox = (await dialog.getByTestId('dialog-pane').boundingBox())!;
	if (testInfo.project.name === 'tablet') {
		expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(fieldsBox.x);
	} else {
		expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(fieldsBox.y);
	}

	// Each change shows at once, the text while it is typed, before Enter saves it.
	const token = preview.getByTestId('board-reminder');
	await expect(token).toHaveAttribute('aria-label', 'Generic reminder');
	await page.getByTestId('reminder-note').fill('Red herring');
	await expect(token).toHaveAttribute('aria-label', 'Generic reminder: Red herring');
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option', { name: 'Star', exact: true }).tap();
	await expect(token.locator('[data-symbol="ph:star"]')).toBeAttached();
	await page.getByText('Filled symbol', { exact: true }).tap();
	await expect(token.locator('[data-icon="ph:star-fill"] svg')).toBeAttached();
	// Picking a symbol kept the words typed before it.
	await expect(page.getByTestId('reminder-note')).toHaveValue('Red herring');
	await expect(token).toHaveAttribute('aria-label', 'Generic reminder: Red herring');
	await page.screenshot({ path: testInfo.outputPath('generic-token-editor.png') });
});

test('an ∞ token can have a filled symbol, and copying one is not unusual', async ({ page }) => {
	// Trevor (2026-10-23): fill is set on each ∞ token, a filled icon is drawn, and an ∞ token
	// has no "Uncommon" warning when copied.
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await bank.getByRole('button', { name: 'New token' }).tap();
	const filled = page.getByRole('checkbox', { name: 'Filled symbol' });
	const fillLabel = page.getByText('Filled symbol', { exact: true });
	// Only for an icon symbol, like its colour.
	await expect(filled).toBeDisabled();
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option', { name: 'Star', exact: true }).tap();
	await fillLabel.tap();
	await expect(filled).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(fillLabel).toBeHidden();
	const token = bank.getByRole('button', { name: 'Generic reminder' }).filter({
		has: page.locator('[data-symbol="ph:star"]')
	});
	// Drawn, not an empty box.
	await expect(token.locator('[data-icon="ph:star-fill"] svg')).toBeAttached();

	// A copy on a seat starts filled; its own sheet draws it as an outline again.
	await token.tap();
	await page
		.getByRole('dialog', { name: /^Put .* on$/ })
		.getByRole('button', { name: /None Seat 1/ })
		.tap();
	const placed = page
		.locator('.chip-slot[data-seat="1"]')
		.getByTestId('board-reminder')
		.filter({
			has: page.locator('[data-symbol="ph:star"]')
		});
	await expect(placed.locator('[data-icon="ph:star-fill"] svg')).toBeAttached();
	await placed.tap();
	await fillLabel.tap();
	await expect(filled).not.toBeChecked();
	await page.keyboard.press('Escape');
	await expect(placed.locator('[data-icon="ph:star-fill"]')).toHaveCount(0);
	await expect(placed.locator('[data-icon^="ph:star"] svg')).toBeAttached();
	// The bank's token stays filled.
	await expect(token.locator('[data-icon="ph:star-fill"]')).toBeAttached();

	// Duplicating an ∞ reminder gives no "Uncommon" warning.
	await placed.tap();
	await page.getByRole('button', { name: 'More reminder actions' }).tap();
	await page.getByRole('button', { name: 'Duplicate reminder' }).tap();
	await expect(page.getByText('Uncommon', { exact: true })).toHaveCount(0);
});

test('the generic ∞ reminder is always in the bank and can carry a few words', async ({ page }) => {
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	// Last in the bank, whatever is in play (Trevor, 2026-10-18), before "+ New token" (plan B9).
	await expect(bank.locator('> li').last().getByRole('button')).toHaveAccessibleName('New token');
	await expect(bank.locator('> li').nth(-2).getByTestId('board-reminder')).toHaveAttribute(
		'aria-label',
		'Generic reminder'
	);
	// Captioned ∞ above its cell, like the bank's other stretches (Trevor, 2026-10-19).
	const caption = page.getByTestId('bank-generic');
	await expect(caption).toHaveText('∞');
	const cell = (await bank.getByRole('button', { name: 'Generic reminder' }).boundingBox())!;
	const mark = (await caption.boundingBox())!;
	expect(mark.y + mark.height).toBeLessThanOrEqual(cell.y + 1);
	// From the stretch's line, as the other captions are, so over the cell's start.
	expect(mark.x).toBeLessThan(cell.x + cell.width / 2);
	expect(mark.x + mark.width).toBeGreaterThan(cell.x);
	await bank.getByRole('button', { name: 'Generic reminder' }).tap();
	await page
		.getByRole('dialog', { name: 'Put ∞ on' })
		.getByRole('button', { name: /None Seat 1/ })
		.tap();
	await expect(seatLabelled(page, 'Seat 1: no name, no character, 1 reminder')).toBeAttached();
	// Placing one never uses it up.
	await expect(bank.getByRole('button', { name: 'Generic reminder' })).toHaveCount(1);

	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Actions for ∞' }).tap();
	const text = page.getByTestId('reminder-note');
	await text.fill('Chose Sam');
	await text.press('Enter');
	// Its own symbol (Trevor, 2026-10-19: chosen per token); none by default.
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option', { name: 'Owl', exact: true }).tap();
	// Its symbol's colour (Trevor, 2026-10-20: per token): kept in place, but an emoji keeps
	// its own colours, so it waits for an icon symbol.
	const colour = page.getByRole('combobox', { name: 'Symbol colour' });
	await expect(colour).toBeDisabled();
	await page.keyboard.press('Escape');
	await closeSheet(page);
	const placed = page.locator(
		'[data-testid="board-reminder"][aria-label="Generic reminder: Chose Sam"]'
	);
	await expect(placed).toHaveCount(1);
	// Look C: the chosen symbol in the middle; the bank's stays blank.
	await expect(placed.locator('[data-symbol="🦉"]')).toBeVisible();
	const blank = bank.getByRole('button', { name: 'Generic reminder' });
	await expect(blank.locator('[data-symbol]')).toHaveCount(0);
	// The dashed ring inside the rim only while the token is empty; once it carries a symbol
	// the rim's colour says enough (Trevor, 2026-10-19).
	const ring = (el: Element) => getComputedStyle(el, '::before').borderStyle;
	expect(await blank.evaluate(ring)).toBe('dashed');
	expect(await placed.evaluate(ring)).not.toBe('dashed');
	// A rim round the token and its words, like every other reminder (Trevor, 2026-10-19).
	const colours = await placed.evaluate((el) => {
		const css = getComputedStyle(el);
		const label = el.querySelector('.label');
		return {
			rim: css.borderTopColor,
			face: css.backgroundColor,
			band: label ? getComputedStyle(label).boxShadow : ''
		};
	});
	expect(colours.rim).not.toBe(colours.face);
	expect(colours.band).toContain(colours.rim);

	// An icon symbol takes a colour from the theme's own, and Default gives it back its ink.
	await openSeat(page, 1);
	await page.getByRole('button', { name: 'Actions for Chose Sam' }).tap();
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option', { name: 'Star', exact: true }).tap();
	const icon = placed.locator('[data-symbol^="ph:"]');
	await expect(icon).toBeAttached();
	const ink = await icon.evaluate((el) => getComputedStyle(el).color);
	await expect(colour).toBeEnabled();
	await colour.tap();
	await page.getByRole('option', { name: 'Red', exact: true }).tap();
	const evil = await page.evaluate(() => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--evil)';
		document.body.append(probe);
		const value = getComputedStyle(probe).color;
		probe.remove();
		return value;
	});
	await expect(icon).toHaveCSS('color', evil);
	await colour.tap();
	await page.getByRole('option', { name: 'Default', exact: true }).tap();
	await expect(icon).toHaveCSS('color', ink);
	// None takes the symbol off again.
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option', { name: 'None', exact: true }).tap();
	await expect(placed.locator('[data-symbol]')).toHaveCount(0);
	await expect(colour).toBeDisabled();
});

// Closing a step opened from the walk-through must not crash the dialog (Grimoire board,
// 2026-10-18). On a phone the tap also opens a glossary word in the strip's text, and closing
// the step closed that popover from inside zag, which crashed Svelte (null batch).
test('a step opened from the walk-through closes cleanly', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await startGame(page);
	for (const [number, name] of [
		[1, 'Washerwoman'],
		[2, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const strip = await walkTo(page, 'Washerwoman');
	await strip.locator('button.step').tap();
	const step = page.getByRole('dialog', { name: 'Washerwoman' });
	await expect(step).toBeVisible();
	await step.getByRole('button', { name: 'Close' }).tap();
	await expect(step).toBeHidden();
	await expect(page.getByText("Couldn't show this part")).toHaveCount(0);
	await expect(strip).toContainText('Washerwoman');
	expect(errors).toEqual([]);
});

test('placing the Scarlet Woman\'s "Is The Demon" offers to change her into the Demon', async ({
	page
}) => {
	// She becomes the Demon who died (https://wiki.bloodontheclocktower.com/Scarlet_Woman).
	await startGame(page);
	for (const [number, name] of [
		[1, 'Scarlet Woman'],
		[2, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: 'Reminders for Seat 1' });
	await picker
		.getByRole('group', { name: 'Scarlet Woman' })
		.getByRole('button', { name: 'Is The Demon' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Change into the Demon?' });
	await expect(ask).toContainText(/Current character\s*Scarlet Woman/);
	await expect(ask).toContainText(/New character\s*Imp/);
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await expect(sheet).toContainText(/Imp\s*Demon · Evil · Seat 1/);
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, Imp, 1 reminder')).toBeAttached();
});

test('the night walk-through rises into place, and appears at once with reduced motion', async ({
	page
}) => {
	// Trevor (2026-10-19): a transition instead of appearing instantly; the shared `rise`.
	await startGame(page);
	// A character in play, so there is a night to run.
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await closeSheet(page);
	// Counts the animations started on the strip, however fast the runner is: Svelte's
	// transitions run through Element.animate.
	await page.evaluate(() => {
		const w = window as unknown as { stripAnimations: number };
		w.stripAnimations = 0;
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (...args) {
			if (this.matches('[data-testid="night-strip"]')) w.stripAnimations++;
			return animate.apply(this, args);
		};
	});
	const animations = () =>
		page.evaluate(() => (window as unknown as { stripAnimations: number }).stripAnimations);
	const strip = page.getByTestId('night-strip');
	await bankNight(page, 'Start game').tap();
	await expect(strip).toBeVisible();
	await expect.poll(animations).toBeGreaterThan(0);

	await page.getByRole('button', { name: 'Stop the walk-through' }).tap();
	await expect(strip).toHaveCount(0);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.evaluate(
		() => ((window as unknown as { stripAnimations: number }).stripAnimations = 0)
	);
	await bankNight(page, 'Start game').tap();
	await expect(strip).toBeVisible();
	// No motion: the strip is there at once, fully shown.
	await expect(strip).toHaveCSS('opacity', '1');
});

test('the seat last touched draws over the seats it overlaps, name and all', async ({ page }) => {
	// Trevor (2026-10-19): where tokens overlap, the one last touched is on top.
	await startGame(page);
	for (const [number, name] of [
		[1, 'Empath'],
		[2, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const seat = (n: number) => page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) });
	const one = (await seat(1).boundingBox())!;
	const two = (await seat(2).boundingBox())!;
	// Seat 2, drawn after seat 1, goes just below it: its token covers seat 1's badge, but
	// it is too far off seat 1 to be a drop that swaps their places (closer than 0.6 of a
	// token). Measured on the token itself, as fonts change the button's box.
	const size = await seatLabelled(page, 'Seat 1:').evaluate((el) =>
		parseFloat(getComputedStyle(el).getPropertyValue('--size'))
	);
	const from = { x: two.x + two.width / 2, y: two.y + two.height / 2 };
	const to = { x: one.x + one.width / 2, y: one.y + one.height / 2 + size * 0.7 };
	await menu(page, 'Arrange seats');
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await expect(toolbar).toContainText('Arrange seats');
	await expect(page.getByRole('dialog', { name: 'Grimoire' })).toBeHidden();
	// Under load the first press can land before the seats take drags: drag until it moves.
	await expect(async () => {
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
		await page.mouse.move(to.x, to.y, { steps: 4 });
		await page.mouse.up();
		const at = (await seat(2).boundingBox())!.x;
		// What took the press, if not the seat: shown in the log when the drag misses.
		if (Math.abs(at - one.x) >= 0.5)
			console.log(
				'missed drag, pressed on:',
				await page.evaluate(
					({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 200),
					from
				)
			);
		expect(at).toBeCloseTo(one.x, 0);
	}).toPass();
	await toolbar.getByRole('button', { name: 'Done' }).tap();
	await expect(seatLabelled(page, 'Seat 2: no name, Imp')).toBeAttached();

	// What is drawn on top at the middle of a badge: its own pill, or another seat. Badges let
	// taps through to their token, so the probe makes just the pills hit-testable.
	await page.addStyleTag({
		content: '[data-testid="token-player-name"] > * { pointer-events: auto !important; }'
	});
	const onTop = (n: number) =>
		seatLabelled(page, `Seat ${n}:`)
			.getByTestId('token-player-name')
			.evaluate((svg) => {
				const pill = svg.querySelector('rect')!.getBoundingClientRect();
				const hit = document.elementFromPoint(pill.x + pill.width / 2, pill.y + pill.height / 2);
				return hit?.closest('[data-testid="token-player-name"]') === svg;
			});
	// Seat 2 was dragged last: it covers seat 1's name. Polled, as the seat may still be
	// gliding into place.
	await expect.poll(() => onTop(2)).toBe(true);
	await expect.poll(() => onTop(1)).toBe(false);
	// Tapping seat 1 brings it to the front, its name with it.
	await openSeat(page, 1);
	await closeSheet(page);
	await expect.poll(() => onTop(1)).toBe(true);
});

test('a big name badge beside a dialog title shrinks instead of squeezing the title', async ({
	page
}) => {
	// Trevor (2026-10-19): at 150% names in text the seat menu read "S-E-A-T 8" down the side.
	await page.addInitScript(() => {
		const key = 'grim-games:preferences:v1';
		const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
		saved.tokenAppearance = {
			...saved.tokenAppearance,
			inlineNameTextScale: 1.5,
			inlineNameIconScale: 1.5,
			inlineNameBadgeScale: 1.5
		};
		localStorage.setItem(key, JSON.stringify(saved));
	});
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	const menu = page.getByRole('dialog', { name: 'Seat 1', exact: true });
	const title = menu.locator('[data-part="title"]');
	await expect(title).toHaveText('Seat 1');
	// One line: no word is broken across lines, so the title is no taller than its line.
	const { height, line } = await title.evaluate((el) => ({
		height: el.getBoundingClientRect().height,
		line: parseFloat(getComputedStyle(el).fontSize) * 1.6
	}));
	expect(height).toBeLessThanOrEqual(line);
	// The badge stays in the header, beside the title and the ✕, not over them.
	const head = await menu.locator('.head').boundingBox();
	const badge = await menu.locator('.lead').boundingBox();
	const close = await menu.getByRole('button', { name: 'Close' }).boundingBox();
	expect(badge!.x).toBeGreaterThanOrEqual(head!.x - 1);
	expect(badge!.x + badge!.width).toBeLessThanOrEqual(close!.x);
});

test('the Storyteller is named on the Characters screen and renamed from the corner', async ({
	page
}) => {
	// Trevor, 2026-10-19: the name goes "on the screen you pick characters, not on the new game
	// screen", and is edited "in bottom left of screen" (the corner script name's Game info).
	await page.goto('/new');
	await expect(page.getByRole('textbox', { name: 'Storyteller' })).toHaveCount(0);
	await startGame(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/setup`);
	const field = page.getByRole('textbox', { name: 'Storyteller' });
	await expect(field).toHaveValue('');
	await field.fill('Trev');
	await field.press('Enter');
	await page.reload();
	await expect(field).toHaveValue('Trev');
	// The ⋯ menu has no Storyteller entry; Game info has the name.
	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(more.getByRole('button', { name: 'Storyteller', exact: true })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(more).toBeHidden();
	await openGameInfo(page);
	const info = page.getByRole('dialog', { name: 'Game info', exact: true });
	// One pencil in Game info's header edits what can change (Trevor, 2026-10-19).
	await expect(info.locator('tr[data-field="storyteller"] button')).toHaveCount(0);
	await info.getByTestId('game-info-edit').tap();
	await expect(info).toBeHidden();
	const dialog = page.getByRole('dialog', { name: 'Edit game info' });
	const name = dialog.getByRole('textbox', { name: 'Storyteller' });
	await expect(name).toHaveValue('Trev');
	await name.fill('Sam');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog).toBeHidden();
	await page.goto(`${board}/setup`);
	await expect(field).toHaveValue('Sam');
	// A new game offers the name typed last.
	await page.goto('/new');
	await startGame(page);
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await expect(field).toHaveValue('Trev');
});

test('the corner script name opens the game’s info, in a Standard game too', async ({ page }) => {
	// Trevor, 2026-10-19: "Allow tapping on the script name ... even in normal mode".
	await startGame(page);
	await nameStoryteller(page, 'Trev');
	const dialog = page.getByRole('dialog', { name: 'Game info', exact: true });
	const row = (field: string) => dialog.locator(`tr[data-field="${field}"] td`);
	await openGameInfo(page);
	await expect(row('script')).toHaveText('Trouble Brewing');
	await expect(row('storyteller')).toHaveText('Trev');
	// Trevor, 2026-10-19: "In Game info, include player count as well", then how the
	// characters split by type: the standard split until characters are assigned.
	const seats = await page.getByTestId('seat').count();
	await expect(row('players')).toHaveText(
		new RegExp(`^${seats} \\(\\d+ Townsfolk, \\d+ Outsiders?, \\d+ Minions?, 1 Demon\\)$`)
	);
	await expect(row('mode')).toHaveText('Standard');
	await expect(row('rules')).toHaveText('None');
	await expect(row('version')).toHaveText('None');
});

test('the corner’s Game info closes when a seat opens', async ({ page }) => {
	// Trevor, 2026-10-19: "Game info popup should close if other item is opened like a character".
	await startGame(page);
	const corner = page.getByTestId('mode-menu');
	// A phone before setup has no room for the corner name; Game info is then a ⋯ dialog.
	if (!(await corner.isVisible())) return;
	await corner.tap();
	const info = page.getByRole('dialog', { name: 'Game info', exact: true });
	await expect(info).toBeVisible();
	await openSeat(page, 1);
	await expect(info).toBeHidden();
});

test('Dawn is the last night step, and Next on it lights up End night', async ({ page }) => {
	// Trevor (2026-10-19): Next past the end points at End night; it never ends the night.
	// Dawn is always the last step (Trevor, 2026-10-20).
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await closeSheet(page);
	await bankNight(page, 'Start game').tap();
	const strip = page.getByTestId('night-strip');
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && !(await lastStep(strip)); i++) await next.tap();
	await expect(strip.locator('.step .name strong')).toHaveText('Dawn');
	const end = bankNight(page, 'End night');
	await expect(end).not.toHaveAttribute('data-hint');
	await next.tap();
	await expect(next).toBeEnabled();
	// Ticking Dawn here doesn't start the day: End night does, after asking.
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toHaveCount(0);
	await expect(end).toHaveAttribute('data-hint', '');
	// A ring on the cell's own edge, following its rounded corners (Trevor, 2026-10-20).
	const ring = await end.evaluate((el) => {
		const css = getComputedStyle(el);
		return { shadow: css.boxShadow, outline: css.outlineStyle };
	});
	expect(ring.shadow).toContain('inset');
	expect(ring.outline).toBe('none');
	await expect(strip).toBeVisible();
	// It fades after a moment, and lights up again on the next tap.
	await expect(end).not.toHaveAttribute('data-hint', { timeout: 5000 });
	await next.tap();
	await expect(end).toHaveAttribute('data-hint', '');
});

// Trevor, 2026-10-19: each special rule helps run the game. I See Dead People: poisoned
// players don't wake (https://beardytas.com/garden-of-djinn/i-see-dead-people/).
test('with I See Dead People, the walk-through says a poisoned player doesn’t wake', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: /^Special rules/ }).tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await rules.getByText('I See Dead People', { exact: true }).tap();
	await rules.getByRole('button', { name: 'Close' }).tap();
	await expect(rules).toBeHidden();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await toBoard(page);
	for (const [number, name] of [
		[1, 'Poisoner'],
		[2, 'Empath']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const guide = await openStep(page, 'Poisoner');
	await guide.getByRole('button', { name: 'Place' }).tap();
	await page
		.getByRole('dialog', { name: 'Put Poisoned on' })
		.getByRole('button', { name: /Empath Seat 2/ })
		.tap();
	await guide.getByRole('button', { name: 'Close' }).tap();

	const strip = await walkTo(page, 'Poisoner');
	await expect(strip.getByTestId('step-asleep')).toHaveCount(0);
	await walkTo(page, 'Empath');
	await expect(strip.getByTestId('step-asleep')).toHaveText(
		'Poisoned: doesn’t wake (I See Dead People)'
	);
});

// https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/: seat 7 is dealt a character
// but no one plays it; its choices are arbitrary.
test('with The Ballad of Seat 7, the walk-through says seat 7 has no player', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: /^Special rules/ }).tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await rules.getByText('The Ballad of Seat 7', { exact: true }).tap();
	await rules.getByRole('button', { name: 'Close' }).tap();
	await expect(rules).toBeHidden();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await toBoard(page);
	for (const [number, name] of [
		[6, 'Washerwoman'],
		[7, 'Empath']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}

	const strip = await walkTo(page, 'Washerwoman');
	await expect(strip.getByTestId('step-empty-seat')).toHaveCount(0);
	await walkTo(page, 'Empath');
	await expect(strip.getByTestId('step-empty-seat')).toHaveText(
		'No player: make its choices (The Ballad of Seat 7)'
	);
});

test('a Dead reminder put on a living player asks whether to mark them dead', async ({ page }) => {
	// Trevor (2026-10-19): placing a death reminder offers to mark the player dead; a help
	// switch turns the question off. The Imp's "Dead" (https://wiki.bloodontheclocktower.com/Imp).
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await closeSheet(page);

	const addDead = async (seat: number) => {
		const s = await openSeat(page, seat);
		await s.getByRole('button', { name: 'Add reminder' }).tap();
		const picker = page.getByRole('dialog', { name: `Reminders for Seat ${seat}` });
		await picker.getByRole('group', { name: 'Imp' }).getByRole('button', { name: 'Dead' }).tap();
	};
	await addDead(2);
	const ask = page.getByRole('alertdialog', { name: 'Mark Seat 2 dead?' });
	await expect(ask).toBeVisible();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(seatLabelled(page, 'Seat 2: no name, no character, dead')).toBeAttached();
	await page.keyboard.press('Escape');
	// The reminder's own character is the cause (Trevor, 2026-10-23: "it should know the token
	// caused the death").
	await expect(
		page
			.locator('[data-scope="drawer"][data-part="content"]')
			.getByRole('button', { name: /^Status: Dead: Imp/ })
	).toBeVisible();
	await closeSheet(page);

	// Cancel leaves them alive; switched off, it never asks.
	await addDead(3);
	const again = page.getByRole('alertdialog', { name: 'Mark Seat 3 dead?' });
	await again.getByText('Ask to mark dead', { exact: true }).tap();
	await again.getByRole('button', { name: 'Cancel', exact: true }).tap();
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
	await page.keyboard.press('Escape');
	await closeSheet(page);
	await addDead(4);
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 1 reminder')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 4: no name, no character, 1 reminder')).not.toHaveAttribute(
		'aria-label',
		/dead/
	);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('when the Imp kills itself, a living Minion is chosen to become the Imp', async ({ page }) => {
	// Trevor (2026-10-19): the Imp's star pass (https://wiki.bloodontheclocktower.com/Imp).
	await startGame(page);
	for (const [number, name] of [
		[1, 'Chef'],
		[3, 'Imp'],
		[4, 'Poisoner']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const sheet = await openSeat(page, 3);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 3' })
		.getByRole('button', { name: 'The Demon' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Choose the new Imp' });
	await expect(ask.getByRole('radio', { name: /Seat 4/, includeHidden: true })).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 4: no name, Imp')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 3: no name, Imp')).toHaveAttribute('aria-label', /dead/);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('a player whose character changed since dawn is woken that night to learn it', async ({
	page
}) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Poisoner'],
		[2, 'Imp']
	] as const) {
		const sheet = await openSeat(page, number);
		if (number === 1) await nameSeat(sheet, 'Sam');
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for ${number === 1 ? 'Sam' : 'Seat 2'}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await endNight(page);
	await page.getByRole('dialog', { name: 'Day 1' }).getByRole('button', { name: 'Close' }).tap();

	// The Poisoner becomes the Imp (https://wiki.bloodontheclocktower.com/Imp: the new Imp is
	// woken and shown the Imp token).
	const sheet = await openSeat(page, 1);
	await seatMenu(page, sheet, 'Change character');
	await page
		.getByRole('dialog', { name: 'Character for Sam' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'Change character?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await closeSheet(page);

	const strip = await walkTo(page, 'Dusk');
	for (let i = 0; i < 30 && !(await lastStep(strip)); i++)
		await strip.getByRole('button', { name: 'Next step' }).tap();
	// Just before Dawn, the last step.
	await expect(strip.locator('.step .name strong')).toHaveText('Dawn');
	await strip.getByRole('button', { name: 'Previous step' }).tap();
	await expect(strip.locator('.step .name strong')).toHaveText('Imp');
	await expect(strip).toContainText('Sam');
	await expect(strip).toContainText('Wake this player.');
	await expect(strip).toContainText('You are');
});

test('an Alive reminder put on a dead player asks whether to revive them', async ({ page }) => {
	// Trevor (2026-10-19): the same question as a Dead reminder, the other way round. The
	// Shabaloth may bring back a player it killed (https://wiki.bloodontheclocktower.com/Shabaloth).
	await startGame(page, 'Bad Moon Rising');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Shabaloth', exact: true })
		.tap();
	await closeSheet(page);

	const add = async (seat: number, label: 'Dead' | 'Alive') => {
		const s = await openSeat(page, seat);
		await s.getByRole('button', { name: 'Add reminder' }).tap();
		const picker = page.getByRole('dialog', { name: `Reminders for Seat ${seat}` });
		await picker
			.getByRole('group', { name: 'Shabaloth' })
			.getByRole('button', { name: label === 'Dead' ? 'Dead, copy 1 of 2' : label, exact: true })
			.tap();
	};
	await add(2, 'Dead');
	await page
		.getByRole('alertdialog', { name: 'Mark Seat 2 dead?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(seatLabelled(page, 'Seat 2: no name, no character, dead')).toBeAttached();
	await page.keyboard.press('Escape');
	await closeSheet(page);

	await add(2, 'Alive');
	const ask = page.getByRole('alertdialog', { name: 'Revive Seat 2?' });
	await expect(ask).toBeVisible();
	await expect(ask.getByText('Ask to revive', { exact: true })).toBeVisible();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(seatLabelled(page, 'Seat 2: no name, no character, 2 reminders')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 2:')).not.toHaveAttribute('aria-label', /dead/);
	await page.keyboard.press('Escape');
	await closeSheet(page);

	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('two copies of a character each have their own reminders, in their own colour', async ({
	page
}) => {
	// Trevor (2026-10-19): a good Imp and an evil Imp. The Imp lists one "Dead" token
	// (https://wiki.bloodontheclocktower.com/Imp), so each Imp has one, in its colour.
	await startGame(page);
	for (const number of [1, 3]) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name: 'Imp', exact: true })
			.tap();
		if (number === 3) {
			await seatMenu(page, sheet, 'Change alignment');
			await page
				.getByRole('dialog', { name: 'Alignment' })
				.getByRole('button', { name: 'Confirm' })
				.tap();
			await expect(sheet).toContainText(/Imp\s*Demon · Good · Seat 3/);
		}
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const dead = bank.locator('[data-testid="board-reminder"][aria-label="Dead reminder"]');
	await expect(dead).toHaveCount(2);
	await expect(dead.nth(0).locator('img')).toHaveAttribute('src', /imp_e\.webp$/);
	await expect(dead.nth(1).locator('img')).toHaveAttribute('src', /imp_g\.webp$/);

	// The good Imp's token keeps its colour on the board; the evil Imp's stays in the bank.
	await dead.nth(1).tap();
	await page
		.getByRole('dialog', { name: 'Put Dead on' })
		.getByRole('button', { name: /None Seat 2/ })
		.tap();
	// A Dead reminder asks whether to mark the player dead; not this time.
	await page
		.getByRole('alertdialog', { name: 'Mark Seat 2 dead?' })
		.getByRole('button', { name: 'Cancel' })
		.tap();
	await expect(dead).toHaveCount(1);
	await expect(dead.locator('img')).toHaveAttribute('src', /imp_e\.webp$/);
	const all = page.locator('[data-testid="board-reminder"][aria-label="Dead reminder"] img');
	await expect(all).toHaveCount(2);
	const srcs = await all.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src') ?? ''));
	expect(srcs.filter((src) => /imp_g\.webp$/.test(src))).toHaveLength(1);
});

test('an empty seat and a named one show their name in the same badge', async ({ page }) => {
	// Trevor (2026-10-19): "an added empty seat looks slightly different ... consolidate".
	await startGame(page);
	const badge = (seat: number) =>
		seatLabelled(page, `Seat ${seat}:`).getByTestId('token-player-name');
	await expect(badge(1)).toHaveText('Seat 1');
	const before = await badge(1).boundingBox();
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Ana');
	await closeSheet(page);
	await expect(badge(1)).toHaveText('Ana');
	expect((await badge(1).boundingBox())?.y).toBeCloseTo(before!.y, 0);
	await expect(seatLabelled(page, 'Seat 1:').locator('.name')).toHaveCount(0);
});

test("holding a seat's token lights its character's reminders and dims the rest", async ({
	page
}) => {
	// Trevor (2026-10-19): holding a token on the grimoire highlights the reminder tokens
	// assigned to that character. Two Imps, so only the held one's "Dead" token lights.
	await startGame(page);
	for (const number of [1, 3]) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name: 'Imp', exact: true })
			.tap();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const dead = bank.locator('[data-testid="board-reminder"][aria-label="Dead reminder"]');
	await expect(dead).toHaveCount(2);
	// Seat 3's copy onto Seat 2; Seat 1's stays in the bank.
	await dead.nth(1).tap();
	await page
		.getByRole('dialog', { name: 'Put Dead on' })
		.getByRole('button', { name: /None Seat 2/ })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'Mark Seat 2 dead?' })
		.getByRole('button', { name: 'Cancel' })
		.tap();
	await expect(page.getByRole('alertdialog')).toBeHidden();
	const placed = page.locator('.chip-slot[data-seat="2"]');
	await expect(placed).toHaveCount(1);

	const seat = async (number: number) =>
		(await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).boundingBox())!;
	const lit = page.locator('[data-lit]');
	const deadCell = bank.locator('li', { has: page.locator('[aria-label="Dead reminder"]') });
	// Seat 3 held: its token on Seat 2 lights, the bank's other Imp token and other seats dim.
	const three = await seat(3);
	await page.mouse.move(three.x + three.width / 2, three.y + three.height / 2);
	await page.mouse.down();
	await expect(placed).toHaveAttribute('data-lit', 'true');
	await expect(lit).toHaveCount(1);
	await expect(deadCell).toHaveClass(/dim/);
	await expect(page.locator('.slot.dim')).toHaveCount(7);
	await page.mouse.up();
	// Let go: nothing lit or dimmed, and the hold opened nothing.
	await expect(lit).toHaveCount(0);
	await expect(page.locator('.slot.dim')).toHaveCount(0);
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();

	// Seat 1 held: only its token, still in the bank, lights.
	const one = await seat(1);
	await page.mouse.move(one.x + one.width / 2, one.y + one.height / 2);
	await page.mouse.down();
	await expect(deadCell).toHaveAttribute('data-lit', 'true');
	await expect(placed).toHaveClass(/dim/);
	await page.mouse.up();
	await expect(lit).toHaveCount(0);
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();

	// Board > Advanced (Trevor, 2026-10-23): the reminders on the held seat light instead,
	// whoever's they are, so Seat 2 lights Seat 3's token and Seat 3 lights nothing.
	await openSettingsDialog(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board' })
		.tap();
	await settings.getByRole('button', { name: /Advanced/ }).tap();
	await settings.getByText("Holding a token lights its seat's reminders", { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
	const hold = async (number: number) => {
		const box = await seat(number);
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
	};
	await hold(2);
	await expect(placed).toHaveAttribute('data-lit', 'true');
	await expect(lit).toHaveCount(1);
	await expect(deadCell).toHaveClass(/dim/);
	await page.mouse.up();
	await expect(lit).toHaveCount(0);
	await hold(3);
	await expect(placed).toHaveClass(/dim/);
	await expect(lit).toHaveCount(0);
	await page.mouse.up();
});

test('with Hold a seat, then drag on, a held seat drags to a new place without opening', async ({
	page
}) => {
	// Trevor (2026-10-25): a setting so a long press on a token then a drag moves it, to try
	// with Storytellers before choosing the built-in behaviour. Off, a hold moves nothing.
	await startGame(page);
	const seat = (n: number) => page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) });
	const centre = async (n: number) => {
		const box = (await seat(n).boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	const board = (await page.locator('.board').boundingBox())!;
	const to = { x: board.x + board.width / 2, y: board.y + board.height * 0.3 };
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	const holdAndDrag = async () => {
		const from = await centre(1);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await expect(page.locator('.slot.dim')).toHaveCount(7);
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
		await page.mouse.move(to.x, to.y, { steps: 4 });
		await page.mouse.up();
		await expect(page.locator('.slot.dim')).toHaveCount(0);
	};

	const start = await centre(1);
	await holdAndDrag();
	expect(await centre(1)).toEqual(start);
	await expect(sheet).toBeHidden();

	await openSettingsDialog(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board' })
		.tap();
	await settings.getByRole('button', { name: /Advanced/ }).tap();
	await settings.getByText('Hold a seat, then drag, to move it', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();

	const seat2 = await centre(2);
	await holdAndDrag();
	const moved = await centre(1);
	expect(Math.abs(moved.x - to.x)).toBeLessThan(4);
	expect(Math.abs(moved.y - to.y)).toBeLessThan(4);
	expect(await centre(2)).toEqual(seat2);
	await expect(sheet).toBeHidden();
	// A tap still opens the seat.
	await openSeat(page, 1);
	await closeSheet(page);
});

test('the walk-through shows the character, then its player below, with the count at the top right', async ({
	page
}) => {
	// Trevor (2026-10-20): the player's name on the second line; the count always right-aligned
	// in the top row, before ⋯ and X, never wrapped under the name.
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Samantha Longname-Example');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Samantha Longname-Example' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await closeSheet(page);
	const strip = await walkTo(page, 'Fortune Teller');
	await expect(strip.locator('.body > .name')).not.toContainText('Samantha');
	// What to do comes before any information, such as suggestions (Trevor, 2026-10-20).
	const order = await strip.locator('.body').evaluate((body) => {
		const kids = [...body.children];
		const at = (selector: string) => kids.findIndex((kid) => kid.matches(selector));
		return { text: at('.text'), info: at('[data-testid^="night-"]') };
	});
	expect(order.text).toBeGreaterThan(-1);
	if (order.info > -1) expect(order.text).toBeLessThan(order.info);
	const who = strip.locator('.who');
	await expect(who).toHaveText('Samantha Longname-Example');
	const name = (await strip.locator('.body > .name strong').boundingBox())!;
	expect((await who.boundingBox())!.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
	const count = (await strip.locator('.count').boundingBox())!;
	const more = (await strip.getByRole('button', { name: 'Character reminders' }).boundingBox())!;
	expect(count.x + count.width).toBeLessThanOrEqual(more.x + 1);
	expect(count.x + count.width).toBeGreaterThan(more.x - 20);
	expect(count.y).toBeLessThan(more.y + more.height);
});

test("putting a dead character's reminder on the board asks first", async ({ page }) => {
	// Trevor (2026-10-20): a dead Witch curses no one
	// (https://wiki.bloodontheclocktower.com/Witch), so placing her Cursed asks; the
	// Sweetheart's Drunk goes down once she dies
	// (https://wiki.bloodontheclocktower.com/Sweetheart), so it never asks.
	await startGame(page, 'Sects & Violets');
	for (const [number, name] of [
		[1, 'Witch'],
		[3, 'Sweetheart']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
		await page
			.getByRole('dialog', { name: `Status of Seat ${number}` })
			.getByRole('button', { name: 'Executed' })
			.tap();
		await closeSheet(page);
	}
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const put = async (label: string) => {
		await bank.getByRole('button', { name: `${label} reminder` }).tap();
		await page
			.getByRole('dialog', { name: `Put ${label} on` })
			.getByRole('button', { name: /None Seat 2/ })
			.tap();
	};
	const onBoard = (label: string) => page.locator(`.chip-slot [aria-label="${label} reminder"]`);
	const ask = page.getByRole('alertdialog', { name: /^Place/ });

	// Cancel takes it back off; Confirm keeps it.
	await put('Cursed');
	await expect(ask).toContainText('is dead.');
	await expect(
		ask.getByText("Ask before a dead character's reminder", { exact: true })
	).toBeVisible();
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(onBoard('Cursed')).toHaveCount(0);
	await put('Cursed');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(onBoard('Cursed')).toHaveCount(1);

	await put('Drunk');
	await expect(onBoard('Drunk')).toHaveCount(1);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('Start game with setup reminders still to place asks first, listing them', async ({
	page
}) => {
	// Trevor (2026-10-20): a reminder, never a lock. The Fortune Teller's Red Herring is placed
	// at setup (https://wiki.bloodontheclocktower.com/Fortune_Teller).
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await closeSheet(page);
	await bankNight(page, 'Start game').tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(ask.getByTestId('setup-left')).toContainText('Red Herring');
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page.getByTestId('night-strip')).toHaveCount(0);
	await bankNight(page, 'Start game').tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
});

test('a Fool marked dead is offered to survive their first death', async ({ page }) => {
	// Trevor (2026-10-22): the Fool's first death (https://wiki.bloodontheclocktower.com/Fool),
	// never against the Assassin (https://wiki.bloodontheclocktower.com/Assassin).
	await startGame(page, 'Bad Moon Rising');
	for (const [number, name] of [
		[1, 'Fool'],
		[2, 'Assassin'],
		[3, 'Zombuul']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 1' })
		.getByRole('button', { name: 'The Demon' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Use the Fool’s ability?' });
	await expect(ask).toContainText('No Ability');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, Fool, 1 reminder')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 1: no name, Fool, 1 reminder')).not.toHaveAttribute(
		'aria-label',
		/dead/
	);
});

/** A Trouble Brewing game with one special rule, these seats given these characters. */
async function startWithRule(
	page: Page,
	rule: string,
	cast: readonly (readonly [number, string])[]
) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: /^Special rules/ }).tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await rules.getByText(rule, { exact: true }).tap();
	await rules.getByRole('button', { name: 'Close' }).tap();
	await expect(rules).toBeHidden();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await toBoard(page);
	for (const [number, name] of cast) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
}

/** From a night's walk-through, through the day, to the next night's Dusk. */
async function nextNight(page: Page) {
	await endNight(page);
	const day = page.getByRole('dialog', { name: /^Day \d+$/ });
	await expect(day).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(day).toBeHidden();
	// The night's strip slides away before the next night can start.
	await expect(page.getByTestId('night-strip')).toHaveCount(0);
	await walkTo(page, 'Dusk');
}

/** Every step name in tonight's walk-through, from the current step on. */
async function stepNames(page: Page): Promise<string[]> {
	const strip = page.getByTestId('night-strip');
	const names: string[] = [];
	for (let i = 0; i < 30; i++) {
		names.push((await strip.locator('.step .name strong').textContent()) ?? '');
		if (await lastStep(strip)) break;
		await strip.getByRole('button', { name: 'Next step' }).tap();
	}
	return names;
}

test('with The Phantom Detectives, living Townsfolk sleep and the dead keep waking', async ({
	page
}) => {
	// https://schnauzerclub.neocities.org/scripts/thephantomdetectives (Trevor, 2026-10-22).
	await startWithRule(page, 'The Phantom Detectives', [
		[1, 'Washerwoman'],
		[2, 'Poisoner'],
		[3, 'Imp']
	]);
	await walkTo(page, 'Dusk');
	const first = await stepNames(page);
	expect(first).toContain('Poisoner');
	expect(first).not.toContain('Washerwoman');
	// Dead, the Poisoner keeps its ability and still wakes.
	await nextNight(page);
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 2' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await closeSheet(page);
	await walkTo(page, 'Poisoner');
});

test('with Trained Killer, the Demon’s step names the next character in script order', async ({
	page
}) => {
	// https://beardytas.com/garden-of-djinn/trained-killer/ (Trevor, 2026-10-22).
	await startWithRule(page, 'Trained Killer', [
		[1, 'Imp'],
		[2, 'Chef'],
		[3, 'Washerwoman']
	]);
	await walkTo(page, 'Dusk');
	await nextNight(page);
	// The Chef is above the Washerwoman on Trouble Brewing's script (TPI's order).
	const strip = await walkTo(page, 'Imp');
	await expect(strip.getByTestId('step-attack')).toHaveText('Attacks Seat 2 (Trained Killer)');
});

test('with Council of the Dead, night 4 starts with the dead waking together', async ({ page }) => {
	// https://beardytas.com/garden-of-djinn/council-of-the-dead/ (Trevor, 2026-10-22).
	await startWithRule(page, 'Council of the Dead', [[1, 'Imp']]);
	await walkTo(page, 'Dusk');
	expect(await stepNames(page)).not.toContain('Council of the Dead');
	for (let night = 2; night <= 4; night++) await nextNight(page);
	await page.getByTestId('night-strip').getByRole('button', { name: 'Next step' }).tap();
	await expect(page.getByTestId('night-strip').locator('.step .name strong')).toHaveText(
		'Council of the Dead'
	);
});

test('with Track nominations on, a seat sheet records who nominated whom under the ghost vote', async ({
	page
}) => {
	// Trevor (2026-10-22): "Make nomination tracking a setting. if enabled, just add beneath dead
	// vote the same area there to track it."
	await startGame(page);
	await expect((await openSeat(page, 1)).getByTestId('sheet-nominated')).toHaveCount(0);
	await closeSheet(page);
	await trackNominations(page);

	let sheet = await openSeat(page, 1);
	const nominated = sheet.getByTestId('sheet-nominated');
	await expect(nominated).toHaveText('None');
	await expect(sheet.getByTestId('sheet-nominated-by')).toHaveText('None');
	await nominated.tap();
	await page.getByRole('dialog', { name: 'Who did Seat 1 nominate?' }).getByText('Seat 3').tap();
	await expect(nominated).toHaveText('Seat 3');
	await closeSheet(page);
	// Trevor (2026-10-23): every living seat has the marks, greyed until they happen, side by
	// side in one pill that never changes size.
	const seats = page.getByTestId('seat');
	const marks = page.getByTestId('nomination-marks');
	await expect(marks).toHaveCount(8);
	const on = (seat: number, mark: string) =>
		seats
			.nth(seat - 1)
			.getByTestId(mark)
			.and(page.locator('[data-on]'));
	await expect(on(1, 'nominator-mark')).toHaveCount(1);
	await expect(on(1, 'nominated-mark')).toHaveCount(0);
	await expect(on(3, 'nominated-mark')).toHaveCount(1);
	await expect(on(2, 'nominator-mark')).toHaveCount(0);
	const finger = await seats.nth(0).getByTestId('nominator-mark').boundingBox();
	const gavel = await seats.nth(0).getByTestId('nominated-mark').boundingBox();
	// Side by side, not stacked.
	expect(Math.abs((finger?.y ?? 0) - (gavel?.y ?? 1))).toBeLessThan(1);
	expect(gavel!.x).toBeGreaterThan(finger!.x);
	const one = await seats.nth(0).getByTestId('nomination-marks').boundingBox();
	const two = await seats.nth(1).getByTestId('nomination-marks').boundingBox();
	expect(Math.abs((one?.width ?? 0) - (two?.width ?? 1))).toBeLessThan(1);
	// The nominee's sheet shows it from the other side.
	sheet = await openSeat(page, 3);
	await expect(sheet.getByTestId('sheet-nominated-by')).toHaveText('Seat 1');
	// None clears it.
	await sheet.getByTestId('sheet-nominated-by').tap();
	await page
		.getByRole('dialog', { name: 'Who nominated Seat 3?' })
		.getByRole('button', { name: 'None', exact: true })
		.tap();
	await expect(sheet.getByTestId('sheet-nominated-by')).toHaveText('None');
	await closeSheet(page);
	// The nomination is gone from both sides, so no mark is lit.
	await expect(marks).toHaveCount(8);
	await expect(page.locator('[data-testid="nomination-marks"] [data-on]')).toHaveCount(0);
});

// Trevor (2026-10-23): tapping a seat's nomination marks asks who that player nominated, and
// tracking feeds nomination abilities: a Townsfolk who nominates the Virgin is executed
// straight away (https://wiki.bloodontheclocktower.com/Virgin). The dead keep only the gavel,
// unless they nominated today before dying.
test('tapping the nomination marks records a nomination, and the Virgin executes a Townsfolk', async ({
	page
}) => {
	await startGame(page);
	for (const [number, name] of [
		[1, 'Virgin'],
		[2, 'Chef'],
		[4, 'Empath']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	await trackNominations(page);
	const seats = page.getByTestId('seat');
	await seats.nth(1).getByTestId('nomination-marks').tap();
	await page
		.getByRole('dialog', { name: 'Who did Seat 2 nominate?' })
		.getByText('Seat 1', { exact: true })
		.tap();
	const ask = page.getByRole('alertdialog', { name: /^Virgin: execute Seat 2\s?\?$/ });
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	await expect(seatLabelled(page, 'Seat 2: no name, Chef, dead')).toBeAttached();
	// The Virgin's ability is used: her "No Ability" reminder is placed.
	await expect(seatLabelled(page, 'Seat 1: no name, Virgin, 1 reminder')).toBeAttached();
	// Dead, but nominated today: the marks stay, the finger lit.
	await expect(
		seats.nth(1).getByTestId('nominator-mark').and(page.locator('[data-on]'))
	).toHaveCount(1);
	// A player who died without nominating may still be nominated, but not nominate
	// (Trevor, 2026-10-24): only the gavel.
	const empath = await openSeat(page, 4);
	await empath.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 4' })
		.getByRole('button', { name: 'The Demon' })
		.tap();
	await closeSheet(page);
	await expect(seats.nth(3).getByTestId('nominated-mark')).toHaveCount(1);
	await expect(seats.nth(3).getByTestId('nominator-mark')).toHaveCount(0);
	await expect(page.getByTestId('nomination-marks')).toHaveCount(8);
});

// Trevor (2026-10-23): "town crier is giving valid info no when we haven't implemented
// nomination tracking". The Town Crier's answer comes from the nominations recorded today
// (https://wiki.bloodontheclocktower.com/Town_Crier), and is unknown until one is.
test("the Town Crier's step reads today's recorded nominations", async ({ page }) => {
	await startGame(page, 'Sects & Violets');
	for (const [number, name] of [
		[1, 'Town Crier'],
		[2, 'Witch'],
		[3, 'Fang Gu']
	] as const) {
		const sheet = await openSeat(page, number);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await closeSheet(page);
	}
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await endNight(page);
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();

	const step = await openStep(page, 'Town Crier');
	let suggested = step.getByTestId('night-suggested');
	await expect(suggested).toContainText('No nominations recorded today');
	await step.getByRole('button', { name: 'Close' }).first().tap();
	await expect(step).toBeHidden();

	// The Witch (a Minion) nominates the Fang Gu.
	await trackNominations(page);
	const sheet = await openSeat(page, 2);
	await sheet.getByTestId('sheet-nominated').tap();
	await page.getByRole('dialog', { name: 'Who did Seat 2 nominate?' }).getByText('Seat 3').tap();
	await closeSheet(page);
	suggested = (await openStep(page, 'Town Crier')).getByTestId('night-suggested');
	await expect(suggested).not.toContainText('No nominations recorded today');
	await expect(suggested).toContainText('Yes');
	await expect(suggested.locator('.because')).toContainText('Seat 2');
});

/** Turns on Settings > Storyteller > Track nominations. */
async function trackNominations(page: Page) {
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller' })
		.tap();
	await settings.getByText('Track nominations', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
}

/** Records on `nominator`'s seat sheet that they nominated `nominee`. */
async function nominate(page: Page, nominator: number, nominee: number) {
	const sheet = await openSeat(page, nominator);
	await sheet.getByTestId('sheet-nominated').tap();
	await page
		.getByRole('dialog', { name: `Who did Seat ${nominator} nominate?` })
		.getByText(`Seat ${nominee}`, { exact: true })
		.tap();
}

// https://beardytas.com/garden-of-djinn/the-warrens/: while 5 or more live, an evil player who
// nominates a living evil player swaps characters with them (Trevor, 2026-10-23).
test('with The Warrens, an evil nomination of an evil player offers to swap their characters', async ({
	page
}) => {
	await startWithRule(page, 'The Warrens', [
		[1, 'Imp'],
		[2, 'Poisoner'],
		[3, 'Chef']
	]);
	await trackNominations(page);
	// A good nominee: nothing to swap.
	await nominate(page, 2, 3);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await closeSheet(page);
	await nominate(page, 2, 1);
	const ask = page.getByRole('alertdialog', { name: 'The Warrens: swap characters?' });
	// The rule asking sits at the top (Trevor, 2026-10-23).
	await expect(ask.getByTestId('rule-header')).toContainText('The Warrens');
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, Poisoner')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 2: no name, Imp')).toBeAttached();
});

// https://beardytas.com/garden-of-djinn/the-djinns-bargain/: a nominator may choose to die.
test("with The Djinn's Bargain, a nomination asks whether the nominator chose to die", async ({
	page
}) => {
	await startWithRule(page, 'The Djinn’s Bargain', [[1, 'Chef']]);
	await trackNominations(page);
	await nominate(page, 1, 2);
	const ask = page.getByRole('alertdialog', {
		name: /^The Djinn’s Bargain: did Seat 1\s?choose to die\?$/
	});
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, Chef, dead')).toBeAttached();
});

// Trevor (2026-10-22, plan D2): a crowded seat's reminders keep a thin line back to it.
// Trevor (2026-10-23): every reminder is always on the board, so there is no "+N" stack.
test('reminders keep a line back to their seat, and all of them stay on the board', async ({
	page
}) => {
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	for (let n = 0; n < 4; n++) {
		await bank.getByRole('button', { name: 'Generic reminder' }).tap();
		await page
			.getByRole('dialog', { name: 'Put ∞ on' })
			.getByRole('button', { name: /None Seat 1/ })
			.tap();
	}
	await expect(seatLabelled(page, 'Seat 1: no name, no character, 4 reminders')).toBeAttached();
	await expect(page.locator('.chip-slot[data-seat="1"]')).toHaveCount(4);
	// One line per reminder, from the seat's rim.
	await expect(page.locator('line[data-tether="1"]')).toHaveCount(4);
	await expect(page.locator('line[data-tether="2"]')).toHaveCount(0);
	// The lines draw under everything but the logo and background (Trevor, 2026-10-24): the
	// seats, with their names, ghost votes and marks, and the reminders paint over them.
	const under = await page.evaluate(() => {
		const lines = document.querySelector('svg.tethers')!;
		const zOf = (el: Element) => getComputedStyle(el).zIndex;
		return (
			[...lines.parentElement!.children]
				.filter((el) => el.matches('.slot, .chip-slot'))
				.every(
					(el) =>
						lines.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING &&
						(zOf(el) === 'auto' || Number(zOf(el)) >= 0)
				) && zOf(lines) === 'auto'
		);
	});
	expect(under).toBe(true);

	await menu(page, 'Board');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog.getByText('Stack crowded reminders')).toHaveCount(0);
});

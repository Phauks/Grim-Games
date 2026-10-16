import { expect, test, type Page } from '@playwright/test';

// The Storyteller's grimoire board: saved games, seats and the seat sheet (ROADMAP Phase 2).

async function startGame(page: Page, script = 'Trouble Brewing') {
	await page.goto('/');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText(script, { exact: true }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

/** A seat by the start of its label; the board is hidden from the a11y tree under a sheet. */
const seatLabelled = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

/** Runs an action from the toolbar's More menu. */
async function menu(page: Page, action: string) {
	await page.getByRole('button', { name: 'More' }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: action }).tap();
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

test('a new game is saved and listed on the home page', async ({ page }) => {
	await page.goto('/');
	// The setup table under the player count follows it.
	const current = page.getByTestId('setup-table').locator('thead th[data-current]');
	await expect(current).toHaveText('8');
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(current).toHaveText('9');
	await page.getByRole('button', { name: 'Fewer players' }).tap();
	await startGame(page);
	await page.goto('/');
	const saved = page.getByRole('link', { name: /Trouble Brewing.*8 seats/ }).first();
	await expect(saved).toBeVisible();
	await saved.tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
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

	await sheet.getByRole('button', { name: 'Dead' }).tap();
	const cause = page.getByRole('dialog', { name: 'How did Ana die?' });
	await cause.getByRole('button', { name: 'Executed' }).tap();
	await expect(sheet.getByRole('button', { name: 'Executed' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Vote used' }).tap();
	// A good Imp: as in the physical grimoire, the token turns upside down.
	await seatMenu(page, sheet, 'Change alignment');
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Good' }).tap();
	await expect(sheet).toContainText('Imp · Good · Seat 1');

	await page.reload();
	const seat = page.getByRole('button', { name: /^Seat 1:/ });
	await expect(seat).toHaveAccessibleName('Seat 1: Ana, Imp, dead, ghost vote used, good');
	sheet = await openSeat(page, 1);
	await expect(sheet.getByRole('button', { name: 'Executed' })).toBeVisible();
});

test('history, add seat, swap and remove', async ({ page }) => {
	await startGame(page);
	await menu(page, 'Add seat');
	await expect(page.getByTestId('seat')).toHaveCount(9);

	// History lists the change; going back to before it asks first.
	await page.getByRole('button', { name: 'History' }).tap();
	const history = page.getByRole('dialog', { name: 'History' });
	const added = history.getByRole('listitem').filter({ hasText: 'Added Seat 9' });
	await added.getByRole('button', { name: 'Go back' }).tap();
	const back = page.getByRole('alertdialog', { name: 'Go back?' });
	await expect(back).toContainText('Undoes 1 change');
	await back.getByRole('button', { name: 'Go back' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	// The undone change stays, greyed out, and can be restored.
	await added.getByRole('button', { name: 'Restore' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Restore changes?' })
		.getByRole('button', { name: 'Restore' })
		.tap();
	await expect(page.getByTestId('seat')).toHaveCount(9);
	await history.getByRole('button', { name: 'Close' }).tap();

	let sheet = await openSeat(page, 2);
	await nameSeat(sheet, 'Ben');
	await seatMenu(page, sheet, 'Swap seats');
	await page
		.getByRole('dialog', { name: 'Swap Ben with' })
		.getByRole('button', { name: /^5/ })
		.tap();
	// Swapping is confirmed on its own.
	const confirm = page.getByRole('alertdialog', { name: 'Swap seats?' });
	await expect(confirm).toContainText('Swap Ben and Seat 5?');
	await confirm.getByRole('button', { name: 'Swap' }).tap();
	await expect(seatLabelled(page, 'Seat 5: Ben')).toBeAttached();

	await closeSheet(page);
	sheet = await openSeat(page, 5);
	await seatMenu(page, sheet, 'Remove seat');
	await page
		.getByRole('alertdialog', { name: 'Remove Ben?' })
		.getByRole('button', { name: 'Remove' })
		.tap();
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
	await menu(page, 'Add Traveller');
	await page
		.getByRole('dialog', { name: 'Add a Traveller' })
		.getByRole('button', { name: 'Thief', exact: true })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toBeAttached();

	await menu(page, 'Add Fabled or Loric');
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Spirit of Ivory', exact: true })
		.tap();
	const fabled = page
		.getByRole('list', { name: 'Fabled and Loric' })
		.getByRole('button', { name: 'Spirit of Ivory' });
	await expect(fabled).toBeVisible();
	await fabled.tap();
	await page
		.getByRole('dialog', { name: 'Spirit of Ivory' })
		.getByRole('button', { name: 'Remove from the game' })
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
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Seat 1' }).getByRole('button', { name: 'Show to player' })
	).toBeDisabled();
	await page.keyboard.press('Escape');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await seatMenu(page, sheet, 'Show to player');
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown).toBeVisible();
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toBeHidden();
});

test('the toolbar leads to character selection and the bag draw', async ({ page }) => {
	await startGame(page);
	const board = page.url();
	await page.getByRole('button', { name: 'Characters' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	await page.goto(board);
	await page.getByRole('button', { name: 'Bag draw' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
});

test('a new game can use a custom script from the Scripts page', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Paste', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Paste a script' });
	await dialog
		.getByLabel('Script JSON or link')
		.fill(JSON.stringify([{ id: '_meta', name: 'Pocket Storm' }, 'chef', 'saint', 'imp']));
	await dialog.getByRole('button', { name: 'Load' }).tap();
	await expect(page.getByTestId('current-script-name')).toHaveText('Pocket Storm');

	await startGame(page, 'Pocket Storm');
	await expect(page.getByRole('toolbar', { name: 'Grimoire' })).toContainText('Pocket Storm');
});

test('reminders: add several from the picker, recent first, then move and remove', async ({
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
	// Not in play: only the Drunk's global reminder, which marks who is secretly the Drunk.
	await expect(picker.getByRole('group', { name: 'Drunk' })).toContainText('Is The Drunk');
	await expect(picker.getByRole('group', { name: 'Washerwoman' })).toHaveCount(0);
	const poisoner = picker.getByRole('group', { name: 'Poisoner' });
	await poisoner.getByRole('button', { name: 'Poisoned' }).tap();
	await picker.getByRole('group', { name: 'Drunk' }).getByRole('button').first().tap();
	await expect(picker.getByText('On this seat: 2')).toBeVisible();
	// Recent reminders are read when the picker opens, so nothing moves under a finger.
	await picker.getByRole('button', { name: 'Close' }).tap();
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	await expect(
		picker.getByRole('group', { name: 'Recent reminders' }).getByRole('button')
	).toHaveCount(2);
	// Each token is placed once: the Poisoner has one "Poisoned".
	await expect(poisoner.getByRole('button', { name: /Poisoned/ })).toBeDisabled();
	// Only characters in play: no way to add the Washerwoman's reminders here.
	await expect(picker.getByRole('group', { name: 'Washerwoman' })).toHaveCount(0);
	await picker.getByRole('button', { name: 'Close' }).tap();

	await expect(seatLabelled(page, 'Seat 1: no name, Poisoner, 2 reminders')).toBeAttached();
	await sheet.getByRole('button', { name: 'Actions for Poisoned' }).tap();
	await page
		.getByRole('dialog', { name: 'Poisoned' })
		.getByRole('button', { name: 'Move to another seat' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Move reminder to' })
		.getByRole('button', { name: /^3/ })
		.tap();
	await expect(seatLabelled(page, 'Seat 3: no name, no character, 1 reminder')).toBeAttached();
	await sheet.getByRole('button', { name: 'Actions for Is The Drunk' }).tap();
	await page
		.getByRole('dialog', { name: 'Is The Drunk' })
		.getByRole('button', { name: 'Remove' })
		.tap();
	await expect(sheet.getByText('None', { exact: true }).last()).toBeVisible();
});

test('seats can be arranged: dragged into groups, gaps left, oval or circle', async ({ page }) => {
	await startGame(page);
	const seat = (n: number) => page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) });
	const centre = async (n: number) => {
		const box = (await seat(n).boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	const board = (await page.locator('.board').boundingBox())!;
	const seat2 = await centre(2);
	const seat3 = await centre(3);

	await menu(page, 'Arrange seats');
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await expect(toolbar).toContainText('Arrange seats');
	await expect(page.getByRole('dialog', { name: 'Grimoire' })).toBeHidden();

	// Drag seat 1 to the middle of the board; the others stay where they were.
	const from = await centre(1);
	const to = { x: board.x + board.width / 2, y: board.y + board.height / 2 };
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 4 });
	await page.mouse.up();
	const moved = await centre(1);
	expect(Math.abs(moved.x - to.x)).toBeLessThan(4);
	expect(Math.abs(moved.y - to.y)).toBeLessThan(4);
	expect(await centre(2)).toEqual(seat2);

	// A gap after seat 2 moves the seats after it round the ring.
	await page.getByRole('button', { name: 'Gap after seat 2: None' }).tap();
	await expect(page.getByRole('button', { name: 'Gap after seat 2: 1' })).toBeVisible();
	expect(await centre(3)).not.toEqual(seat3);

	await toolbar.getByText('Circle', { exact: true }).tap();
	await expect(toolbar.getByRole('checkbox', { name: 'Circle' })).toBeChecked();
	await toolbar.getByRole('button', { name: 'Done' }).tap();
	await expect(page.getByRole('button', { name: 'Gap after seat 2: 1' })).toHaveCount(0);

	// The layout is kept on this device, and seats open their sheet again.
	await page.reload();
	await expect(page.getByTestId('seat')).toHaveCount(8);
	const after = await centre(1);
	expect(Math.abs(after.x - to.x)).toBeLessThan(4);
	await openSeat(page, 1);
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
	await page.getByRole('button', { name: 'History' }).tap();
	await expect(page.getByRole('dialog', { name: 'History' })).toContainText(
		'Drunk moved to Seat 3'
	);
	await page.keyboard.press('Escape');

	// A tap opens the seat it is on.
	await token.tap();
	await expect(page.getByRole('heading', { name: 'No name' })).toBeVisible();
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toContainText('Seat 3');
});

test('the night order opens from the board and steps are ticked by hand', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await nameSeat(sheet, 'Sam');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Sam' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await closeSheet(page);

	await page.getByRole('button', { name: 'Night order' }).tap();
	const night = page.getByRole('dialog', { name: 'Night order' });
	await expect(night).toContainText('Dusk');
	const empath = night.getByRole('listitem').filter({ hasText: 'Empath' });
	await expect(empath).toContainText('Sam');
	const tick = empath.getByRole('button', { name: 'Done: Empath' });
	await tick.tap();
	await expect(tick).toHaveAttribute('aria-pressed', 'true');
	await night.getByText('Other nights').tap();
	await expect(night.getByRole('listitem').filter({ hasText: 'Empath' })).toBeVisible();
	await night.getByRole('button', { name: 'Clear ticks' }).tap();
	await night.getByText('First night').tap();
	await expect(tick).toHaveAttribute('aria-pressed', 'false');
});

test('the script is shared from the grimoire menu, never the game', async ({ page }) => {
	await startGame(page);
	await menu(page, 'Share script');
	const share = page.getByRole('dialog', { name: 'Share script' });
	await expect(share).toContainText('never anything from this game');
	await share.getByRole('button', { name: 'QR code' }).tap();
	// An official edition shares by its id; nothing about seats or names is in the link.
	await expect(page.getByRole('dialog').last()).toBeVisible();
	const link = await page.evaluate(() =>
		[...document.querySelectorAll('a[href*="#"], [data-testid="share-url"]')]
			.map((e) => e.getAttribute('href') ?? e.textContent)
			.join(' ')
	);
	expect(link).not.toContain('seat');
});

test("a Traveller's alignment can wait for the night order", async ({ page }) => {
	await startGame(page);
	await menu(page, 'Add Traveller');
	await page
		.getByRole('dialog', { name: 'Add a Traveller' })
		.getByRole('button', { name: 'Thief', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toHaveAccessibleName(
		/alignment not set/
	);

	// The night order starts by asking for it (core withTravellerAlignmentStep).
	await page.getByRole('button', { name: 'Night order' }).tap();
	const night = page.getByRole('dialog', { name: 'Night order' });
	const step = night.getByRole('listitem').filter({ hasText: 'Traveller alignment' });
	await expect(step).toContainText('Thief');
	await step.getByRole('button', { name: 'Evil' }).tap();
	await expect(step).toBeHidden();
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
	await sheet.getByRole('button', { name: 'Dead' }).tap();
	let cause = page.getByRole('dialog', { name: 'How did Seat 2 die?' });
	await expect(cause.getByRole('button', { name: 'Executed' })).toBeVisible();
	await expect(cause.getByRole('button', { name: 'Slayer' })).toBeHidden();
	await cause.getByRole('button', { name: 'Skip' }).tap();
	await closeSheet(page);

	sheet = await openSeat(page, 3);
	await sheet.getByRole('button', { name: 'Dead' }).tap();
	cause = page.getByRole('dialog', { name: 'How did Seat 3 die?' });
	await cause.getByRole('button', { name: 'Slayer' }).tap();
	await expect(sheet.getByRole('button', { name: 'Slayer' })).toBeVisible();
});

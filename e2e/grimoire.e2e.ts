import { expect, test, type Page } from '@playwright/test';

// The Storyteller's grimoire board: saved games, seats and the seat sheet (ROADMAP Phase 2).

async function startGame(page: Page, script = 'Trouble Brewing') {
	await page.goto('/new');
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
	await page.getByRole('button', { name: 'More', exact: true }).tap();
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

test('New game and Resume game are screens of their own', async ({ page }) => {
	// Home is blank for now (Trevor, 2026-10-16); the sidebar leads to each screen.
	await page.goto('/new');
	// The setup table under the player count follows it.
	const current = page.getByTestId('setup-table').locator('thead th[data-current]');
	await expect(current).toHaveText('8');
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(current).toHaveText('9');
	await page.getByRole('button', { name: 'Fewer players' }).tap();
	// No Back button (Trevor, 2026-10-16): the app name in the header, or Home in the menu, goes home.
	await expect(page.getByRole('link', { name: 'Back' })).toHaveCount(0);
	await page.getByRole('banner').getByRole('link', { name: 'Grim-Games' }).tap();
	await expect(page).toHaveURL(/\/$/);
	await startGame(page);

	// Resume game lists every saved game with where it is up to.
	await page.goto('/games');
	const saved = page.getByRole('link', { name: /Trouble Brewing.*Setting up · 8 seats/ });
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

	// Status is one list: Alive, then the causes of death.
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	const cause = page.getByRole('dialog', { name: 'Status of Ana' });
	await expect(cause.getByRole('button', { name: 'Alive' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await cause.getByRole('button', { name: 'Executed' }).tap();
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
	// Alive brings them back, after saying what changes.
	await sheet.getByRole('button', { name: 'Status: Dead: Executed' }).tap();
	await cause.getByRole('button', { name: 'Alive' }).tap();
	const revive = page.getByRole('alertdialog', { name: 'Bring Ana back to life?' });
	await expect(revive).toContainText(/Now\s*Dead: Executed\s*Becomes\s*Alive/);
	await revive.getByRole('button', { name: 'Cancel' }).tap();
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
	// No ghost vote on the Storyteller's board (Trevor, 2026-10-16): players track it.
	await expect(sheet.getByRole('button', { name: 'Vote used' })).toHaveCount(0);
	// A good Imp: as in the physical grimoire, the token turns upside down.
	await seatMenu(page, sheet, 'Change alignment');
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Good' }).tap();
	await expect(sheet).toContainText(/Imp\s*Good · Seat 1/);

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
	await details.getByRole('button', { name: 'Close' }).tap();
	await expect(sheet).toContainText(/Imp\s*Evil · Seat 1/);

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
	await expect(sheet).toContainText(/Baron\s*Evil · Seat 1/);
	// The seat keeps its changes, in a window of their own.
	await sheet.getByRole('button', { name: 'Changes: 1, show them' }).tap();
	const changes = page.getByRole('dialog', { name: 'Changes for Seat 1' });
	await expect(changes.getByTestId('seat-changes')).toContainText(/Imp\s*→\s*Baron/);
	await changes.getByRole('button', { name: 'Close' }).tap();

	// Alignment says what it is and what it becomes.
	await seatMenu(page, sheet, 'Change alignment');
	const alignment = page.getByRole('dialog', { name: 'Alignment' });
	await expect(alignment).toContainText('Now');
	await expect(alignment).toContainText('Evil');
	await expect(alignment).toContainText('Becomes');
	await alignment.getByRole('button', { name: 'Good', exact: true }).tap();
	await expect(sheet).toContainText(/Baron\s*Good · Seat 1/);
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
	await seatMenu(page, sheet, 'Remove seat');
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
	await menu(page, 'Background');
	const looks = page.getByRole('dialog', { name: 'Background' });
	await looks.getByText('Edge, smaller', { exact: true }).tap();
	await looks.getByRole('button', { name: 'Close' }).tap();
	await expect(
		page.locator('.rules-edge').getByRole('button', { name: 'Spirit of Ivory' })
	).toBeVisible();
	await fabled.tap();
	await page
		.getByRole('dialog', { name: 'Spirit of Ivory' })
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
	await page.getByRole('button', { name: 'Set up' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	// The last setup step opens the board with the setup reminders in the bank.
	await page.goto(`${board}#setup-reminders`);
	await expect(page).toHaveURL(board);
	await expect(page.locator('[data-tray] .view')).toHaveText('Setup');
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Day' })).toBeVisible();
	await expect(page).toHaveURL(board);
});

test('a new game can use a custom script from the Library', async ({ page }) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	await page
		.getByRole('dialog', { name: 'Add script' })
		.getByRole('button', { name: 'Paste JSON', exact: true })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Paste a script' });
	await dialog
		.getByLabel('Script JSON or link')
		.fill(JSON.stringify([{ id: '_meta', name: 'Pocket Storm' }, 'chef', 'saint', 'imp']));
	await dialog.getByRole('button', { name: 'Save' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Pocket Storm');

	await startGame(page, 'Pocket Storm');
	await expect(page.locator('.watermark')).toHaveText('Pocket Storm');
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
	// Not in play, but never in the bag: only the Drunk's global reminder, which marks who is
	// secretly the Drunk.
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
	await expect(picker.getByText('On this seat: 1')).toBeVisible();
	await expect(drunk).toHaveAttribute('aria-pressed', 'false');
	await drunk.tap();
	await expect(picker.getByText('On this seat: 2')).toBeVisible();
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
		.getByRole('dialog', { name: 'Move reminder to' })
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
	await expect(seatLabelled(page, 'Seat 1: no name')).toBeAttached();
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
		await expect(page.getByRole('status').filter({ hasText: 'Drunk, from Sailor' })).toContainText(
			'on Seat 1'
		);
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
	// Filtered by a character (Trevor, 2026-10-16): only entries naming the Sailor.
	const history = page.getByRole('dialog', { name: 'History' });
	const filter = history.getByRole('group', { name: 'Show changes for' });
	await filter.getByRole('button', { name: 'Sailor' }).tap();
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

	// A tap opens the seat it is on.
	await token.tap();
	await expect(page.getByRole('heading', { name: 'No name' })).toBeVisible();
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toContainText('Seat 3');
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
	const tokens = page.getByTestId('board-reminder');
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
	// Each night has its own ticks; there is no Clear ticks button.
	await expect(night.getByRole('button', { name: 'Clear ticks' })).toHaveCount(0);
	await night.getByText('Other nights').tap();
	await expect(night.getByRole('button', { name: 'Done: Empath' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await night.getByText('First night').tap();
	await expect(tick).toHaveAttribute('aria-pressed', 'true');

	// Ticking Dawn ends the night and starts Day 1 (Trevor, 2026-10-16); the night's ticks
	// stay on screen, and ticking Dawn again doesn't start another day.
	const dawn = night.getByRole('button', { name: 'Done: Dawn' });
	const boardTimer = page.locator('.board-timer').getByTestId('day-timer');
	await expect(boardTimer).toHaveCount(0);
	await dawn.tap();
	await expect(dawn).toHaveAttribute('aria-pressed', 'true');
	await expect(tick).toHaveAttribute('aria-pressed', 'true');
	await dawn.tap();
	await dawn.tap();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await page.keyboard.press('Escape');
	// From the first day the day timer is on the board too (Trevor, 2026-10-17).
	await expect(boardTimer).toBeVisible();
	await expect(boardTimer.getByRole('button', { name: 'Start timer' })).toBeVisible();
	// The next night order opens on the other nights, unticked.
	await page.getByRole('button', { name: 'Night order' }).tap();
	await expect(night.getByRole('radio', { name: 'Other nights' })).toBeChecked();
	await expect(night.getByRole('button', { name: 'Done: Dawn' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});

test('the script is shared from the grimoire menu, never the game', async ({ page }) => {
	await startGame(page);
	// Share sits in the toolbar, never hidden in the menu.
	await page.getByRole('button', { name: 'Share script' }).tap();
	const share = page.getByRole('dialog', { name: 'Share script' });
	await expect(share).not.toContainText('never anything from this game');
	// The QR code and link show straight away; an official edition shares by its id,
	// so nothing about seats or names is in the link.
	await expect(share.getByRole('img', { name: /^QR code for / })).toBeVisible();
	const link = share.getByTestId('share-url');
	await expect(link).toHaveValue(/\/play#e=tb$/);
	expect(await link.inputValue()).not.toContain('seat');
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

	// The night order starts by asking for it (core withTravellerAlignmentStep).
	await page.getByRole('button', { name: 'Night order' }).tap();
	const night = page.getByRole('dialog', { name: 'Night order' });
	const step = night.getByRole('listitem').filter({ hasText: 'Traveller alignment' });
	await expect(step).toContainText('Thief');
	// Dusk always comes first and Dawn last; the Traveller step falls between (Trevor).
	const names = await night.locator('li .name strong').allTextContents();
	expect(names[0]).toBe('Dusk');
	expect(names[1]).toBe('Traveller alignment');
	expect(names.indexOf('Dawn')).toBeGreaterThan(1);
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
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Slayer' })).toBeVisible();
	await closeSheet(page);

	// Dead (Trevor, 2026-10-16): the token dimmed with a skull badge, and the ghost vote shown.
	const imp = seatLabelled(page, 'Seat 3:');
	await expect(imp.getByTestId('dead-mark')).toBeVisible();
	await expect(imp.getByTestId('ghost-vote')).toBeVisible();
	await expect(seatLabelled(page, 'Seat 2:').getByTestId('dead-mark')).toHaveCount(0);
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
	const tray = page.getByRole('list', { name: 'Setup reminders' });
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

	// Every reminder still off the board, on demand (and by itself once setup is done).
	await page.getByRole('button', { name: 'Showing setup reminders; show all reminders' }).tap();
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await expect(bank.getByRole('button', { name: 'Wrong reminder' })).toHaveCount(1);
	await expect(bank.getByRole('button', { name: 'Townsfolk reminder' })).toHaveCount(0);
	// The setup reminder still to place comes first, left of a dashed line.
	await expect(bank.locator('li.divider')).toHaveCount(1);
	await expect(bank.locator('li:has(+ li.divider)')).toContainText('Wrong');
	await page.getByRole('button', { name: 'Showing all reminders; show setup reminders' }).tap();

	// From the seat sheet too: Return to reminder bank.
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: 'Actions for Townsfolk' }).tap();
	const actions = page.getByRole('dialog', { name: 'Townsfolk' });
	await expect(actions).toContainText('From the Washerwoman (Seat 1)');
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
	await expect(sheet).toContainText(/Poisoner\s*Evil · Seat 1/);
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
	await page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button', { name: 'Done' }).tap();

	await menu(page, 'History');
	const history = page.getByRole('dialog', { name: 'History' });
	await expect(history).toContainText('Ana moved to seat 4');
	await expect(history).toContainText('Rotated the seats clockwise');
	await page.keyboard.press('Escape');
	await openSeat(page, 4);
	await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible();
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
	const drawer = page.getByRole('dialog', { name: 'Menu' });
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
	await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller settings' })
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
	// The official script's name and author sit behind the circle.
	await expect(page.locator('.watermark')).toContainText('Trouble Brewing');
	await expect(page.locator('.watermark')).toContainText('by The Pandemonium Institute');

	await menu(page, 'Background');
	const dialog = page.getByRole('dialog', { name: 'Background' });
	await expect(dialog).toContainText('None (plain board)');
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
	await expect(dialog).toContainText('Your image, for this game');
	await dialog.getByRole('button', { name: 'Close' }).tap();
	const backdrop = page.getByTestId('board-background');
	await expect(backdrop).toHaveAttribute('style', /blob:/);
	await expect(page.locator('.watermark')).toHaveClass(/on-image/);

	await page.reload();
	await expect(page.getByTestId('board-background')).toHaveAttribute('style', /blob:/);
	await menu(page, 'Background');
	await expect(dialog).toContainText('Your image, for this game');
	await expect(dialog).not.toContainText('never uploaded');
	await dialog.getByRole('button', { name: 'None', exact: true }).tap();
	await expect(page.getByTestId('board-background')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();

	// Built-in backgrounds, drawn in CSS (Trevor, 2026-10-16), kept after a reload.
	await menu(page, 'Background');
	await dialog
		.getByRole('group', { name: 'Built-in backgrounds' })
		.getByRole('button', { name: 'Green felt' })
		.tap();
	await expect(page.getByTestId('board-background')).toHaveAttribute('data-preset', 'felt');
	// The board's looks are here too, the same values as in Settings (Trevor, 2026-10-17).
	await expect(page.locator('.watermark')).toHaveClass(/vignette/);
	await dialog.getByText('Vignette', { exact: true }).tap();
	await expect(page.locator('.watermark')).not.toHaveClass(/vignette/);
	await dialog.getByText('Script name on the board', { exact: true }).tap();
	await expect(page.locator('.watermark')).toHaveCount(0);
	await dialog.getByText('Script name on the board', { exact: true }).tap();
	// The player name badge size is an option (Trevor, 2026-10-17), live on the board.
	const nameSize = dialog.getByRole('slider', { name: 'Player name size' });
	await nameSize.fill('1.4');
	await expect(nameSize).toHaveAttribute('aria-valuetext', '140%');
	const nameWidth = () =>
		page
			.getByTestId('seat')
			.first()
			.evaluate((el) => el.querySelector('.name')?.getBoundingClientRect().width ?? 0);
	const bigger = await nameWidth();
	await nameSize.fill('0.6');
	await expect.poll(nameWidth).toBeLessThan(bigger);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await page.reload();
	await expect(page.getByTestId('board-background')).toHaveAttribute('data-preset', 'felt');
	await expect(page.locator('.watermark')).not.toHaveClass(/vignette/);
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

	// Tap a step: TPI's text, its reminder placed on a chosen seat, then Done ticks it.
	await page.getByRole('button', { name: 'Night order' }).tap();
	await page.getByRole('button', { name: 'Guide: Poisoner' }).tap();
	const guide = page.getByRole('dialog', { name: 'Poisoner' });
	await expect(guide).toContainText('Seat 1');
	await expect(guide).toContainText('Not placed');
	await guide.getByRole('button', { name: 'Place' }).tap();
	await page
		.getByRole('dialog', { name: 'Put Poisoned on' })
		.getByRole('button', { name: /Seat 2 Empath/ })
		.tap();
	await expect(guide).toContainText('On Seat 2');

	// Show to player and Info tokens come back to the step (Trevor, 2026-10-16).
	await guide.getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(guide).toBeVisible();
	await guide.getByRole('button', { name: 'Info tokens' }).tap();
	await page.getByRole('button', { name: 'This is the Demon', exact: true }).tap();
	await shown.getByRole('button', { name: 'Close' }).tap();
	const info = page.getByRole('dialog', { name: 'Info tokens' });
	await expect(info).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(info).toBeHidden();
	await expect(guide).toBeVisible();

	await guide.getByRole('button', { name: 'Done' }).tap();
	await expect(seatLabelled(page, 'Seat 2: no name, Empath, 1 reminder')).toBeAttached();
	await page.getByRole('button', { name: 'Night order' }).tap();
	const order = page.getByRole('dialog', { name: 'Night order' });
	await expect(order.getByRole('button', { name: 'Done: Poisoner' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Walk through: one step at a time under the board, with Previous and Next.
	await order.getByRole('button', { name: 'Walk through' }).tap();
	const strip = page.getByTestId('night-strip');
	await expect(strip).toContainText(/^.*1 of \d+/);
	await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(strip).toContainText(/2 of \d+/);
	// A reload (or an app update) keeps the walk-through where it was (Trevor, 2026-10-16).
	await page.reload();
	await expect(strip).toContainText(/2 of \d+/);
	await strip.getByRole('button', { name: 'Previous step' }).tap();
	await expect(strip).toContainText(/1 of \d+/);
	await strip.getByRole('button', { name: 'Stop the walk-through' }).tap();
	await expect(strip).toHaveCount(0);

	// A step shows the game state that matters: the Empath is poisoned (core nightStepAlerts).
	await page.getByRole('button', { name: 'Night order' }).tap();
	await page.getByRole('button', { name: 'Guide: Empath' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Empath' }).getByTestId('night-alerts')
	).toContainText(/Empath.*Seat 2.*poisoned.*Poisoner/);
});

test('moving a reminder that normally stays put asks first, saying why', async ({ page }) => {
	await startGame(page);
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
		.getByRole('dialog', { name: 'Move reminder to' })
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
		.getByRole('dialog', { name: 'Move reminder to' })
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

test("Players' phones opens over the board from the grimoire menu", async ({ page }) => {
	await startGame(page);
	const url = page.url();
	await menu(page, "Players' phones");
	// Over the board: the game stays open behind it.
	const dialog = page.getByRole('dialog', { name: "Players' phones" });
	await expect(dialog).toBeVisible();
	expect(page.url()).toBe(url);
	await dialog.getByRole('button', { name: 'Close', exact: true }).tap();
	await expect(dialog).toBeHidden();
	await expect(seatLabelled(page, 'Seat 1:')).toBeVisible();
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

	await page.getByRole('button', { name: 'Night order' }).tap();
	const step = page
		.getByRole('dialog', { name: 'Night order' })
		.getByRole('listitem')
		.filter({ hasText: 'Traveller alignment' });
	await step.getByRole('button', { name: 'Draw' }).tap();
	// The Storyteller sets 4 tokens, none evil: the player still picks one.
	const draw = page.getByRole('dialog', { name: 'Alignment draw' });
	await expect(draw.getByLabel('Tokens', { exact: true })).toHaveText('4');
	await draw.getByRole('button', { name: 'Fewer evil' }).tap();
	await expect(draw.getByLabel('Evil tokens')).toHaveText('0');
	await draw.getByRole('button', { name: 'Hand to player' }).tap();
	const pick = page.getByRole('dialog', { name: 'Choose a token' });
	// The counts are not shown to the player.
	await expect(pick).not.toContainText('Evil');
	await pick.getByRole('button', { name: 'Token 3' }).tap();
	const shown = page.getByRole('dialog', { name: 'Good' });
	await expect(shown.getByRole('button', { name: 'Token 3: Good' })).toBeVisible();
	await shown.getByRole('button', { name: 'Done' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toHaveAccessibleName(
		/good/
	);
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
	// Seat 2 is executed today (https://wiki.bloodontheclocktower.com/Undertaker).
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day' });
	await day.getByRole('button', { name: 'Seat: Seat 2' }).tap();
	await page
		.getByRole('dialog', { name: 'How did Seat 2 die?' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await day.getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Night order' }).tap();
	const order = page.getByRole('dialog', { name: 'Night order' });
	await order.getByText('Other nights').tap();
	await order.getByRole('button', { name: 'Guide: Undertaker' }).tap();
	const suggested = page.getByRole('dialog', { name: 'Undertaker' }).getByTestId('night-suggested');
	await expect(suggested.locator('[data-character-id="imp"]').first()).toBeVisible();
	await page.screenshot({ path: `test-results/undertaker-${test.info().project.name}.png` });
	// Whoever it names shows with their character (Trevor, 2026-10-17).
	await expect(suggested.locator('.because')).toContainText('Seat 2');
	await expect(suggested.locator('.because [data-character-id="imp"]').first()).toBeVisible();
	// The logic behind it: the executed player and their true character.
	await suggested.getByRole('button', { name: 'Why' }).tap();
	const why = page.getByRole('dialog', { name: 'Why' });
	await expect(why.getByTestId('why-facts')).toContainText('Seat 2');
	await expect(why.getByTestId('why-facts').locator('[data-character-id="imp"]')).toBeVisible();
	await why.getByRole('button', { name: 'Close' }).tap();
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
	await end.getByRole('radio', { name: 'Evil' }).tap();
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
	await menu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('radio', { name: 'Good' }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// End game stays on the board (Trevor, 2026-10-17); History is in the sidebar.
	await expect(page.getByTestId('game-over')).toBeVisible();
	await page.goto('/history');
	const summary = page.getByRole('region', { name: 'Summary' });
	await expect(summary).toContainText(/Games\s*1\s*Good won\s*1\s*Evil won\s*0/);
	const scripts = page.getByTestId('history-scripts');
	await expect(scripts).toContainText(/Trouble Brewing/);
	// Header filters narrow a table (Trevor, 2026-10-16: filters live in the header row).
	await scripts.getByRole('button', { name: /Filter Script/ }).tap();
	await page.getByRole('searchbox', { name: 'Filter Script' }).fill('violets');
	await page.keyboard.press('Enter');
	await expect(scripts).toContainText('None match.');
	// The old address still works.
	await page.goto('/previous-games');
	await expect(page).toHaveURL(/\/history$/);
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
	await expect(sheet.locator('[data-character="empath"]')).toContainText(
		'Each night, you learn how many of your 2 alive neighbors'
	);
	await expect(sheet.getByTestId('no-jinxes')).toHaveText('None');
	// It scrolls to the end (Trevor, 2026-10-16: it couldn't be scrolled).
	const scroller = sheet.getByTestId('script-scroll');
	const box = (await scroller.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	const last = sheet.locator('[data-character]').last();
	for (let i = 0; i < 30 && !(await last.evaluate(inView)); i++) await page.mouse.wheel(0, 600);
	await expect(last).toBeInViewport();
	expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	// Arrange seats moved into More to make room.
	await page.getByRole('button', { name: 'More' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: 'Arrange seats' })
	).toBeVisible();
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

test('the Storyteller keeps a note on a player, marked on the token', async ({ page }) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	const notes = sheet.getByRole('button', { name: /^Notes:/ });
	await expect(notes).toHaveAccessibleName('Notes: None');
	await notes.tap();
	const dialog = page.getByRole('dialog', { name: 'Notes for Seat 1' });
	const field = dialog.getByRole('textbox', { name: 'Notes' });
	// Nothing grabs focus (and the keyboard) when it opens; Enter starts a new line.
	await expect(field).not.toBeFocused();
	await field.tap();
	await page.keyboard.type('Secret word: lantern');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Amnesiac: learns a Minion');
	await expect(dialog).toBeVisible();
	// No Save or Cancel (Trevor, 2026-10-17): closing it any way keeps the note.
	await expect(dialog.getByRole('button', { name: 'Save' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await expect(notes).toContainText('Secret word: lantern');
	// Dismissed without a button (as a swipe down does), it keeps the edit too.
	await notes.tap();
	await field.tap();
	await page.keyboard.press('End');
	await page.keyboard.type(' (kept)');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(notes).toContainText('(kept)');
	await closeSheet(page);

	await expect(seatLabelled(page, 'Seat 1: no name, no character, has a note')).toBeAttached();
	await expect(page.getByTestId('note-mark')).toHaveCount(1);
	// Saved with the game, and listed in History.
	await page.reload();
	await expect(page.getByTestId('note-mark')).toHaveCount(1);
	await menu(page, 'History');
	await expect(page.getByRole('dialog', { name: 'History' })).toContainText('Note on Seat 1');
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
	await expect(picker.getByText('On this seat: 1')).toBeVisible();
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

	await page.getByRole('button', { name: 'Night order' }).tap();
	await page.getByRole('button', { name: 'Guide: Mathematician' }).tap();
	const guide = page.getByRole('dialog', { name: 'Mathematician' });
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
			.getByRole('button', { name: new RegExp(`^${seat} Seat ${seat} `) })
			.tap();
	}
	await expect(place).toHaveCount(3);
	await expect(guide).toContainText('On Seat 2');
	await expect(guide).toContainText('On Seat 3');
	// Done stays in reach however long the step is.
	await guide.getByRole('button', { name: 'Done' }).tap();
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
	await page
		.getByRole('dialog', { name: 'Add script' })
		.getByRole('button', { name: 'Paste JSON', exact: true })
		.tap();
	const paste = page.getByRole('dialog', { name: 'Paste a script' });
	await paste
		.getByLabel('Script JSON or link')
		.fill(
			JSON.stringify([{ id: '_meta', name: 'Strings' }, 'clockmaker', 'chef', 'marionette', 'imp'])
		);
	await paste.getByRole('button', { name: 'Save' }).tap();
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
	await page.getByRole('button', { name: 'Save' }).tap();
	// The Demon's set keeps its name (Trevor, 2026-10-17).
	await expect(page.getByRole('button', { name: 'Rename the Demon bluffs' })).toHaveCount(0);

	const set = page.getByTestId('bluff-set').nth(1);
	const rename = () => set.getByRole('button', { name: /^Rename the .* bluffs$/ }).tap();
	const field = set.getByRole('textbox', { name: 'Set name' });
	await rename();
	await field.fill('Legion');
	await field.press('Enter');
	await expect(set).toHaveAttribute('data-set', 'Legion');

	// Esc leaves the name as it was.
	await rename();
	await field.fill('Something else');
	await field.press('Escape');
	await expect(set).toHaveAttribute('data-set', 'Legion');

	// Saved with the game.
	await page.reload();
	await menu(page, 'Demon bluffs');
	await expect(page.getByTestId('bluff-set').nth(1)).toHaveAttribute('data-set', 'Legion');

	// Clearing the name brings back the default.
	await rename();
	await set.getByRole('button', { name: 'Clear' }).tap();
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
	await page.getByRole('button', { name: 'Showing setup reminders; show all reminders' }).tap();
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

	// Asks again on the next Back, and Confirm leaves for where the game was opened from.
	await page.goBack();
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(/\/new$/);
});

test('once every token is placed, the middle offers the Demon bluffs', async ({ page }) => {
	// Trevor, 2026-10-17: a prompt like the bag's Set up.
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
	const centre = page.locator('.centre');
	await expect(centre.getByRole('button', { name: 'Demon bluffs' })).toBeVisible();
	await centre.getByRole('button', { name: 'Demon bluffs' }).tap();
	await expect(page.getByRole('dialog', { name: 'Demon bluffs' })).toBeVisible();
	await page.keyboard.press('Escape');
	// Not now: it goes.
	await centre.getByRole('button', { name: 'Not now' }).tap();
	await expect(centre.getByRole('button', { name: 'Demon bluffs' })).toHaveCount(0);
});

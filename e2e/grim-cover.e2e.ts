import { expect, test, type Page } from '@playwright/test';
import { addNote, leaveNote, newNoteRow, noteSummaries, noteTitle } from './notes.ts';
import { nameStoryteller, toBoard } from './new-game.ts';

// Trevor's playtest notes (2026-10-26): "Hide grim guesses, eyeball feature like we use in
// notes", and "Grim cover ... Accessible from day or grim view". Later the same day: "Cover
// screen should not be hidden in ... Menu. It should show the timer, along with other non
// secret information such as the script logo", "Should allow storyteller to set if grim cover
// requires a pin to open", and "Players don't need grim cover button".

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	return new URL(page.url()).pathname;
}

/** Expects the cover over everything, then takes it away with its ✕. */
async function coverAndUncover(page: Page) {
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await expect(cover).toBeVisible();
	// Only what isn't secret: the script, the night or day, and the timer.
	await expect(cover.getByRole('heading', { name: 'Trouble Brewing' })).toBeVisible();
	await expect(cover.getByTestId('cover-storyteller')).toHaveText('Storyteller: Trev');
	await expect(cover.getByTestId('cover-phase')).toHaveText('Setup');
	await expect(cover.getByTestId('day-timer')).toBeVisible();
	await expect(cover.getByRole('button', { name: /^Seat / })).toHaveCount(0);
	// A stray tap on the cover keeps it.
	await cover.tap({ position: { x: 20, y: 200 } });
	await expect(cover).toBeVisible();
	await cover.getByRole('button', { name: 'Close' }).tap();
	await expect(cover).toBeHidden();
}

test('a player hides their guesses and notes on the Grim tab, and has no cover', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seats = phone.getByTestId('grim-seat');
	await expect(seats).toHaveCount(8);

	// A guess and a note on seat 2.
	await seats.nth(1).tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 2 · Seat 2' });
	await sheet.getByRole('button', { name: 'Empath', exact: true }).tap();
	await addNote(phone, sheet.getByTestId('seat-note'), { text: 'Claims Empath' });
	await phone.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(seats.nth(1)).toHaveAttribute(
		'aria-label',
		'Seat 2: Seat 2, your guess: Empath, your note'
	);

	// The eye hides both, and a tap on the seat opens nothing.
	const eye = phone.getByTestId('hide-guesses');
	await expect(eye).toHaveAttribute('aria-pressed', 'false');
	const tools = await eye.boundingBox();
	await eye.tap();
	await expect(eye).toHaveAttribute('aria-pressed', 'true');
	await expect(seats.nth(1)).toHaveAttribute('aria-label', 'Seat 2: Seat 2');
	await expect(seats.nth(1).getByTestId('note-mark')).toHaveCount(0);
	await seats.nth(1).tap();
	await expect(sheet).toHaveCount(0);
	// Kept after a reload, and nothing moved.
	await phone.reload();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(eye).toHaveAttribute('aria-pressed', 'true');
	await expect(seats.nth(1)).toHaveAttribute('aria-label', 'Seat 2: Seat 2');
	expect(await eye.boundingBox()).toEqual(tools);
	// Off again, they are back.
	await eye.tap();
	await expect(seats.nth(1)).toHaveAttribute(
		'aria-label',
		'Seat 2: Seat 2, your guess: Empath, your note'
	);

	// The grim cover is the Storyteller's only.
	await expect(phone.getByTestId('cover-button')).toHaveCount(0);
	await phoneContext.close();
});

test('the Storyteller covers the screen from the board, beside ☰, and from the day', async ({
	page
}) => {
	await startGame(page);
	// Who runs the game shows too (Trevor, 2026-10-27: "Include storyteller name on grim cover").
	await nameStoryteller(page, 'Trev');

	// Never in the ⋯ menu.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(menu).toBeVisible();
	await expect(menu.getByRole('button', { name: 'Cover the screen' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();

	// Beside ☰ on the toolbar, in the same place as on the day (Trevor, 2026-10-27: "so it
	// doesn't move").
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	const onBoard = (await toolbar.getByTestId('cover-button').boundingBox())!;
	await page.getByTestId('cover-button').tap();
	await coverAndUncover(page);
	await expect(page.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();

	// The players' view, over the cover, as on /play: its title-line buttons, every tab and the
	// notes (Trevor, 2026-10-27: "As if they were within the app. We shouldn't even block
	// notes"). Without a room there is nobody to call.
	await page.getByTestId('cover-button').tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await expect(cover.getByRole('button', { name: 'Back to town' })).toHaveCount(0);
	await cover.getByRole('button', { name: 'Player view' }).tap();
	const view = page.getByTestId('cover-player-view');
	const viewDialog = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(viewDialog.getByRole('button', { name: 'Share script' })).toBeVisible();
	await expect(view.getByRole('tab')).toHaveText(['Script', 'Night', 'Grim', 'Notes']);
	await view.getByRole('tab', { name: 'Grim' }).tap();
	await expect(view.getByTestId('grim-seat')).toHaveCount(8);
	// A player's note, kept apart from the Storyteller's and gone when the view closes.
	await view.getByRole('tab', { name: 'Notes' }).tap();
	await view.getByTestId('new-note').first().tap();
	await noteTitle(newNoteRow(view)).fill('Sam is lying');
	await leaveNote(page);
	await expect.poll(noteSummaries(view)).toContain('Sam is lying');
	await viewDialog.getByRole('button', { name: 'Close' }).tap();
	await expect(view).toBeHidden();
	await cover.getByRole('button', { name: 'Player view' }).tap();
	await view.getByRole('tab', { name: 'Notes' }).tap();
	await expect(view.getByTestId('new-note').first()).toBeVisible();
	await expect.poll(noteSummaries(view)).not.toContain('Sam is lying');
	await viewDialog.getByRole('button', { name: 'Close' }).tap();
	await expect(view).toBeHidden();
	await expect(cover).toBeVisible();
	await cover.getByRole('button', { name: 'Close' }).tap();
	await expect(cover).toBeHidden();

	// From the day, which stays open under it: ☰ then the cover, where they are on the board,
	// and the day's name at the bottom across from Execution (Trevor, 2026-10-27, G3).
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
	await expect(day).toBeVisible();
	const inDay = (await day.getByTestId('cover-button').boundingBox())!;
	// On a phone the day fills the screen, so the cover stays where it was; a tablet's day is a
	// panel over the board.
	if (page.viewportSize()!.width < 640) {
		expect(Math.abs(inDay.y - onBoard.y)).toBeLessThan(12);
		expect(Math.abs(inDay.x - onBoard.x)).toBeLessThan(12);
	}
	const dayNav = (await day.getByRole('button', { name: 'Menu', exact: true }).boundingBox())!;
	expect(dayNav.x + dayNav.width).toBeLessThanOrEqual(inDay.x + 1);
	const dayName = (await day.getByTestId('day-name').boundingBox())!;
	const execution = (await day.getByRole('button', { name: 'Execution' }).boundingBox())!;
	expect(dayName.x + dayName.width).toBeLessThan(execution.x);
	expect(
		Math.abs(dayName.y + dayName.height / 2 - (execution.y + execution.height / 2))
	).toBeLessThan(8);
	// The Soundboard in the header, over the day (Trevor, 2026-10-27: "Approve day view E").
	await day.getByRole('button', { name: 'Soundboard' }).tap();
	const soundboard = page.getByRole('dialog', { name: 'Soundboard' });
	await expect(soundboard.getByRole('group', { name: 'Soundboard' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(soundboard).toBeHidden();
	await expect(day).toBeVisible();
	await day.getByTestId('cover-button').tap();
	await coverAndUncover(page);
	await expect(day).toBeVisible();
});

test('with the PIN setting on, the cover sets the PIN first and asks for it to come off', async ({
	page
}) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem('grim-games:preferences:v1'))
			localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ coverPin: true }));
	});
	await startGame(page);

	// The first cover asks for the game's PIN.
	await page.getByTestId('cover-button').tap();
	const set = page.getByRole('dialog', { name: 'Set the Storyteller PIN' });
	await set.getByLabel('PIN', { exact: true }).fill('2468');
	await set.getByLabel('PIN again').fill('2468');
	await set.getByRole('button', { name: 'Confirm' }).tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await expect(cover).toBeVisible();

	// ✕ asks for the PIN, over the cover; Cancel keeps it covered.
	await cover.getByRole('button', { name: 'Close' }).first().tap();
	const pin = page.getByRole('dialog', { name: 'Enter the Storyteller PIN' });
	await expect(pin).toBeVisible();
	await pin.getByRole('button', { name: 'Cancel' }).tap();
	await expect(pin).toBeHidden();
	await expect(cover).toBeVisible();

	// A wrong PIN keeps it covered; the right one takes it off.
	await cover.getByRole('button', { name: 'Close' }).first().tap();
	await pin.getByLabel('PIN', { exact: true }).fill('1111');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(pin.getByTestId('pin-message')).toHaveText('Wrong PIN.');
	await expect(cover).toBeVisible();
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(cover).toBeHidden();
	await expect(page.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();

	// The next cover takes the same PIN, with nothing to set.
	await page.getByTestId('cover-button').tap();
	await expect(cover).toBeVisible();
	await expect(set).toBeHidden();
});

// Trevor (2026-10-27): "I can't figure out how to toggle lock for grim cover", and he chose a
// lock on the cover itself plus one PIN and locks group in Settings > Storyteller.
test('the cover has its own lock, and Settings sets, changes and removes the PIN', async ({
	page
}) => {
	await startGame(page);
	await page.getByTestId('cover-button').tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	const lock = cover.getByTestId('cover-lock');
	await expect(lock).toHaveAttribute('aria-pressed', 'false');

	// On: the game has no PIN yet, so it sets one first.
	await lock.tap();
	const set = page.getByRole('dialog', { name: 'Set the Storyteller PIN' });
	await set.getByLabel('PIN', { exact: true }).fill('2468');
	await set.getByLabel('PIN again').fill('2468');
	await set.getByRole('button', { name: 'Confirm' }).tap();
	await expect(lock).toHaveAttribute('aria-pressed', 'true');

	// Off takes the PIN, so a player can't switch it off.
	await lock.tap();
	const pin = page.getByRole('dialog', { name: 'Enter the Storyteller PIN' });
	await pin.getByRole('button', { name: 'Cancel' }).tap();
	await expect(lock).toHaveAttribute('aria-pressed', 'true');
	await lock.tap();
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(lock).toHaveAttribute('aria-pressed', 'false');
	// Back on is one tap: the game keeps its PIN.
	await lock.tap();
	await expect(lock).toHaveAttribute('aria-pressed', 'true');
	await cover.getByRole('button', { name: 'Close' }).first().tap();
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(cover).toBeHidden();

	// Settings > Storyteller > PIN and locks: the same switch, and the game's PIN.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	const back = settings.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller' })
		.tap();
	await expect(settings.getByRole('heading', { name: 'PIN and locks' })).toBeVisible();
	await expect(
		settings.getByRole('checkbox', { name: 'PIN to take the cover off', includeHidden: true })
	).toBeChecked();
	await expect(settings.getByText('Set for this game.')).toBeVisible();

	// Change: the old PIN, then a new one.
	await settings.getByRole('button', { name: 'Change PIN' }).tap();
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await set.getByLabel('PIN', { exact: true }).fill('1357');
	await set.getByLabel('PIN again').fill('1357');
	await set.getByRole('button', { name: 'Confirm' }).tap();
	await expect(set).toBeHidden();

	// Remove takes the new PIN.
	await settings.getByRole('button', { name: 'Remove PIN' }).tap();
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(pin.getByTestId('pin-message')).toHaveText('Wrong PIN.');
	await pin.getByLabel('PIN', { exact: true }).fill('1357');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(settings.getByText('None for this game.')).toBeVisible();
	await expect(settings.getByRole('button', { name: 'Set PIN' })).toBeVisible();
	await expect(settings.getByRole('button', { name: 'Remove PIN' })).toBeDisabled();
});

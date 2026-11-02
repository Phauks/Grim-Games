import { expect, test, type Page } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { pickScript, toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// Deal (Trevor, 2026-10-26: "auto select characters and send to players"): the bag goes to the
// seats at random, every seat whether or not its player has a phone, and a seated phone holds
// to see its own character while the Storyteller lets players see theirs.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

/** Names seat `number` on the board: a phone with that name sits there (Trevor, 2026-10-26). */
async function nameSeat(page: Page, board: string, number: number, name: string) {
	await page.goto(board);
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test('Deal gives every seat a character, and a seated phone holds to see its own', async ({
	page,
	browser
}, testInfo) => {
	// The Storyteller's clock, so the minute players may look can be skipped.
	await page.clock.install();
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);

	// A phone joins, and the Storyteller seats it in seat 2.
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await nameSeat(page, board, 2, 'Alex');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '2');
	await expect(phone.getByRole('button', { name: 'Settings: Alex' })).toBeVisible();
	// Nothing to see before the deal: the button keeps its row, disabled (Trevor, 2026-10-28).
	await expect(phone.getByTestId('your-character')).toBeDisabled();

	// Deal, with the players' switch left on.
	await page.goto(`${board}/draw`);
	await page.getByRole('button', { name: 'Deal' }).tap();
	const deal = page.getByRole('alertdialog', { name: 'Deal at random?' });
	await expect(deal).toContainText('The 5 tiles left in the bag go to the empty seats at random');
	await expect(
		deal.getByRole('checkbox', { name: 'Players can see their character' })
	).toBeChecked();
	await deal.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);
	await expect(page.getByRole('button', { name: 'Deal' })).toBeDisabled();

	// The phone holds to see its character; the name shows only while held.
	await phone.getByTestId('your-character').tap();
	const card = phone.getByRole('dialog', { name: 'Your character' });
	const hold = card.getByTestId('role-hold');
	await expect(card.getByTestId('role-name')).toBeHidden();
	// Seeing it moves nothing in the card (Trevor, 2026-10-28: "there is reflow").
	const before = await card.boundingBox();
	// The fair-play notice shows before and while it is held (Trevor, 2026-10-27).
	const fairPlay = card.getByTestId('fair-play');
	await expect(fairPlay).toContainText('This is for your eyes only');
	await hold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
	await expect(card.getByTestId('role-name')).toBeVisible();
	await expect(card.getByTestId('role-name')).toHaveText(/Washerwoman|Empath|Monk|Poisoner|Imp/);
	const phoneSees = (await card.getByTestId('role-name').textContent())!.trim();
	await expect(fairPlay).toBeVisible();
	expect(await card.boundingBox()).toEqual(before);
	await hold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
	await expect(card.getByTestId('role-name')).toBeHidden();

	// The Storyteller's player view has the same row (Trevor, 2026-10-30): pick a seat, then
	// see that seat's card as its phone does.
	await page.goto(board);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const view = page.getByTestId('script-scroll');
	await view.getByTestId('your-character').tap();
	await page.getByTestId('role-seats').getByRole('button', { name: /Alex/ }).tap();
	const stCard = page.getByRole('dialog').filter({ has: page.getByTestId('role-card') });
	const stHold = stCard.getByTestId('role-hold');
	await stHold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
	await expect(stCard.getByTestId('role-name')).toHaveText(phoneSees);
	await stHold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
	await page.keyboard.press('Escape');
	await expect(stCard).toBeHidden();

	// Each player's row on Players marks who has seen theirs (Trevor, 2026-10-30: combined
	// with the list of players): seat 2 has, the others have no phone.
	await page.goto(`${board}/players`);
	const rows = page.getByTestId('room-player');
	await expect(rows).toHaveCount(5);
	await expect(rows.nth(1).getByTestId('room-player-seen')).toHaveAttribute('data-seen', '');
	await expect(rows.nth(1).getByRole('img', { name: 'Seen' })).toBeVisible();
	await expect(rows.nth(0).getByTestId('room-player-seen')).not.toHaveAttribute('data-seen');
	await expect(rows.nth(0).getByTestId('room-player-phone')).toHaveAttribute('data-phone', 'none');

	// A minute after it was turned on, it turns itself off and the phone can no longer open it
	// (Trevor, 2026-10-28: "only be available for 1 minute, then turn off"). A button, not a
	// switch (Trevor, 2026-10-30), beside the ✕, that turns into the timer while players can
	// look (Trevor, 2026-10-31).
	const toggle = page.getByTestId('roles-show');
	await expect(toggle).toHaveAttribute('data-shown', 'true');
	await expect(toggle).toHaveAccessibleName(/^Hide characters, 0:[0-5]\d left$/);
	// The Storyteller sees how much longer (Trevor, 2026-10-29).
	const timeLeft = page.getByTestId('roles-time-left');
	await expect(timeLeft).toHaveText(/^Hide · 0:[0-5]\d$/);
	await page.clock.fastForward('01:01');
	await expect(toggle).toHaveAccessibleName('Show characters');
	await expect(timeLeft).toBeHidden();
	await expect(card).toBeHidden();
	await expect(phone.getByTestId('your-character')).toBeDisabled();
	// Who has looked stays.
	await expect(rows.nth(1).getByTestId('room-player-seen')).toHaveAttribute('data-seen', '');

	// Shown again, and hidden by hand. Every seat has a character but only seat 2 has a phone,
	// so it first says who won't see theirs (Trevor, 2026-10-31); Cancel shows nothing.
	await toggle.tap();
	const warning = page.getByRole('alertdialog', { name: 'Not every player will see a character' });
	const gaps = warning.getByTestId('roles-gap');
	await expect(gaps).toHaveCount(4);
	await expect(gaps.first()).toContainText('Seat 1');
	await expect(gaps.first()).toContainText('No phone');
	await expect(warning).not.toContainText('Alex');
	await warning.getByRole('button', { name: 'Cancel' }).tap();
	await expect(toggle).toHaveAccessibleName('Show characters');
	await toggle.tap();
	await warning.getByRole('button', { name: 'Confirm' }).tap();
	await expect(phone.getByTestId('your-character')).toBeEnabled();
	// Then the draw, where each player with no phone has their tile held again with their name
	// on it, for the usual reveal and Confirm on this device, in any order (Trevor, 2026-11-01:
	// "it should use the normal draw area").
	await expect(page).toHaveURL(`${board}/draw`);
	const named = page.getByRole('button', { name: /^Tile Seat \d, held by/ });
	await expect(named).toHaveCount(4);
	await expect(named.nth(0)).toContainText('Seat');
	await page.getByRole('button', { name: /^Tile Seat 4, held by/ }).tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal.getByTestId('reveal-name')).toHaveText(
		/Washerwoman|Empath|Monk|Poisoner|Imp/
	);
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(reveal).toBeHidden();
	await expect(named).toHaveCount(3);
	await expect(page.getByRole('button', { name: /^Tile \S+, drawn$/ })).toHaveCount(2);
	await page.goto(`${board}/players`);
	await toggle.tap();
	await expect(phone.getByTestId('your-character')).toBeDisabled();
	// Off for the Storyteller's player view too.
	await page.goto(board);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	await expect(view.getByTestId('your-character')).toBeDisabled();
	await phoneContext.close();
});

// The Gardener (M16, Trevor 2026-11-02: "just let them set what character they are, but not
// location for now"): no bag, the Storyteller sets each character on the board, and after Show
// characters each player with no phone gets a tile with their name for the usual reveal.
// Wiki: https://wiki.bloodontheclocktower.com/Gardener
test('characters set on the board give players with no phone a name tile to see theirs', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await pickNumber(page, 'Players', 5);
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	for (const [number, character] of [
		[1, 'Empath'],
		[2, 'Imp']
	] as const) {
		await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
		await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name: character, exact: true })
			.tap();
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
	}

	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	await page.goto(`${board}/players`);
	await page.getByTestId('roles-show').tap();
	await page
		.getByRole('alertdialog', { name: 'Not every player will see a character' })
		.getByRole('button', { name: 'Confirm' })
		.tap();

	// No bag, yet the draw has a tile for each, held, with the player's name on it.
	await expect(page).toHaveURL(`${board}/draw`);
	await expect(page.getByTestId('no-bag')).toBeHidden();
	const named = page.getByRole('button', { name: /^Tile Seat \d, held by/ });
	await expect(named).toHaveCount(2);
	await page.getByRole('button', { name: /^Tile Seat 1, held by/ }).tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal.getByTestId('reveal-name')).toHaveText(/^\s*Empath\b/);
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(reveal).toBeHidden();
	await expect(named).toHaveCount(1);
	await page.getByRole('button', { name: /^Tile Seat 2, held by/ }).tap();
	await expect(reveal.getByTestId('reveal-name')).toHaveText(/^\s*Imp\b/);
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(named).toHaveCount(0);
	await expect(page.getByTestId('no-bag')).toBeVisible();
});

// Playtest (Trevor, 2026-10-26: "I joined a game as Phone ... I did not get notified, and my
// name was not placed in the grim"): Deal gives a phone that sits nowhere the first unnamed
// seat, so it gets its character without the Storyteller typing its name.
test('a phone that joins is named on a seat and gets its character from Deal', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);

	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.goto(`${board}/draw`);
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Phone');
	await phone.keyboard.press('Escape');
	await expect(phone.getByRole('button', { name: 'Settings: Phone' })).toBeVisible();

	// No seat named by hand: Deal puts the phone's name on seat 1, and the phone sits there.
	await page.getByRole('button', { name: 'Deal' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Deal at random?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '1');
	await expect(phone.getByTestId('your-character')).toBeVisible();
	await page.goto(board);
	await expect(page.getByRole('button', { name: /^Seat 1: Phone/ })).toBeVisible();
	await phoneContext.close();
});

// Plan H2 (Trevor, 2026-10-26: "no draw, just good or evil"): the town knows a Traveller's
// character (https://wiki.bloodontheclocktower.com/Travellers), so their phone shows only the
// alignment the Storyteller chose.
test('a Traveller’s phone holds to see only "You are Evil"', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;

	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Sam');
	await phone.keyboard.press('Escape');
	await nameSeat(page, board, 1, 'Sam');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '1');
	await expect(phone.getByRole('button', { name: 'Settings: Sam' })).toBeVisible();
	await page.goto(`${board}/players`);
	await page.getByTestId('roles-show').tap();
	// No seat has a character yet, and only Sam's has a phone (Trevor, 2026-10-31).
	const warning = page.getByRole('alertdialog', { name: 'Not every player will see a character' });
	await expect(warning.getByTestId('roles-gap').first()).toContainText('Sam');
	await expect(warning.getByTestId('roles-gap').first()).toHaveText(/Sam\s*No character$/);
	await warning.getByRole('button', { name: 'Confirm' }).tap();

	// The Storyteller makes seat 1 the Thief, evil, with no draw.
	await page.goto(board);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await page
		.locator('[data-scope="drawer"][data-part="content"]')
		.getByRole('button', { name: 'Choose' })
		.first()
		.tap();
	await page
		.getByRole('dialog', { name: 'Character for Sam' })
		.getByRole('button', { name: /^Thief/ })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();

	await phone.getByTestId('your-character').tap();
	const card = phone.getByRole('dialog', { name: 'Your character' });
	const hold = card.getByTestId('role-hold');
	await expect(card).not.toContainText('You are Evil');
	await hold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
	await expect(hold).toHaveText('You are Evil');
	await expect(card.getByTestId('role-name')).toHaveText('');
	await hold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
	await expect(card).not.toContainText('You are Evil');
	await phoneContext.close();
});

import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';
import { pickNumber } from './number-select.ts';

// Add late player (Trevor, 2026-10-30): someone arrives after the tiles are dealt and joins as
// one more player instead of a Traveller. Roll suggests who changes; the Storyteller confirms.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

test('Add late player seats late players where tapped and makes room in the bag', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);

	await page.getByRole('button', { name: 'Deal' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Deal at random?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);

	// The button opens the modal; Choose seat goes to the grimoire to tap the spot, and the
	// modal comes back with everything kept (Trevor, 2026-10-30).
	await page.getByRole('button', { name: 'Add late player' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Add late player' });
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(1);
	await expect(sheet.getByTestId('late-player-row')).toContainText('Seat not chosen yet');
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Max');
	await sheet.getByTestId('late-place').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: /^Place between Seat 1 and Seat 2$/ }).tap();
	await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Max');
	await expect(sheet.getByTestId('late-player-row')).toContainText('Between');
	// A second late player, placed at their own spot.
	await sheet.getByTestId('late-add-another').tap();
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(2);
	await sheet.getByRole('textbox', { name: 'Name' }).nth(1).fill('Noa');
	await sheet.getByTestId('late-place').nth(1).tap();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: /^Place between Seat 3 and Seat 4$/ }).tap();
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(2);
	await expect(sheet.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Max');
	// Seven players have 5, 0, 1, 1 (https://wiki.bloodontheclocktower.com/Setup).
	await expect(sheet).toContainText('5 → 7 players');
	await expect(sheet.getByTestId('late-check')).toContainText('Not the 7-player counts');

	// Character selection's own list, its counts pinned at the top (Trevor, 2026-10-31).
	const list = sheet.getByTestId('late-after');
	await expect(list.getByTestId('selection-band').getByTestId('count-townsfolk')).toHaveText('3');
	await sheet.getByTestId('late-roll').tap();
	await expect(sheet.getByTestId('late-check')).toHaveText('Matches the 7-player counts.');
	// The Sentinel is a character in the list, its icon and ability (Trevor, 2026-10-30).
	await expect(list.getByText('Sentinel', { exact: true })).toBeVisible();
	// A Fabled or Loric is chosen and taken out again like any character (Trevor, 2026-10-31).
	const sentinel = list
		.getByRole('button', { name: /^Sentinel/ })
		.and(page.locator('[aria-pressed]'));
	await list.getByText('Sentinel', { exact: true }).tap();
	await expect(sentinel).toHaveAttribute('aria-pressed', 'true');
	await list.getByText('Sentinel', { exact: true }).tap();
	await expect(sentinel).toHaveAttribute('aria-pressed', 'false');
	await sheet.getByTestId('late-roll').tap();
	// Only the changes, in their own sheet.
	await sheet.getByTestId('late-show-changes').tap();
	const changes = page.getByRole('dialog', { name: 'Changes' });
	await expect(changes.getByTestId('late-change-list')).toContainText('Max');
	await expect(changes.getByTestId('late-change-list')).toContainText('Noa');
	await changes.getByRole('button', { name: 'Close' }).tap();
	// Back to the draw as it was undoes the roll; Roll again for the counts.
	await sheet.getByTestId('late-revert').tap();
	await expect(sheet.getByTestId('late-check')).toContainText('Not the 7-player counts');
	await sheet.getByTestId('late-roll').tap();
	await expect(sheet.getByTestId('late-check')).toHaveText('Matches the 7-player counts.');

	await sheet.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: /^Seat 2: Max/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Seat 5: Noa/ })).toBeVisible();
	// Max and Noa draw the two tiles in the bag.
	await page.goto(page.url() + '/draw');
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);
	await expect(page.getByRole('button', { name: /^Tile \d$/ })).toHaveCount(2);
});

test('Add late player can seat a phone in the room, as the bag draw does', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	const draw = page.url();
	await page.getByRole('button', { name: 'Deal' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Deal at random?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);

	// Zed's phone comes in after every tile is dealt, so has no seat.
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	const room = page.getByRole('dialog', { name: 'Share' });
	await expect(room.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await room.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await room.getByRole('button', { name: 'Close' }).tap();
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Zed');
	await phone.keyboard.press('Escape');

	// The late player's name is picked from the room's phones, the reveal's own field.
	await page.getByRole('button', { name: 'Add late player' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Add late player' });
	await sheet.getByRole('button', { name: 'Pick a phone in the room' }).tap();
	await page
		.getByRole('dialog', { name: 'Pick a phone in the room' })
		.getByRole('button', { name: 'Zed', exact: true })
		.tap();
	await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Zed');
	await sheet.getByTestId('late-roll').tap();
	await sheet.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(sheet).toBeHidden();
	// Zed's phone sits at the new seat (phones sit by name).
	await page.goto(draw.replace(/\/draw$/, '/players'));
	const zed = page.getByTestId('room-player').filter({ hasText: 'Zed' });
	await expect(zed.getByTestId('room-player-phone')).toHaveAttribute('data-phone', 'here');
	await expect(zed).not.toContainText('No seat');
});

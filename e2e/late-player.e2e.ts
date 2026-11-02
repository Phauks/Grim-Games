import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';
import { pickNumber } from './number-select.ts';
import { clippedBands } from './type-bands.ts';

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
	// Every character type's band is drawn whole (Trevor, 2026-11-01: a cut-off pill).
	await expect(sheet.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
	expect(await clippedBands(page)).toEqual([]);
	await sheet.getByRole('combobox', { name: 'Name' }).fill('Max');
	await sheet.getByTestId('late-place').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: /^Place between Seat 1 and Seat 2$/ }).tap();
	await expect(sheet.getByRole('combobox', { name: 'Name' })).toHaveValue('Max');
	await expect(sheet.getByTestId('late-player-row')).toContainText('Between');
	// A second late player, placed at their own spot.
	await sheet.getByTestId('late-add-another').tap();
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(2);
	await sheet.getByRole('combobox', { name: 'Name' }).nth(1).fill('Noa');
	await sheet.getByTestId('late-place').nth(1).tap();
	await expect(sheet).toBeHidden();
	// Max shows where he goes, so Noa can sit elsewhere or beside him (Trevor, 2026-10-31).
	await expect(page.getByTestId('place-pending')).toHaveText('Max');
	await page.getByRole('button', { name: /^Place between Seat 3 and Seat 4$/ }).tap();
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(2);
	await expect(sheet.getByRole('combobox', { name: 'Name' }).first()).toHaveValue('Max');
	// Character selection's own player count (Trevor, 2026-10-31): one more adds a late
	// player, one fewer takes the last one away.
	const count = sheet.getByRole('combobox', { name: 'Players', exact: true });
	await expect(count).toHaveText('7');
	await pickNumber(sheet, 'Players', 8);
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(3);
	await pickNumber(sheet, 'Players', 7);
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(2);
	await expect(sheet.getByRole('combobox', { name: 'Name' }).nth(1)).toHaveValue('Noa');

	// Character selection's own list and counts, pinned at the top (Trevor, 2026-10-31).
	// Seven players have 5, 0, 1, 1 (https://wiki.bloodontheclocktower.com/Setup); a count
	// that doesn't match is outlined, as on Character selection.
	const list = sheet.getByTestId('late-after');
	const band = list.getByTestId('selection-band');
	const matching = band.locator('[data-testid="setup-counts"] > [data-ok]');
	await expect(band.getByTestId('count-townsfolk')).toHaveText('3');
	await expect(matching).not.toHaveCount(5);
	await sheet.getByRole('button', { name: 'Roll', exact: true }).tap();
	await expect(matching).toHaveCount(5);
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
	// Invoking a rule character starts the roll over, so the button says Roll again.
	await sheet.getByRole('button', { name: 'Roll', exact: true }).tap();
	await expect(sheet.getByRole('button', { name: 'Shuffle', exact: true })).toBeVisible();
	// Only the changes, in their own sheet.
	await sheet.getByRole('button', { name: 'Show only Changes', exact: true }).tap();
	const changes = page.getByRole('dialog', { name: 'Changes' });
	await expect(changes.getByTestId('late-change-list')).toContainText('Max');
	await expect(changes.getByTestId('late-change-list')).toContainText('Noa');
	await changes.getByRole('button', { name: 'Close' }).tap();
	// Show only In-Play keeps what is in play; Reset undoes the roll; Roll again.
	await sheet.getByRole('button', { name: 'Show only In-Play', exact: true }).tap();
	await expect(list.getByText('Sentinel', { exact: true })).toBeHidden();
	await sheet.getByRole('button', { name: 'Show only In-Play', exact: true }).tap();
	await sheet.getByRole('button', { name: 'Reset', exact: true }).tap();
	await expect(matching).not.toHaveCount(5);
	await sheet.getByRole('button', { name: 'Roll', exact: true }).tap();
	await expect(matching).toHaveCount(5);

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
	await sheet.getByRole('combobox', { name: 'Name' }).tap();
	await page.getByRole('option', { name: 'Zed', exact: true }).tap();
	await expect(sheet.getByRole('combobox', { name: 'Name' })).toHaveValue('Zed');
	await sheet.getByTestId('late-roll').tap();
	await sheet.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(sheet).toBeHidden();
	// Zed's phone sits at the new seat (phones sit by name).
	await page.goto(draw.replace(/\/draw$/, '/players'));
	const zed = page.getByTestId('room-player').filter({ hasText: 'Zed' });
	await expect(zed.getByTestId('room-player-phone')).toHaveAttribute('data-phone', 'here');
	await expect(zed).not.toContainText('No seat');
});

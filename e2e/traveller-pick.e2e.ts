import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';
import { addSeat } from './seating.ts';

// Travellers choose on their phones (plan L102; Trevor, 2026-10-31): the Storyteller sends the
// Travellers allowed, everyone choosing sees the same list, a tap holds one so no one else can
// take it, the player can change until Confirm, and the Storyteller picks the alignment
// (https://wiki.bloodontheclocktower.com/Glossary, "Traveller").

async function openRoom(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.goto(board);
	return code;
}

async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function joinAs(browser: Browser, testInfo: TestInfo, code: string, name: string) {
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, name);
	await phone.keyboard.press('Escape');
	return phone;
}

/** Ends the day with no execution, so the night is underway and a seat added now sits out. */
async function startNight(page: Page) {
	const day = page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await day.getByRole('button', { name: 'Execution' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'End the day?' });
	await confirm.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: 'No execution', exact: true }).tap();
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(day).toBeHidden();
}

/**
 * A seat added mid-game is not in play, and nothing opens by itself (Trevor, 2026-11-02: no
 * one sits there yet); its empty token asks "Add as a Traveller?".
 */
async function askTraveller(page: Page, seat: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${seat}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Add as a Traveller?' }).tap();
	return page.getByRole('dialog', { name: 'Add as a Traveller?' });
}

const row = (page: Page, name: string) =>
	page
		.getByRole('dialog', { name: 'Choose your Traveller' })
		.getByRole('button', { name: new RegExp(`^${name}`) });

test('Travellers choose on their phones: a tap holds one, Confirm puts it on the seat', async ({
	page,
	browser
}, testInfo) => {
	test.slow();
	const code = await openRoom(page);
	const ana = await joinAs(browser, testInfo, code, 'Ana');
	const bo = await joinAs(browser, testInfo, code, 'Bo');
	// Naming a seat with a phone's name seats that phone; Cy has no phone.
	await nameSeat(page, 1, 'Ana');
	await nameSeat(page, 2, 'Bo');
	await nameSeat(page, 3, 'Cy');

	// A Traveller arrives mid-game: Add seat only places the seat, not in play (Trevor,
	// 2026-11-02). Its token asks "Add as a Traveller?"; with no phone there, Send to their phone
	// starts off. The Storyteller turns it on, ticks the other three and sends the recommended.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(
		page
			.getByRole('dialog', { name: 'Grimoire' })
			.getByRole('button', { name: 'Travellers choose' })
	).toHaveCount(0);
	await page.keyboard.press('Escape');
	await startNight(page);
	await addSeat(page, /^Place between Cy and /);
	await expect(page.getByRole('dialog', { name: 'Add as a Traveller?' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Seat 4:/ })).toHaveAccessibleName(/not in play/);
	const ask = await askTraveller(page, 4);
	const phones = ask.getByRole('checkbox', { name: 'Send to their phone' });
	await expect(phones).not.toBeChecked();
	await ask.getByText('Send to their phone').tap();
	await expect(phones).toBeChecked();
	const send = page.getByTestId('traveller-pick-send');
	await expect(send.getByRole('checkbox', { name: 'Seat 4' })).toBeChecked();
	// Selection (Trevor, 2026-11-01): All, Recommended (shown), or Custom (the full list).
	await send.getByRole('combobox', { name: 'Selection' }).tap();
	await expect(page.getByRole('option')).toHaveText([
		'All Travellers',
		'Recommended Travellers',
		'Custom'
	]);
	await page.getByRole('option', { name: 'Recommended Travellers' }).tap();
	await expect(send.getByTestId('traveller-pick-recommended')).toContainText('Scapegoat');
	for (const name of ['Ana', 'Bo', 'Cy']) await send.getByText(name, { exact: true }).tap();
	await page.getByRole('button', { name: 'Send' }).tap();
	// The phones choose in the background (Trevor, 2026-11-02): the pop-up closes, and the new
	// seat's empty token opens the list again while it is choosing.
	await expect(ask).toBeHidden();
	const status = page.getByTestId('traveller-pick-status');
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Travellers choose' }).tap();
	await expect(status).toContainText('Choosing');

	// Both phones get the same list: Trouble Brewing's own Travellers.
	await expect(row(ana, 'Scapegoat')).toBeVisible();
	await expect(row(bo, 'Thief')).toBeVisible();
	await expect(row(ana, 'Harlot')).toHaveCount(0);

	// Ana holds the Scapegoat: Bo can't take it, and sees who holds it.
	await row(ana, 'Scapegoat').tap();
	await expect(row(ana, 'Scapegoat')).toHaveAttribute('aria-current', 'true');
	await expect(row(bo, 'Scapegoat')).toBeDisabled();
	await expect(status).toContainText(/Scapegoat\s*held/);

	// Ana changes her mind before sending: the Scapegoat is free again.
	await row(ana, 'Thief').tap();
	await expect(row(bo, 'Scapegoat')).toBeEnabled();
	await expect(row(bo, 'Thief')).toBeDisabled();
	await ana
		.getByRole('dialog', { name: 'Choose your Traveller' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(row(ana, 'Thief')).toHaveAccessibleName(/Sent/);
	// Locked once sent.
	await expect(row(ana, 'Scapegoat')).toBeDisabled();

	// The Storyteller sees it confirmed.
	await expect(status).toContainText(/Thief\s*confirmed/);

	// Cy has no phone: the Storyteller picks for them.
	await status
		.getByRole('listitem')
		.filter({ hasText: 'Cy' })
		.getByRole('button', { name: 'Pick' })
		.tap();
	const pickFor = page.getByRole('dialog', { name: 'Pick for Cy' });
	await expect(pickFor.getByRole('button', { name: /^Thief/ })).toHaveCount(0);
	await pickFor.getByRole('button', { name: /^Beggar/ }).tap();
	await expect(status).toContainText(/Beggar\s*confirmed/);
	await expect(row(bo, 'Beggar')).toBeDisabled();

	// The alignment waits for the Traveller alignment step or the seat (Trevor, 2026-11-01).
	await expect(status.getByRole('combobox')).toHaveCount(0);

	// Confirmed Travellers are on their seats (stopping, then closing Seat 4's sheet under it).
	await page.getByRole('button', { name: 'Stop choosing' }).tap();
	await expect(status).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: /^Seat 1: Ana/ })).toHaveAccessibleName(/Thief/);
	await expect(page.getByRole('button', { name: /^Seat 3: Cy/ })).toHaveAccessibleName(/Beggar/);

	// The next arrival: seats with a character token, Travellers too, are shown but greyed.
	await addSeat(page, /^Place between Bo and /);
	await (await askTraveller(page, 3)).getByText('Send to their phone').tap();
	await expect(send.getByRole('checkbox', { name: 'Ana' })).toBeDisabled();
	await expect(send.getByRole('checkbox', { name: 'Cy' })).toBeDisabled();
	await expect(send.getByRole('checkbox', { name: 'Bo' })).toBeEnabled();

	await ana.context().close();
	await bo.context().close();
});

test('a Traveller arriving with no room open is picked here', async ({ page }) => {
	// "Add as a Traveller?" on a seat added mid-game (Trevor, 2026-11-02): with no room, Send to
	// their phone is off and the allowed Travellers are a list to tap; the alignment waits.
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await startNight(page);
	await addSeat(page, /^Place between Seat 2 and /);
	const ask = await askTraveller(page, 3);
	const phones = ask.getByRole('checkbox', { name: 'Send to their phone' });
	await expect(phones).not.toBeChecked();
	await expect(phones).toBeDisabled();
	await ask
		.getByTestId('traveller-pick-here')
		.getByRole('button', { name: /^Thief/ })
		.tap();
	await expect(ask).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /^Seat 3:/ })).toHaveAccessibleName(/Thief/);
});

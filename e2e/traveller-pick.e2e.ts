import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';

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

	// Travellers choose is part of Add seat (Trevor, 2026-11-01): placing a new seat opens it
	// with that seat ticked. The Storyteller ticks the other three and sends the recommended.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(menu.getByRole('button', { name: 'Travellers choose' })).toHaveCount(0);
	await menu.getByRole('button', { name: 'Add seat' }).tap();
	await page.getByRole('button', { name: /^Place between Cy and / }).tap();
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
	const status = page.getByTestId('traveller-pick-status');
	await expect(status).toContainText('Choosing');

	// Closed, it opens again from the new seat's empty token while that seat is choosing.
	await page.keyboard.press('Escape');
	await expect(status).toBeHidden();
	await page.getByRole('button', { name: /^Seat 4/ }).tap();
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

	// The next Add seat: seats with a character token, Travellers too, are shown but greyed.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await menu.getByRole('button', { name: 'Add seat' }).tap();
	await page.getByRole('button', { name: /^Place between Bo and / }).tap();
	await expect(send.getByRole('checkbox', { name: 'Ana' })).toBeDisabled();
	await expect(send.getByRole('checkbox', { name: 'Cy' })).toBeDisabled();
	await expect(send.getByRole('checkbox', { name: 'Bo' })).toBeEnabled();

	await ana.context().close();
	await bo.context().close();
});

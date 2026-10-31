import {
	expect,
	test,
	type Browser,
	type Locator,
	type Page,
	type TestInfo
} from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';

// Seating on the grim (plan J38; Trevor, 2026-10-29 22:36: "yes to drag circle, yes to claim",
// with no left and right): while seating is open each phone drags its own disc onto the seat it
// wants, which lights up, and the drop takes that seat's place (Trevor, 2026-10-31: not between
// seats); the Storyteller locks seating from ⋯; then a phone taps an open seat.

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

/** Names a seat on the board, which seats the phone with that name. */
async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function seatingFromMenu(page: Page, item: 'Open seating' | 'Lock seating') {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: item }).tap();
}

async function joinAs(browser: Browser, testInfo: TestInfo, code: string, name: string) {
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, name);
	await phone.keyboard.press('Escape');
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	return phone;
}

async function centre(locator: Locator) {
	const box = (await locator.boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('phones drag their own seat while seating is open, then claim an open seat once locked', async ({
	page,
	browser
}, testInfo) => {
	// Two phones join, one after the other.
	test.slow();
	const code = await openRoom(page);
	await nameSeat(page, 1, 'Cy');
	await nameSeat(page, 2, 'Eve');
	const phone = await joinAs(browser, testInfo, code, 'Ana');
	const seats = phone.getByTestId('grim-seat');
	const line = phone.getByTestId('seating-line');
	await expect(phone.getByTestId('seating-disc')).toHaveCount(0);

	await seatingFromMenu(page, 'Open seating');
	await expect(line).toHaveText('Seating is open');

	const disc = phone.getByTestId('seating-disc');
	const target = phone.getByTestId('seating-target');
	async function dragTo(to: { x: number; y: number }) {
		const from = await centre(disc);
		await phone.mouse.move(from.x, from.y);
		await phone.mouse.down();
		await phone.mouse.move(to.x, to.y, { steps: 8 });
	}

	// Held away from every seat, nothing lights up and the drop changes nothing.
	const middle = await centre(disc);
	await dragTo({ x: middle.x + 4, y: middle.y + 12 });
	await expect(target).toHaveCount(0);
	await expect(line).toHaveText('Seating is open');
	await phone.mouse.up();

	// A phone with no seat drags its disc onto Eve's seat: it lights up and the line names it.
	await dragTo(await centre(seats.nth(1)));
	await expect(target).toHaveAttribute('data-seat', '2');
	await expect(line).toHaveText(/^Sit in Seat 2\s*Eve$/);
	await phone.mouse.up();
	await expect(target).toHaveCount(0);
	// The board seats the phone in that place, Eve moves one along, and every grim shows it.
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /^Seat 2: Ana/);
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /^Seat 3: Eve/);
	await expect(page.getByRole('button', { name: /^Seat 2: Ana/ })).toBeVisible();

	// Onto an open seat, the two swap: the chair Ana left is the empty one.
	await dragTo(await centre(seats.nth(4)));
	await expect(target).toHaveAttribute('data-seat', '5');
	await expect(line).toHaveText('Sit in Seat 5');
	await phone.mouse.up();
	await expect(seats.nth(4)).toHaveAttribute('aria-label', /^Seat 5: Ana/);
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /^Seat 3: Eve/);
	await expect(page.getByRole('button', { name: /^Seat 5: Ana/ })).toBeVisible();

	// Locked: no more dragging, and a phone with no seat taps an open one to sit there.
	await seatingFromMenu(page, 'Lock seating');
	await expect(line).toHaveCount(0);
	const bo = await joinAs(browser, testInfo, code, 'Bo');
	await bo.getByTestId('grim-seat').nth(1).tap();
	const ask = bo.getByRole('alertdialog', { name: 'Sit in Seat 2?' });
	await expect(ask.getByTestId('seating-claim')).toHaveText(/^Between\s*Cy\s*and\s*Eve$/);
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(bo.getByTestId('grim-seat').nth(1)).toHaveAttribute('aria-label', /^Seat 2: Bo/);
	await expect(page.getByRole('button', { name: /^Seat 2: Bo/ })).toBeVisible();

	await phone.context().close();
	await bo.context().close();
});

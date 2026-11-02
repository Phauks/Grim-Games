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
import { notATraveller } from './add-seat.ts';

// Seating on the grim (plan J38; Trevor, 2026-10-29 22:36: "yes to drag circle, yes to claim",
// with no left and right): while seating is open each phone drags its own disc onto the seat it
// wants, which lights up, and the drop takes that seat's place (Trevor, 2026-10-31: not between
// seats), or into a space to move its seat there. Seating is one mode on the Storyteller's board
// (Trevor, 2026-10-31), its "Open seating" switch on from the start; Done locks seating,
// then a phone taps an open seat.

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

async function enterSeating(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Seating' })
		.tap();
	await expect(page.getByRole('toolbar', { name: 'Grimoire' })).toContainText('Seating');
}

async function leaveSeating(page: Page) {
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await toolbar.getByRole('button', { name: 'Done' }).tap();
	await expect(toolbar.getByRole('button', { name: 'Open seating' })).toHaveCount(0);
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

	await enterSeating(page);
	// Every Seating control in the top bar, alike (Trevor, 2026-11-01); this one stays
	// pressed while phones may move their seats.
	const phones = page
		.getByRole('toolbar', { name: 'Grimoire' })
		.getByRole('button', { name: 'Open seating' });
	await expect(phones).toHaveAttribute('aria-pressed', 'true');
	await expect(line).toHaveText('Seating is open');
	await page.screenshot({ path: `test-results/seating-top-bar-${testInfo.project.name}.png` });
	// Words beside the icons on a tablet, icons only on a phone (Trevor, 2026-11-01), and
	// all seven tools fit across the bar either way.
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	const words = toolbar.getByText('Open seating', { exact: true });
	if (testInfo.project.name === 'tablet') await expect(words).toBeVisible();
	else await expect(words).toBeHidden();
	const fits = await toolbar.evaluate((bar) => bar.scrollWidth <= bar.clientWidth);
	expect(fits).toBe(true);
	for (const tool of await toolbar.locator('button').all()) {
		const box = (await tool.boundingBox())!;
		const bar = (await toolbar.boundingBox())!;
		expect(box.x + box.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
	}
	// A tablet is used in landscape (Trevor, 2026-11-01): the words at full size, with the
	// mode's title, still all on the bar.
	const portrait = page.viewportSize()!;
	if (testInfo.project.name === 'tablet') {
		await page.setViewportSize({ width: portrait.height, height: portrait.width });
		await expect(toolbar.getByText('Seating', { exact: true })).toBeVisible();
		await expect(words).toBeVisible();
		expect(await toolbar.evaluate((bar) => bar.scrollWidth <= bar.clientWidth)).toBe(true);
		await page.screenshot({ path: 'test-results/seating-top-bar-landscape.png' });
		await page.setViewportSize(portrait);
	}

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

	// Dropped in a space, Ana's seat moves there on every grim, keeping its place in the order.
	const town = (await phone.getByTestId('player-grim').boundingBox())!;
	const spot = { x: town.x + town.width * 0.5, y: town.y + town.height * 0.45 };
	await dragTo(spot);
	await expect(target).toHaveCount(0);
	await expect(line).toHaveText('Move your seat here');
	await phone.mouse.up();
	await expect
		.poll(async () => {
			const at = await centre(seats.nth(1));
			return Math.hypot(at.x - spot.x, at.y - spot.y);
		})
		.toBeLessThan(town.width * 0.05);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /^Seat 2: Ana/);

	// Onto an open seat, the two swap, places and all: the chair Ana left is the empty one.
	await dragTo(await centre(seats.nth(4)));
	await expect(target).toHaveAttribute('data-seat', '5');
	await expect(line).toHaveText('Sit in Seat 5');
	await phone.mouse.up();
	await expect(seats.nth(4)).toHaveAttribute('aria-label', /^Seat 5: Ana/);
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /^Seat 3: Eve/);
	await expect(page.getByRole('button', { name: /^Seat 5: Ana/ })).toBeVisible();
	await expect
		.poll(async () => {
			const at = await centre(seats.nth(1));
			return Math.hypot(at.x - spot.x, at.y - spot.y);
		})
		.toBeLessThan(town.width * 0.05);

	// The switch off: no more dragging. Done leaves Seating with seating locked.
	await phones.tap();
	await expect(phones).toHaveAttribute('aria-pressed', 'false');
	await expect(line).toHaveCount(0);
	await phones.tap();
	await expect(line).toHaveText('Seating is open');
	await leaveSeating(page);
	await expect(line).toHaveCount(0);
	// Locked, a phone with no seat taps an open one to sit there.
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

test('Character selection opens Seating, and Done comes back to it', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/setup$/);
	const setup = page.url();
	await page.getByRole('button', { name: 'Seating' }).tap();
	await expect(page.getByRole('toolbar', { name: 'Grimoire' })).toContainText('Seating');
	// No room open: the room's parts stay in place, disabled.
	const bar = page.getByRole('toolbar', { name: 'Grimoire' });
	await expect(bar.getByRole('button', { name: 'Open seating' })).toBeDisabled();
	await expect(bar.getByRole('button', { name: 'Count off' })).toBeDisabled();
	// Add seat is there too: it places a seat, then comes back to Seating (Trevor, 2026-11-01).
	const seats = page.getByRole('button', { name: /^Seat \d+/ });
	const before = await seats.count();
	await bar.getByRole('button', { name: 'Add seat' }).tap();
	await expect(bar).toContainText('Add a seat');
	await page
		.getByRole('button', { name: /^Place between/ })
		.first()
		.tap();
	await notATraveller(page);
	await expect(bar.getByRole('button', { name: 'Open seating' })).toBeVisible();
	await expect(seats).toHaveCount(before + 1);
	await leaveSeating(page);
	await expect(page).toHaveURL(setup);
});

test('the seat the room gives a phone has a ring on its Grim, with no way to mark another', async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-27): a steady ring on the player's own seat. Players are seated by the
	// room now, so the seat sheet's "This is me" is gone (Trevor, 2026-10-31).
	const code = await openRoom(page);
	await nameSeat(page, 2, 'Ana');
	const phone = await joinAs(browser, testInfo, code, 'Ana');
	const seat = phone.getByTestId('grim-seat').nth(1);
	await expect(seat).toHaveAttribute('data-mine');
	await expect(phone.locator('[data-testid="grim-seat"][data-mine]')).toHaveCount(1);
	await expect(seat).toHaveAttribute('aria-label', /, you$/);
	const disc = seat.locator('.disc');
	await expect(disc).toHaveCSS('outline-style', 'solid');
	await expect(disc).toHaveCSS('animation-name', 'none');
	await phone.getByTestId('grim-seat').nth(2).tap();
	const sheet = phone.getByRole('dialog', { name: /^Seat 3/ });
	await expect(sheet.getByTestId('seat-note')).toBeVisible();
	await expect(sheet.getByText('This is me', { exact: true })).toHaveCount(0);
	await phone.context().close();
});

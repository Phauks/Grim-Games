import { expect, test, type Page } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { pickScript } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// A player's phone learns its own character and no one else's (Trevor, 2026-11-06: "I went to
// player view and view character. I could see everyone's. Is this just storyteller?"). Only the
// Storyteller's player view lists every seat; a phone gets its own seat's role from the room
// (room-roles.ts `memberRole`) and nothing that names another seat's character.

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

/** Every `characterId` in a message, with the path that holds it. */
function characterIds(value: unknown, path = ''): { path: string; id: unknown }[] {
	if (typeof value !== 'object' || value === null) return [];
	return Object.entries(value).flatMap(([key, inner]) => [
		...(key === 'characterId' ? [{ path: `${path}.${key}`, id: inner }] : []),
		...characterIds(inner, `${path}.${key}`)
	]);
}

test('a player’s phone is sent and shown its own character only', async ({
	page,
	browser
}, testInfo) => {
	test.slow();
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

	// The player's phone, with every message the room sends it kept.
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	const received: unknown[] = [];
	phone.on('websocket', (ws) =>
		ws.on('framereceived', ({ payload }) => {
			try {
				received.push(JSON.parse(String(payload)));
			} catch {
				// Not JSON (a ping): nothing about characters.
			}
		})
	);
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await nameSeat(page, board, 2, 'Alex');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '2');

	// Deal, with players allowed to see their characters.
	await page.goto(`${board}/draw`);
	await page.getByRole('button', { name: 'Deal' }).tap();
	const deal = page.getByRole('alertdialog', { name: 'Deal at random?' });
	await deal.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);
	await page.goto(board);

	// The phone opens its own card straight away: no list of seats to pick from.
	await expect(phone.getByTestId('your-character')).toBeVisible();
	await phone.getByTestId('your-character').tap();
	await expect(phone.getByTestId('role-seats')).toHaveCount(0);
	const card = phone.getByRole('dialog', { name: 'Your character' });
	const hold = card.getByTestId('role-hold');
	await hold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
	await expect(card.getByTestId('role-name')).toHaveText(/Washerwoman|Empath|Monk|Poisoner|Imp/);
	const own = (await card.getByTestId('role-name').textContent())!.trim();
	await hold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
	await phone.keyboard.press('Escape');

	// The Storyteller's player view, by design, picks any seat (Trevor, 2026-10-30).
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	await page.getByTestId('script-scroll').getByTestId('your-character').tap();
	await expect(page.getByTestId('role-seats').getByRole('button')).toHaveCount(5);
	await page.keyboard.press('Escape');

	// What the room sent the phone: one role, its own seat's, and no other character anywhere.
	const ownId = own.toLowerCase();
	const ids = received.flatMap((m) => characterIds(m));
	expect(ids.length).toBeGreaterThan(0);
	for (const { path, id } of ids) {
		expect(path, `characterId at ${path}`).toBe('.role.characterId');
		expect(id).toBe(ownId);
	}
	for (const message of received) {
		const m = message as { type?: string };
		expect(m.type, 'the phone gets no shared grimoire').not.toBe('grimoire');
		expect(Object.keys(message as object), 'no roles table').not.toContain('roles');
	}

	await phoneContext.close();
});

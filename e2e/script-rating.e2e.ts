import { expect, test } from '@playwright/test';
import { signIn } from './admin.ts';
import { nameStoryteller, toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';
import { paneButton } from './players.ts';

// Public script ratings (Trevor, 2026-11-16, look B): a seated player's rating of a game told by
// a signed-in Storyteller adds to the script's public rating, which the script's details show
// as a Rating row; tapping it opens a sheet with the accolades given.

const part = () => Math.floor(Math.random() * 254) + 1;
const ip = () => `10.${part()}.${part()}.${part()}`;

test("a seated player's rating shows in the script's details for anyone", async ({
	page,
	browser
}, testInfo) => {
	test.slow();
	await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip() });
	await signIn(page, `rating-${Date.now()}-${part()}@example.com`);
	// A script of its own, so other tests' games don't count towards it.
	const name = `Rated ${Date.now()}-${part()}`;

	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'rated.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ id: '_meta', name, author: 'Tester' },
				'washerwoman',
				'empath',
				'monk',
				'chef',
				'poisoner',
				'imp'
			])
		)
	});
	const details = page.getByTestId('script-details');
	await expect(page.getByTestId('script-details-name')).toHaveText(name);
	await expect(details.getByTestId('script-rating')).toHaveText('None');
	await details.getByRole('button', { name: 'Play', exact: true }).tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await nameStoryteller(page, 'Trevor');
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	// A phone joins and the Storyteller seats it.
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await page.goto(board);
	await page.getByRole('button', { name: /^Seat 2:/ }).tap();
	const seat = page.locator('[data-scope="drawer"][data-part="content"]');
	await seat.getByRole('button', { name: 'Edit player name' }).tap();
	await seat.getByRole('textbox', { name: 'Player name' }).fill('Alex');
	await seat.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(phone.getByTestId('player-status-row')).toHaveAttribute('data-seat', '2');

	await paneButton(page, 'Session', 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();

	await phone.getByRole('button', { name: /Rate this game/ }).tap();
	const sheet = phone.getByRole('dialog', { name: 'Game over' });
	await sheet.getByRole('button', { name: 'Star 4' }).tap();
	await sheet.getByRole('button', { name: /Great pacing/ }).tap();
	await sheet.getByRole('textbox', { name: 'Comment' }).fill('Only for the Storyteller.');
	await sheet.getByRole('button', { name: 'Send' }).tap();
	await expect(sheet).toHaveCount(0);
	await phoneContext.close();

	// The room adds it as the feedback arrives.
	await expect
		.poll(() =>
			page.evaluate(
				async ([name]) => {
					const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
					const bytes = new TextEncoder().encode(`${norm(name)}\n${norm('Tester')}`);
					const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
						.map((b) => b.toString(16).padStart(2, '0'))
						.join('');
					const response = await fetch(`/api/script-rating/${hash}`, { cache: 'no-store' });
					return ((await response.json()) as { ratings: number }).ratings;
				},
				[name]
			)
		)
		.toBe(1);

	// Anyone, signed in or not, sees it in the script's details.
	const otherContext = await browser.newContext({ ...testInfo.project.use });
	const other = await otherContext.newPage();
	await other.goto('/library');
	await other.getByLabel('Script file').setInputFiles({
		name: 'rated.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify([{ id: '_meta', name, author: 'Tester' }, 'chef', 'imp']))
	});
	const rating = other.getByTestId('script-details').getByTestId('script-rating');
	await expect(rating).toHaveText('4 of 5 from 1 rated');
	await rating.getByRole('button').tap();
	const ratings = other.getByTestId('script-rating-sheet');
	await expect(ratings).toContainText('Great pacing × 1');
	await expect(ratings).not.toContainText('Only for the Storyteller.');
	await otherContext.close();
});

import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Trevor's playtest notes (2026-10-26): "Hide grim guesses, eyeball feature like we use in
// notes", and "Grim cover, no info at all. Accessible from day or grim view."

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	return new URL(page.url()).pathname;
}

/** Expects the blank cover over everything, then takes it away with its ✕. */
async function coverAndUncover(page: Page) {
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await expect(cover).toBeVisible();
	// Nothing on it but the close button.
	await expect(cover).toHaveText('');
	await expect(cover.getByRole('button')).toHaveCount(1);
	// A stray tap on the cover keeps it.
	await cover.tap({ position: { x: 20, y: 200 } });
	await expect(cover).toBeVisible();
	await cover.getByRole('button', { name: 'Close' }).tap();
	await expect(cover).toBeHidden();
}

test('a player hides their guesses and notes on the Grim tab, and covers the screen', async ({
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
	await sheet.getByTestId('seat-note').tap();
	const editor = phone.getByRole('dialog', { name: 'Note: Seat 2' });
	await editor.getByTestId('note-editor').fill('Claims Empath');
	await editor.getByRole('button', { name: 'Close' }).tap();
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

	// The cover, beside the eye.
	await phone.getByTestId('cover-button').tap();
	await coverAndUncover(phone);
	await expect(seats).toHaveCount(8);
	await phoneContext.close();
});

test("the Storyteller covers the screen from the board's ⋯ menu and from the day", async ({
	page
}) => {
	await startGame(page);

	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('button', { name: 'Cover the screen' }).tap();
	await coverAndUncover(page);
	await expect(page.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();

	// From the day, which stays open under it.
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^Day( \d+)?$/ });
	await expect(day).toBeVisible();
	await day.getByTestId('cover-button').tap();
	await coverAndUncover(page);
	await expect(day).toBeVisible();
});

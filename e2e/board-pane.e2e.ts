import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';
import { closePane, storytellerPane } from './players.ts';

// The Storyteller's Game notes and Players beside the board (plan M86, Trevor 2026-11-15: "I
// really like seeing the notes right next to the game grim"; "we should show on a player icon
// when there is a message they have sent that they want us to see").

async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("a seated player's message marks their seat, and the mark opens them in Players", async ({
	page,
	browser
}, testInfo) => {
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
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page.getByTestId('cover-button')).toBeVisible();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	// Naming a seat with the phone's name seats it.
	await nameSeat(page, 3, 'Alex');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '3');

	const seat = page.getByTestId('seat').nth(2);
	await expect(seat.getByTestId('note-mark')).toHaveCount(0);

	// Alex asks to talk.
	await phone.getByTestId('message-button').tap();
	const sheet = phone.getByRole('dialog', { name: 'Message the Storyteller' });
	await sheet.getByRole('textbox', { name: 'Message' }).fill('Can we talk about my info?');
	await sheet.getByText('Request a Storyteller consult', { exact: true }).tap();
	await sheet.getByRole('button', { name: 'Send' }).tap();
	await expect(sheet).toBeHidden();

	// The seat's note mark, lower right (the one free place on the rim), shows the messages
	// icon in the accent colour for a consult.
	const mark = seat.getByTestId('note-mark');
	await expect(mark).toHaveAttribute('data-messages', 'urgent');
	await expect(mark).toHaveAttribute('title', 'New message');
	await expect(page.getByRole('button', { name: /^Seat 3: Alex.*new message/ })).toBeVisible();
	await page.screenshot({ path: `test-results/board-pane-mark-${testInfo.project.name}.png` });

	// Tapping it opens Alex in Players, in the pane.
	await mark.tap();
	const pane = storytellerPane(page);
	await expect(pane).toBeVisible();
	await expect(pane.getByRole('tab', { name: /^Players/ })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const row = pane.getByTestId('room-player').filter({ hasText: 'Alex' });
	await expect(row.getByRole('button')).toHaveAttribute('aria-current', 'true');
	const item = pane.getByTestId('room-player-sheet').getByTestId('inbox-item');
	await expect(item).toContainText('Can we talk about my info?');
	// Drawn as a note is: a line under it, the words in the notes' lighter well.
	await expect(item.locator('.preview')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await page.screenshot({ path: `test-results/board-pane-players-${testInfo.project.name}.png` });

	// Read, the mark goes, as the seat has no notes of its own.
	await item.tap();
	const opened = page.getByRole('dialog', { name: 'Message', exact: true });
	await expect(opened).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(opened).toBeHidden();
	await expect(mark).toHaveCount(0);
	await closePane(page);
	await phoneContext.close();
});

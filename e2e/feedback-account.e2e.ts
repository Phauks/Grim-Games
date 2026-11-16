import { expectInRoom } from './player-status.ts';
import { expect, test, type Page } from '@playwright/test';
import { signIn } from './admin.ts';
import { nameStoryteller, toBoard } from './new-game.ts';

// Players' feedback is kept on the Storyteller's account (Trevor, 2026-11-16: "Server should
// save because it can tie to an account or accounts"): the room writes each game's feedback
// into every signed-in Storyteller's account, and another device signed in to that account
// gets it too.

const part = () => Math.floor(Math.random() * 254) + 1;
const ip = () => `10.${part()}.${part()}.${part()}`;

/** The feedback documents on the signed-in account, as `[gameId, ratings]`. */
async function accountFeedback(page: Page): Promise<[string, number[]][]> {
	return page.evaluate(async () => {
		const { docs } = await (await fetch('/api/account/docs/feedback')).json();
		return (
			docs as {
				id: string;
				deleted: boolean;
				body?: { entries: { feedback: { rating?: number } }[] };
			}[]
		)
			.filter((doc) => !doc.deleted)
			.map((doc) => [doc.id, (doc.body?.entries ?? []).map((e) => e.feedback.rating ?? 0)]);
	});
}

test("a player's feedback reaches the Storyteller's account and their other devices", async ({
	page,
	browser
}, testInfo) => {
	test.slow();
	await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip() });
	const email = `feedback-${Date.now()}-${part()}@example.com`;
	await signIn(page, email);

	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await nameStoryteller(page, 'Trevor');
	const board = new URL(page.url()).pathname;
	const gameId = board.split('/').filter(Boolean).at(-1)!;
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expectInRoom(phone);

	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();

	await phone.getByRole('button', { name: /Rate this game/ }).tap();
	const sheet = phone.getByRole('dialog', { name: 'Game over' });
	await sheet.getByRole('button', { name: 'Star 4' }).tap();
	await sheet.getByRole('button', { name: 'Send' }).tap();
	await expect(sheet).toHaveCount(0);
	await phoneContext.close();

	// Kept on the account, one document for the game.
	await expect.poll(() => accountFeedback(page)).toEqual([[gameId, [4]]]);

	// Another device signed in to the account gets it beside the game.
	const otherContext = await browser.newContext({ ...testInfo.project.use });
	const other = await otherContext.newPage();
	await other.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip() });
	await signIn(other, email);
	await expect
		.poll(() =>
			other.evaluate(
				(key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.entries?.length ?? 0,
				`grim-games:game-feedback:${gameId}`
			)
		)
		.toBe(1);
	await otherContext.close();
});

import { expect, test, type Page } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { pickScript } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// The game result (Trevor, 2026-11-12, plan R4 option A): once a game played in a room ends,
// a seated phone's Game over sheet says "You won as" or "You lost as" its character, and Share
// result shares "I won as the [character]" with a link to the game's result page, which names
// nobody.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

test('after End game a seated phone shares its result, and the page names nobody', async ({
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

	// A phone joins and the Storyteller seats it in seat 2, then deals.
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await page.goto(board);
	await page.getByRole('button', { name: /^Seat 2:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Alex');
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '2');
	await page.goto(`${board}/draw`);
	await page.getByRole('button', { name: 'Deal' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Deal at random?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('button', { name: 'Deal' })).toBeDisabled();

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
	await expect(phone.getByTestId('join-status')).toHaveText('Game over: Good won');

	await phone.getByRole('button', { name: 'Game over', exact: true }).tap();
	const over = phone.getByRole('dialog', { name: 'Game over' });
	const line = over.getByTestId('game-result-line');
	// Good won: a good character won, an evil one lost.
	await expect(line).toHaveText(
		/^You (won as\s+(Washerwoman|Empath|Monk)|lost as\s+(Poisoner|Imp))\s*$/
	);
	const character = (await line.textContent())!.replace(/^You (won|lost) as\s*/, '').trim();
	const won = !['Poisoner', 'Imp'].includes(character);
	// The rating is still there, under the result.
	await expect(over.getByRole('button', { name: 'Star 4' })).toBeVisible();

	await over.getByRole('button', { name: 'Share result' }).tap();
	const share = phone.getByRole('dialog', { name: 'Share result' });
	const url = share.getByTestId('share-url');
	await expect(url).toHaveValue(/\/recap\/[A-Za-z0-9_-]{22}$/);
	// Copy sends the words with the link.
	await phoneContext.grantPermissions(['clipboard-read', 'clipboard-write']);
	await share.getByRole('button', { name: 'Copy link' }).tap();
	const copied = await phone.evaluate(() => navigator.clipboard.readText());
	expect(copied.split('\n')[0]).toBe(
		`I ${won ? 'won' : 'lost'} as the ${character} in Trouble Brewing.`
	);

	// The result page shows who played what, and no names.
	await phone.goto(new URL(await url.inputValue()).pathname);
	const frame = phone.frameLocator('iframe');
	await expect(frame.getByText('Good won')).toBeVisible();
	await expect(frame.locator('body')).toContainText(character);
	await expect(frame.locator('body')).not.toContainText('Alex');
	await phoneContext.close();
});

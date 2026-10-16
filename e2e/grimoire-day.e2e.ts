import { expect, test, type Page } from '@playwright/test';

// The day screen on a saved game (/grimoire/<id>/day): nominations, executions, exiles and
// deaths, all by hand, with the cause picker offering only valid causes.

async function startGame(page: Page) {
	await page.goto('/');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	return new URL(page.url()).pathname;
}

async function addThief(page: Page) {
	await page.getByRole('button', { name: 'More' }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Traveller' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Add a Traveller' })
		.getByRole('button', { name: 'Thief', exact: true })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toBeAttached();
}

const seat = (page: Page, name: string) => page.getByRole('button', { name: `Seat: ${name}` });

test('the day screen logs a nomination and execution, survives a reload and shows votes needed', async ({
	page
}) => {
	const board = await startGame(page);
	await page.goto(`${board}/day`);
	await expect(page.getByRole('heading', { name: 'Day', exact: true })).toBeVisible();

	await seat(page, 'Seat 1').tap();
	await seat(page, 'Seat 2').tap();
	const log = page.getByTestId('day-log');
	await expect(log).toContainText('Seat 1 nominated Seat 2');
	await log.getByRole('button', { name: 'Execute Seat 2' }).tap();
	await expect(log).toContainText('Seat 2 executed');
	await expect(seat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');

	await page.reload();
	await expect(page.getByTestId('day-log')).toContainText('Seat 2 executed');

	// No Undo or History here: History is in the grimoire's menu.
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0);
	// 7 of 8 alive: 4 votes put a player on the block.
	await expect(page.getByTestId('votes-needed')).toContainText(
		'4 votes to put a player on the block (7 alive)'
	);
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page).toHaveURL(new RegExp(`${board}$`));
	await expect(
		page.getByRole('button', { name: /^Seat 2: no name, no character, dead/ })
	).toBeAttached();
});

test('a Traveller is exiled, and a death offers only valid causes', async ({ page }) => {
	const board = await startGame(page);
	await addThief(page);
	await page.goto(`${board}/day`);

	await seat(page, 'Seat 1').tap();
	await seat(page, 'Seat 9').tap();
	const log = page.getByTestId('day-log');
	await log.getByRole('button', { name: 'Exile Seat 9' }).tap();
	await expect(log).toContainText('Seat 9 exiled');

	// Marking a death by hand: no characters are in play, so no character is offered.
	await page.getByRole('radiogroup', { name: 'Tapping a player' }).getByText('Dead').tap();
	await seat(page, 'Seat 3').tap();
	const causes = page.getByRole('dialog', { name: 'How did Seat 3 die?' });
	await expect(causes.getByRole('button')).toHaveText(['Executed', 'Killed by the Demon', 'Skip']);
	await causes.getByRole('button', { name: 'Killed by the Demon' }).tap();
	await expect(causes).toBeHidden();
	await expect(seat(page, 'Seat 3')).toHaveAttribute('data-dead', 'true');
	// 7 of 9 alive (the Thief exiled, Seat 3 dead): 4 votes.
	await expect(page.getByTestId('votes-needed')).toContainText('(7 alive)');
});

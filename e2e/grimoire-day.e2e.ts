import { expect, test, type Page } from '@playwright/test';

// The day screen on a saved game (/grimoire/<id>/day): executions, exiles and deaths, all
// by hand, each with a cause from the valid ones. Nominations happen off the grimoire.

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
		.getByRole('button', { name: 'Thief, Recommended', exact: true })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();
	await expect(page.getByRole('button', { name: /^Seat 9: no name, Thief/ })).toBeAttached();
}

const seat = (page: Page, name: string) => page.getByRole('button', { name: `Seat: ${name}` });

test('the day screen marks an execution, survives a reload and shows votes needed', async ({
	page
}) => {
	const board = await startGame(page);
	await page.goto(`${board}/day`);
	await expect(page.getByRole('heading', { name: 'Day', exact: true })).toBeVisible();

	// No nomination tracking, log, Undo or History here (Trevor, 2026-10-16).
	await expect(page.getByRole('radiogroup', { name: 'Tapping a player' })).toHaveCount(0);
	await expect(page.getByTestId('day-log')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0);

	// Tapping a player asks how they died, stating their state now and after.
	await seat(page, 'Seat 2').tap();
	const sheet = page.getByRole('dialog', { name: 'How did Seat 2 die?' });
	await expect(sheet).toContainText('Now: alive. After: dead, by the cause you tap.');
	await expect(sheet.getByRole('button', { name: 'Dead, no cause' })).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Executed' }).tap();
	await expect(sheet).toBeHidden();
	await expect(seat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');

	await page.reload();
	await expect(seat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');
	// 7 of 8 alive: 4 votes put a player on the block.
	await expect(page.getByTestId('votes-needed')).toContainText(
		'4 votes to put a player on the block (7 alive)'
	);

	// A dead player can be marked alive again.
	await seat(page, 'Seat 2').tap();
	const revive = page.getByRole('dialog', { name: 'Mark Seat 2 alive?' });
	await expect(revive).toContainText('Now: dead. After: alive.');
	await revive.getByRole('button', { name: 'Cancel' }).tap();
	await expect(revive).toBeHidden();

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

	await seat(page, 'Seat 9').tap();
	const thief = page.getByRole('dialog', { name: 'How did Seat 9 die?' });
	await expect(thief.getByRole('button')).toHaveText(['Exiled', 'Killed by the Demon', 'Cancel']);
	await thief.getByRole('button', { name: 'Exiled' }).tap();
	await expect(seat(page, 'Seat 9')).toHaveAttribute('data-dead', 'true');

	// No characters are in play, so no character is offered; Cancel is set apart.
	await seat(page, 'Seat 3').tap();
	const causes = page.getByRole('dialog', { name: 'How did Seat 3 die?' });
	await expect(causes.getByRole('button')).toHaveText([
		'Executed',
		'Killed by the Demon',
		'Cancel'
	]);
	await causes.getByRole('button', { name: 'Killed by the Demon' }).tap();
	await expect(causes).toBeHidden();
	await expect(seat(page, 'Seat 3')).toHaveAttribute('data-dead', 'true');
	// 7 of 9 alive (the Thief exiled, Seat 3 dead): 4 votes.
	await expect(page.getByTestId('votes-needed')).toContainText('(7 alive)');
});

import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { boardSeat, inHand, putReminder } from './reminder-bank.ts';

/** The Goal token beside seat 2 on the board, not the bank's. */
const placedGoal = (page: Page) =>
	page.locator('.chip-slot[data-seat="2"] [data-testid="board-reminder"]').first();

// https://wiki.bloodontheclocktower.com/Zenomancer: the Storyteller gives players goals and
// picks each one. The goal is typed on that player's Goal reminder and shown to them on a
// "Your goal is" card (Trevor, 2026-10-31).
test('a Goal reminder keeps the goal typed on it and shows it to the player', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);

	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Fabled or Loric', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Zenomancer', exact: true })
		.tap();
	await putReminder(page, 'Goal', 2);
	await expect(boardSeat(page, 2)).toHaveAttribute('aria-label', /1 reminder/);

	// Tapping the placed token holds it; its About has the goal field and Show to player.
	await placedGoal(page).tap();
	await expect(inHand(page)).toBeVisible();
	await inHand(page).getByRole('button', { name: 'About this reminder' }).tap();
	const about = page.getByRole('dialog', { name: 'Goal' });
	const show = about.getByRole('button', { name: 'Show to player' });
	await expect(show).toBeDisabled();
	const goal = about.getByRole('textbox', { name: 'Goal' });
	await goal.fill('Get the Chef executed');
	await goal.press('Enter');
	await show.tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown).toContainText('Your goal is');
	await expect(shown).toContainText('Get the Chef executed');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toHaveCount(0);

	// Kept on the token: opening it again shows the same goal.
	await about.getByRole('button', { name: 'Close' }).tap();
	await expect(about).toBeHidden();
	if (await inHand(page).isVisible()) await page.keyboard.press('Escape');
	await placedGoal(page).tap();
	await inHand(page).getByRole('button', { name: 'About this reminder' }).tap();
	await expect(about.getByRole('textbox', { name: 'Goal' })).toHaveValue('Get the Chef executed');
});

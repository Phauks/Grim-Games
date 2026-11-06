import { expect, type Page } from '@playwright/test';

/**
 * Answers the day's Execution, already asked: on the board's bar (Trevor, 2026-11-06: the
 * executed player is tapped on the board, then confirmed), or on the Execution sheet, which
 * asks instead before Start game, with the Atheist on the script, and when executing the player
 * has more to decide. `choice` is No execution, the Storyteller (the Atheist), or a seat by its
 * label, such as "Seat 3".
 */
export async function chooseExecution(page: Page, choice = 'No execution'): Promise<void> {
	const bar = page.getByTestId('execution-pick');
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(bar.or(ask)).toBeVisible();
	const seat = /^Seat \d+$/.test(choice);
	if (await bar.isVisible()) {
		if (seat) await page.locator(`[data-testid="seat"][aria-label^="${choice}:"]`).tap();
		else await bar.getByRole('button', { name: choice, exact: true }).tap();
		// The bank's own button is Confirm while the bar shows.
		const confirm = page
			.locator('[data-tray]')
			.getByRole('button', { name: 'Confirm', exact: true });
		await expect(confirm.and(page.locator(':enabled')).or(ask)).toBeVisible();
		if (await bar.isVisible()) {
			await confirm.tap();
			await expect(bar).toBeHidden();
			return;
		}
	}
	const field = ask.getByRole('combobox', { name: 'Execution' });
	if (!seat || !(await field.textContent())?.includes(choice)) {
		await field.tap();
		await page
			.getByRole('option', {
				name: seat ? new RegExp(`\\b${choice}(\\s|$)`) : choice,
				exact: !seat
			})
			.tap();
	}
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

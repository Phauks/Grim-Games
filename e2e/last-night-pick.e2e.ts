import { expect, test } from '@playwright/test';
import { nightStep } from './night-step.ts';
import { choose, openStep, poison, startGame, toNightTwo } from './night-two.ts';

/**
 * A night step shows where its token was last night, small, above tonight's row, with a small
 * button that puts it there again; nothing is placed by itself (M89, Trevor 2026-11-19).
 */
test("the Poisoner's step shows last night's pick and places it again on a tap", async ({
	page
}) => {
	await startGame(page);
	await choose(page, 1, 'Fortune Teller');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Chef');
	await choose(page, 5, 'Empath');
	await poison(page, 5);
	await toNightTwo(page, 'Seat 4');
	let step = await openStep(page, 'Poisoner');
	const lastLine = () => nightStep(page, 'Poisoner').getByTestId('last-placed');
	await expect(lastLine()).toContainText('Seat 5');
	// Named by the night it was placed, not an icon (Trevor, 2026-11-19).
	await expect(lastLine()).toContainText('Night 1');
	// Tapped, that token's history this game.
	await lastLine().getByRole('button', { name: 'Poisoned history: Night 1' }).tap();
	const history = page.getByRole('dialog', { name: 'Poisoned history' });
	await expect(history.getByTestId('token-history').getByRole('listitem')).toHaveCount(1);
	await expect(history.getByTestId('token-history')).toContainText('Night 1');
	await expect(history.getByTestId('token-history')).toContainText('Seat 5');
	await page.screenshot({
		path: `test-results/last-night-history-${test.info().project.name}.png`
	});
	await page.keyboard.press('Escape');
	await expect(history).toBeHidden();
	// Last night's token still on until Dusk: off it comes, as Dusk would take it.
	const back = step.getByRole('button', { name: 'Return Poisoned to the reminder bank' });
	if (await back.isEnabled()) {
		await back.tap();
		const ask = page.getByRole('alertdialog');
		if (await ask.isVisible({ timeout: 1000 }).catch(() => false))
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	}
	if (!(await nightStep(page, 'Poisoner').isVisible())) step = await openStep(page, 'Poisoner');
	// Never filled in by itself.
	await expect(step.getByRole('button', { name: 'Place', exact: true })).toHaveText('Not placed');
	const again = step.getByRole('button', { name: 'Place Poisoned on Seat 5 again' });
	// Above the row, small, with a tap area of the full height.
	const lineBox = (await lastLine().boundingBox())!;
	const rowBox = (await step.getByRole('button', { name: 'Place', exact: true }).boundingBox())!;
	expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(rowBox.y + 1);
	expect((await again.boundingBox())!.height).toBeLessThan(rowBox.height);
	await page.screenshot({ path: `test-results/last-night-pick-${test.info().project.name}.png` });
	await again.tap();
	if (!(await nightStep(page, 'Poisoner').isVisible())) step = await openStep(page, 'Poisoner');
	await expect(step.getByRole('button', { name: 'Move', exact: true })).toContainText('Seat 5');
	// Already there: nothing more to do.
	await expect(again).toBeDisabled();
	await page.screenshot({
		path: `test-results/last-night-pick-again-${test.info().project.name}.png`
	});
});

import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Bounty Hunter's "[1 Townsfolk is evil]" (M22,
 * https://wiki.bloodontheclocktower.com/Bounty_Hunter): Start game warns while no Townsfolk
 * is evil, and the first night opens with Starting alignment, which picks one and shows them
 * that they are evil (players know their own alignment,
 * https://wiki.bloodontheclocktower.com/Glossary). Warn, never lock.
 */

async function newBoard(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function choose(page: Page, number: number, name: string, offScript = false) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test('the Bounty Hunter asks for an evil Townsfolk and tells them', async ({ page }) => {
	await newBoard(page);
	await choose(page, 1, 'Bounty Hunter', true);
	await choose(page, 2, 'Chef');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Poisoner');

	// Start game warns: no Townsfolk is evil yet. Confirm starts anyway.
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(ask.getByTestId('alignments-left')).toContainText('1 Townsfolk is evil');
	await page.screenshot({
		path: `test-results/bounty-hunter-start-${test.info().project.name}.png`
	});
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// The first night: Starting alignment, right after Dusk.
	const strip = page.getByTestId('night-strip');
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 5 && (await name.textContent()) !== 'Starting alignment'; i++)
		await next.tap();
	await expect(name).toHaveText('Starting alignment');
	await strip.locator('button.step').tap();
	const step = page.getByRole('dialog', { name: 'Starting alignment' });
	const tasks = step.getByTestId('setup-alignment');
	await expect(tasks).toContainText('None');

	await tasks.getByRole('button', { name: 'Choose', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Make evil' }).getByRole('button', { name: /Chef/ }).tap();
	await expect(tasks.locator('[data-character-id="chef"]').first()).toBeVisible();
	await expect(tasks).not.toContainText('None');
	await page.screenshot({
		path: `test-results/bounty-hunter-step-${test.info().project.name}.png`
	});

	await tasks.getByRole('button', { name: 'Show to player' }).tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toContainText('You are');
});

import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { nightStep, openWalkStep, walkThrough } from './night-step.ts';
import { putReminder } from './reminder-bank.ts';

// Trevor (2026-11-19): the Valid Information eyes in a night step were not at its right edge.
// Every row's Show to player eye ends where the step's lines end: a marked row (the
// Washerwoman's, its reminders on the board) and the Fortune Teller's Yes or No too.

async function setCharacter(page: Page, seat: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${seat}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${seat}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function pickPlayer(
	page: Page,
	section: ReturnType<Page['locator']>,
	label: string,
	seat: string
) {
	const select = section.getByRole('combobox', { name: label });
	await select.scrollIntoViewIfNeeded();
	const option = page.getByRole('option', { name: new RegExp(`${seat}$`) });
	await expect(async () => {
		if (!(await option.isVisible())) await select.tap();
		await expect(option).toBeVisible({ timeout: 1000 });
	}).toPass();
	await option.tap();
}

/** The right edge of each Valid Information eye in the step, and of the step's lines. */
async function edges(step: ReturnType<typeof nightStep>) {
	const eyes = await step
		.locator('[data-eye-rows] > li > .icon-button[data-outlined]')
		.evaluateAll((els) =>
			// Only those on screen: the other valid rows fold beneath a marked one.
			els
				.map((e) => e.getBoundingClientRect())
				.flatMap((r) => (r.width ? [Math.round(r.right)] : []))
		);
	const line = await step
		.locator('.step-line')
		.first()
		.evaluate((e) => Math.round(e.getBoundingClientRect().right));
	return { eyes, line };
}

test('every Valid Information eye is at the night step’s right edge', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const cast = ['Washerwoman', 'Imp', 'Chef', 'Empath', 'Fortune Teller'];
	for (const [i, name] of cast.entries()) await setCharacter(page, i + 1, name);
	// The Washerwoman's reminders mark one row, drawn with the marked edge.
	await putReminder(page, 'Townsfolk', 3);
	await putReminder(page, 'Wrong', 4);

	const strip = walkThrough(page);
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: /^(Start game|Run Night Order)$/ })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const name = strip.locator('[data-walk-name]');
	const next = strip.getByRole('button', { name: 'Next step' });

	for (const title of ['Washerwoman', 'Fortune Teller']) {
		for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) await next.tap();
		await expect(name).toHaveText(title);
		await openWalkStep(page);
		const step = nightStep(page, title);
		await expect(step).toBeVisible();
		if (title === 'Washerwoman') await expect(step.locator('li[data-marked]')).toHaveCount(1);
		if (title === 'Fortune Teller') {
			const section = step.getByTestId('night-yes-no');
			await pickPlayer(page, section, 'First player chosen', 'Seat 2');
			await pickPlayer(page, section, 'Second player chosen', 'Seat 3');
			await expect(section.getByRole('button', { name: 'Show to player' })).toHaveCount(1);
		}
		const { eyes, line } = await edges(step);
		expect(eyes.length).toBeGreaterThan(0);
		for (const right of eyes) expect(right).toBe(line);
		await page.screenshot({
			path: `test-results/valid-info-eyes-${title.replace(' ', '-')}-${test.info().project.name}.png`
		});
		if (await page.getByRole('dialog', { name: 'Game' }).isVisible())
			await page.keyboard.press('Escape');
	}
});

import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Players who swap or move seats (the Matron) take their own reminders with them, but the
// Tea Lady's Cannot Die marks whoever sits next to her now, so it moves to her new
// neighbour (https://wiki.bloodontheclocktower.com/Matron,
// https://wiki.bloodontheclocktower.com/Tea_Lady).

const seatLabelled = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

async function addCannotDie(page: Page, seat: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${seat}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: `Reminders for Seat ${seat}` });
	await picker
		.getByRole('group', { name: 'Tea Lady' })
		.getByRole('button', { name: 'Cannot Die' })
		.first()
		.tap();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("the Tea Lady's Cannot Die moves to her new neighbour when players move", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Tea Lady', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	const count = await page.getByTestId('seat').count();
	await addCannotDie(page, 2);
	await addCannotDie(page, count);

	// The seats have no characters yet, so each token placed says so; those notes leave.
	await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0, { timeout: 15000 });

	// Seat 4's player takes seat 2's place, beside the Tea Lady.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Arrange seats', exact: true })
		.tap();
	const centre = async (n: number) => {
		const box = (await page
			.getByRole('button', { name: new RegExp(`^Seat ${n}:`) })
			.boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};
	// Under load the first press can land before the seats take drags: drag until it moves.
	await expect(async () => {
		const from = await centre(4);
		const to = await centre(2);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
		await page.mouse.move(to.x, to.y, { steps: 4 });
		await page.mouse.up();
		await expect(seatLabelled(page, 'Seat 2: Seat 4')).toBeAttached({ timeout: 1000 });
	}).toPass();
	await page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button', { name: 'Done' }).tap();

	await expect(
		page.getByText('Tea Lady’s Cannot Die moved from Seat 2 to Seat 4, the new neighbour.')
	).toBeVisible();
	const cannotDie = (seat: number) =>
		page.locator(`.chip-slot[data-seat="${seat}"]`).getByRole('button', {
			name: 'Cannot Die reminder'
		});
	// On the player now in seat 2, and off the one who moved along to seat 3.
	await expect(cannotDie(2)).toHaveCount(1);
	await expect(cannotDie(3)).toHaveCount(0);
	await expect(cannotDie(count)).toHaveCount(1);
});

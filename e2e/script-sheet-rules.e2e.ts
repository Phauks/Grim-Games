import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// The game mode and special rules sit under Jinxes on every copy of the script (Trevor,
// 2026-10-24): New game's preview, the board's Script sheet and the players' phones. Stowed
// Away's text is its author's rule (https://beardytas.com/garden-of-djinn/stowed-away/).
const STOWED_AWAY = 'Up to 2 recommended travellers might be in the bag';

const section = (scope: Page | ReturnType<Page['getByRole']>) =>
	scope.getByRole('button', { name: /^Game mode and special rules/ });

async function startWithStowedAway(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	const preview = page.getByTestId('script-preview');
	// Standard with no rules lists none, and has no section for them.
	await expect(preview.getByRole('button', { name: 'Jinxes' })).toBeVisible();
	await expect(section(preview)).toHaveCount(0);
	await page.getByRole('button', { name: /^Special rules/ }).tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await rules.getByTestId('special-rules').getByText('Stowed Away', { exact: true }).tap();
	await rules.getByRole('button', { name: 'Close' }).tap();
	await expect(rules).toBeHidden();
	await expect(preview.getByTestId('sheet-rule')).toHaveCount(1);
	await expect(preview.getByTestId('sheet-rule')).toContainText('Stowed Away');
	await expect(preview.getByTestId('sheet-rule')).toContainText(STOWED_AWAY);
	// Under Jinxes.
	const jinxes = (await preview.getByRole('button', { name: 'Jinxes' }).boundingBox())!;
	expect((await section(preview).boundingBox())!.y).toBeGreaterThan(jinxes.y);

	await page.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await toBoard(page);
}

test("the board's Script sheet lists the game's special rules under Jinxes", async ({ page }) => {
	await startWithStowedAway(page);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(section(sheet)).toHaveAttribute('aria-expanded', 'true');
	await expect(sheet.getByTestId('sheet-rule')).toContainText('Stowed Away');
	await expect(sheet.getByTestId('sheet-rule')).toContainText(STOWED_AWAY);
});

test("a phone in the room sees the game's special rules on its script", async ({
	page,
	browser
}, testInfo) => {
	await startWithStowedAway(page);
	await page.goto(`${new URL(page.url()).pathname}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const script = phone.getByRole('tabpanel', { name: 'Script' });
	await expect(script.getByTestId('sheet-rule')).toContainText('Stowed Away');
	await expect(script.getByTestId('sheet-rule')).toContainText(STOWED_AWAY);
	await phoneContext.close();
});

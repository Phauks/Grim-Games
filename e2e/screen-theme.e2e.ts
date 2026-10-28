import { expect, test, type Page } from '@playwright/test';

/** Follows an in-app link, so the app moves without loading the page again. */
async function moveTo(page: Page, path: string) {
	await page.evaluate((href) => {
		const link = document.createElement('a');
		link.href = href;
		document.body.append(link);
		link.click();
		link.remove();
	}, path);
	await expect(page).toHaveURL(new RegExp(`${path}$`));
}

// The whole player screen takes the sheet background (Trevor, 2026-10-25). Moving from one
// player screen to another inside the app kept only the script in it (Trevor, 2026-10-28:
// "sometimes the theme only affects the character area"): the old screen's cleanup ran after
// the new screen had set its colours, and took them away.
test('the sheet background stays on the whole screen after moving between player screens', async ({
	page
}) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			'grim-games:player-settings:v1',
			JSON.stringify({ sheetBackground: 'parchment' })
		)
	);
	const html = page.locator('html');
	await page.goto('/play');
	await expect(html).toHaveAttribute('data-theme', 'grimoire-parchment');

	await moveTo(page, '/town/000000');
	await expect(html).toHaveAttribute('data-theme', 'grimoire-parchment');

	// Leaving the player screens brings back the app theme.
	await moveTo(page, '/settings');
	await expect(html).toHaveAttribute('data-theme', 'grimoire');
});

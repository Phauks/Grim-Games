import { expect, test, type Page } from '@playwright/test';

// Script logos (Trevor, 2026-10-18): TPI's edition logo for the base three, the author's
// `_meta.logo` link for other scripts, faint behind the board and beside the name in Search.

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNoUFAAIgYIBQAWjgMBwmTFJwAAAABJRU5ErkJggg==',
	'base64'
);
const LOGO = 'https://logo.example/storm-front.png';

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
}

const loaded = (page: Page, selector: string) =>
	page.locator(selector).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);

test('the board shows the script logo faintly, with its switch and opacity', async ({ page }) => {
	await startGame(page);
	const logo = page.locator('.board [data-testid="script-logo"]');
	// TPI's own Trouble Brewing logo, bundled from botc-release.
	await expect(logo).toHaveAttribute('data-logo', '/data/logos/tb.webp');
	await expect.poll(() => loaded(page, '.board [data-testid="script-logo"] img')).toBe(true);
	await expect(logo).toHaveCSS('opacity', '0.3');
	// Centred on the board, inside the seat ring, and the picture stays in its box rather than
	// drawing at its own size (Trevor, 2026-10-18: "in the middle where people can appreciate it").
	const board = (await page.locator('.board').boundingBox())!;
	const box = (await logo.boundingBox())!;
	const img = (await logo.locator('img').boundingBox())!;
	expect(Math.abs(box.x + box.width / 2 - (board.x + board.width / 2))).toBeLessThan(2);
	expect(Math.abs(box.y + box.height / 2 - (board.y + board.height / 2))).toBeLessThan(2);
	expect(box.width).toBeLessThan(board.width / 2);
	expect(box.height).toBeLessThan(board.height / 2);
	expect(img).toEqual(box);
	// Taps go through it to the board.
	await expect(logo).toHaveCSS('pointer-events', 'none');

	// The board's settings, over the board (also in Settings).
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: /^Board/ })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	const opacity = dialog.getByRole('slider', { name: 'Script logo opacity' });
	await opacity.fill('0.6');
	await expect(opacity).toHaveAttribute('aria-valuetext', '60%');
	await expect(logo).toHaveCSS('opacity', '0.6');
	await dialog.getByText('Script logo', { exact: true }).tap();
	await expect(logo).toHaveCount(0);

	// Saved on this device.
	await page.reload();
	await expect(page.getByTestId('seat').first()).toBeVisible();
	await expect(logo).toHaveCount(0);
});

test("Search shows a script's own logo beside its name, and in its details", async ({ page }) => {
	// Our Worker's slimmed rows (`readSearchPage`), the logo read from each script's _meta.
	const result = (scriptId: number, name: string, logo?: string) => ({
		scriptId,
		versionId: scriptId,
		name,
		version: '1.0.0',
		author: 'Trevor',
		type: 'Full',
		score: 1,
		characters: [{ id: 'chef' }, { id: 'imp' }],
		...(logo ? { logo } : {})
	});
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 2,
				hasMore: false,
				results: [result(1, 'Storm Front', LOGO), result(2, 'No Logo Town')]
			}
		})
	);
	await page.route(LOGO, (route) => route.fulfill({ body: PNG, contentType: 'image/png' }));
	// BotC Scripts alone: the other sources aren't routed, and Search waits for every source.
	await page.addInitScript(() =>
		localStorage.setItem('grim-games:scripts:sources', JSON.stringify(['botc']))
	);
	await page.goto('/scripts');

	const row = (name: string) =>
		page.getByRole('button', { name: new RegExp(`^${name}`) }).getByTestId('script-logo');
	await expect(row('Storm Front')).toHaveAttribute('data-logo', LOGO);
	await expect(row('No Logo Town')).not.toHaveAttribute('data-logo');
	// The empty one keeps the logo's place, so the names line up.
	const width = async (name: string) => (await row(name).boundingBox())?.width;
	expect(await width('No Logo Town')).toBe(await width('Storm Front'));

	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	await expect(page.getByRole('img', { name: 'Storm Front logo' })).toBeVisible();
});

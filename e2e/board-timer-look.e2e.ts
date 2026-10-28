import { expect, test, type Locator, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// The day timer on the board has the toolbar buttons' fill and edge, solid, with nothing of
// the board's background showing through (Trevor, 2026-10-23). Checked on the drawn screen.

type Rgb = [number, number, number];

/** The drawn colour at CSS point (x, y) of a full-page screenshot. */
async function pixels(page: Page, points: [number, number][]): Promise<Rgb[]> {
	const png = (await page.screenshot()).toString('base64');
	return page.evaluate(
		async ({ png, points }) => {
			const img = new Image();
			img.src = `data:image/png;base64,${png}`;
			await img.decode();
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0);
			const scale = img.width / window.innerWidth;
			return points.map(([x, y]) => {
				const d = ctx.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1).data;
				return [d[0], d[1], d[2]] as [number, number, number];
			});
		},
		{ png, points }
	);
}

/** Inside the fill near the top, clear of the edge and of any icon or text; and on the edge. */
async function samples(el: Locator): Promise<[number, number][]> {
	const box = (await el.boundingBox())!;
	const x = box.x + box.width / 2;
	return [
		[x, box.y + box.height * 0.15],
		[x, box.y + 0.5]
	];
}

const close = (a: Rgb, b: Rgb) => a.every((v, i) => Math.abs(v - b[i]) <= 2);

test('the board timer has the same solid fill and edge as the toolbar buttons', async ({
	page
}) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	const timer = page.locator('.board-timer').getByTestId('day-timer');
	await expect(timer).toBeVisible();
	const button = page.getByRole('button', { name: 'Info tokens' });
	// Nothing hovered or pressed.
	await page.mouse.move(0, 0);

	const [buttonFill, buttonEdge, timerFill, timerEdge] = await pixels(page, [
		...(await samples(button)),
		...(await samples(timer))
	]);
	expect(close(timerFill, buttonFill), `fill ${timerFill} vs ${buttonFill}`).toBe(true);
	expect(close(timerEdge, buttonEdge), `edge ${timerEdge} vs ${buttonEdge}`).toBe(true);
	// Solid: both fills are the page surface, whatever the board's background is behind them.
	const surface = await page.evaluate(
		() => getComputedStyle(document.documentElement).backgroundColor
	);
	const [r, g, b] = surface.match(/\d+/g)!.map(Number);
	expect(close(timerFill, [r, g, b]), `fill ${timerFill} vs surface ${surface}`).toBe(true);
});

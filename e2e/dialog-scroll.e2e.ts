import { expect, test } from '@playwright/test';
import { touchDrag } from './touch.ts';

// Full-screen dialogs scroll what is under their header by themselves (component review,
// 2026-10-18): dialogs that built no scroll area of their own could not be scrolled.

test("a full-screen dialog with no scroll area of its own (Players' phones) scrolls with a finger", async ({
	page
}) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await page.getByRole('button', { name: "Players' phones" }).tap();
	const dialog = page.getByRole('dialog', { name: "Players' phones" });
	await expect(dialog.getByTestId('share-code')).toBeVisible();

	// Short enough that the room panel runs past the bottom of the dialog.
	await page.setViewportSize({ width: page.viewportSize()!.width, height: 360 });
	const close = dialog.getByRole('button', { name: 'Close', exact: true });
	const headerTop = (await close.boundingBox())!.y;
	const scroller = dialog.locator('.body');
	const overflow = () => scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
	expect(await overflow()).toBeGreaterThan(0);

	const box = (await scroller.boundingBox())!;
	const x = box.x + box.width / 2;
	await touchDrag(page, { x, y: box.y + box.height * 0.8 }, { x, y: box.y + box.height * 0.2 });
	await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	// The header stayed where it was.
	expect((await close.boundingBox())!.y).toBeCloseTo(headerTop, 0);
});

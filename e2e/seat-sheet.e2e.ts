import { expect, test, type Locator } from '@playwright/test';
import { touchDrag } from './touch.ts';

// Spike: seat bottom sheet with the Ark UI drawer (06-visuals-and-ui-kit.md §3).

async function grabber(sheet: Locator) {
	const box = await sheet.locator('[data-part="grabber"]').boundingBox();
	if (!box) throw new Error('grabber not visible');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Top edge of the sheet as a fraction of the viewport height, once it stops moving. */
async function sheetTop(sheet: Locator): Promise<number> {
	let last = -1;
	for (let i = 0; i < 40; i++) {
		const top = await sheet.evaluate((el) => el.getBoundingClientRect().top / innerHeight);
		if (Math.abs(top - last) < 0.002) return top;
		last = top;
		await sheet.page().waitForTimeout(50);
	}
	return last;
}

test.beforeEach(async ({ page }) => {
	await page.goto('/spikes/seat-sheet');
});

test('tapping a seat opens its sheet at the half snap point', async ({ page }) => {
	await page.getByRole('button', { name: 'Seat: Sam' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Sam' });
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Shroud' })).toBeVisible();
	expect(await sheetTop(sheet)).toBeCloseTo(0.5, 1);
});

test('sheet actions update the seat (UI only)', async ({ page }) => {
	await page.getByRole('button', { name: 'Seat: Alex' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Alex' });
	await sheet.getByRole('button', { name: 'Shroud' }).tap();
	await expect(sheet.getByText('Dead', { exact: true })).toBeVisible();
	await sheet.getByRole('button', { name: 'Ghost vote' }).tap();
	await expect(sheet.getByRole('button', { name: 'Vote used' })).toBeVisible();
	await sheet.getByRole('button', { name: 'poisoned' }).tap();
	await expect(sheet.getByRole('button', { name: 'Remove poisoned' })).toBeVisible();
});

test('dragging up expands the sheet and swiping down dismisses it', async ({ page }) => {
	await page.getByRole('button', { name: 'Seat: Jo' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Jo' });
	await expect(sheet).toBeVisible();
	const half = await sheetTop(sheet);

	const start = await grabber(sheet);
	const viewport = page.viewportSize()!;
	await touchDrag(page, start, { x: start.x, y: viewport.height * 0.1 });
	await expect(sheet).toHaveAttribute('data-expanded', '');
	expect(await sheetTop(sheet)).toBeLessThan(half - 0.1);

	const top = await grabber(sheet);
	await touchDrag(page, top, { x: top.x, y: viewport.height - 10 });
	await expect(sheet).toBeHidden();
	await expect(page.getByTestId('snap')).toHaveText('Sheet: closed');

	// The seat reopens straight away: seats use Pointer Events, because Chromium drops the
	// click of a tap that lands within a few hundred ms of the end of a swipe.
	await page.getByRole('button', { name: 'Seat: Jo' }).tap();
	await expect(page.getByRole('dialog', { name: 'Jo' })).toBeVisible();
});

// The header (title) is a drag handle too. Swipes that start on the scrollable body race the
// browser's own scrolling (pointercancel), so the body is not a reliable handle.
test('a quick swipe down on the sheet header dismisses it', async ({ page }) => {
	await page.getByRole('button', { name: 'Seat: Morgan' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Morgan' });
	await expect(sheet).toBeVisible();
	await sheetTop(sheet);
	const box = (await sheet.getByRole('heading', { name: 'Morgan' }).boundingBox())!;
	const from = { x: box.x + 10, y: box.y + 5 };
	const to = { x: from.x, y: page.viewportSize()!.height - 10 };
	await touchDrag(page, from, to, { steps: 5, stepDelay: 0 });
	await expect(sheet).toBeHidden();
});

test('tapping the backdrop dismisses the sheet', async ({ page }) => {
	await page.getByRole('button', { name: 'Seat: Riley' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Riley' });
	await expect(sheet).toBeVisible();
	await page.touchscreen.tap(20, 20);
	await expect(sheet).toBeHidden();
});

import { expect, test, type Locator, type Page } from '@playwright/test';
import { touchDrag } from './touch.ts';

const width = (cell: Locator) => cell.evaluate((el) => el.getBoundingClientRect().width);

async function openTable(page: Page) {
	await page.goto('/reference');
	await page.getByRole('combobox', { name: 'Show as' }).tap();
	await page.getByRole('option', { name: 'Table', exact: true }).tap();
	const table = page.getByTestId('character-table');
	await expect(table.locator('tbody tr')).toHaveCount(181);
	return table;
}

test('table columns resize by dragging their header edge, and remember it', async ({
	page
}, testInfo) => {
	test.slow();
	const table = await openTable(page);
	const handle = table.getByRole('separator', { name: 'Resize Ability' });

	if (testInfo.project.name === 'phone') {
		// Phones stack the rows: nothing to resize, and nothing scrolls sideways.
		await expect(handle).toBeHidden();
		const sideways = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
		);
		expect(sideways).toBe(false);
		return;
	}

	const header = table.locator('thead th[data-col="ability"]');
	const before = await width(header);

	// One finger drags the edge 100 pixels further out.
	await handle.evaluate((el) => el.scrollIntoView({ inline: 'center', block: 'nearest' }));
	const box = (await handle.boundingBox())!;
	const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	await touchDrag(page, from, { x: from.x + 100, y: from.y });
	// The edge follows the finger (to the nearest quarter unit).
	await expect.poll(async () => Math.abs((await width(header)) - before - 100)).toBeLessThan(5);
	const dragged = await width(header);
	// The rows follow their header.
	const cell = table.locator('tbody tr').first().locator('[data-col="ability"]');
	expect(Math.abs((await width(cell)) - dragged)).toBeLessThan(2);

	// Remembered on this device.
	await page.reload();
	const again = await openTable(page);
	const kept = again.locator('thead th[data-col="ability"]');
	await expect.poll(() => width(kept)).toBeCloseTo(dragged, 0);

	// Arrow keys nudge it; a double tap puts it back.
	const handleAgain = again.getByRole('separator', { name: 'Resize Ability' });
	await handleAgain.focus();
	await page.keyboard.press('ArrowLeft');
	await expect.poll(() => width(kept)).toBeLessThan(dragged - 5);
	await handleAgain.tap();
	await handleAgain.tap();
	await expect.poll(() => width(kept)).toBeCloseTo(before, 0);
	await expect(handleAgain).not.toHaveAttribute('aria-valuenow');
});

test('a mouse scrolls a wide table sideways without going to its last row', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name === 'phone', 'phones stack the rows and never scroll sideways');
	test.slow();
	await page.setViewportSize({ width: 1280, height: 800 });
	const table = await openTable(page);
	// Widen a column so the table is surely wider than its box.
	const handle = table.getByRole('separator', { name: 'Resize Ability' });
	await handle.focus();
	for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');

	// The table scrolls in its own box, no taller than the screen, so its sideways
	// scrollbar is on screen rather than after 181 rows.
	const scroller = page.getByRole('region', { name: 'Characters table' });
	await scroller.scrollIntoViewIfNeeded();
	const area = (await scroller.boundingBox())!;
	expect(area.y + area.height).toBeLessThanOrEqual(800 + 1);
	const left = () => scroller.evaluate((el) => el.scrollLeft);
	expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
	const name = table.locator('tbody tr').first().locator('[data-col="name"]');
	const nameX = (await name.boundingBox())!.x;

	// A sideways wheel (trackpad, or Shift + wheel) scrolls it; the names stay in view.
	await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
	await page.mouse.wheel(400, 0);
	await expect.poll(left).toBeGreaterThan(100);
	expect(Math.abs((await name.boundingBox())!.x - nameX)).toBeLessThan(2);

	// Scrolling down inside the box: every row that comes into view is already complete.
	await page.mouse.wheel(0, 3000);
	await page.waitForTimeout(300);
	const incomplete = await scroller.evaluate((box) => {
		const view = box.getBoundingClientRect();
		return [...box.querySelectorAll('tbody tr')].filter((tr) => {
			const r = tr.getBoundingClientRect();
			return r.bottom > view.top && r.top < view.bottom && !tr.querySelector('td');
		}).length;
	});
	expect(incomplete).toBe(0);

	// The page itself still never scrolls sideways.
	const sideways = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
	);
	expect(sideways).toBe(false);
});

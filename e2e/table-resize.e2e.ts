import { expect, test, type Locator, type Page } from '@playwright/test';
import { touchDrag } from './touch.ts';

const width = (cell: Locator) => cell.evaluate((el) => el.getBoundingClientRect().width);

async function openTable(page: Page) {
	await page.goto('/reference');
	await page.getByText('Table', { exact: true }).tap();
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

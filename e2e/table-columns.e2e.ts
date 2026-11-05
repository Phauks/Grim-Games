import { expect, test, type Page } from '@playwright/test';

async function openTable(page: Page) {
	// Every character: one selected, with the jinx filter off (plan M47).
	await page.goto('/reference#philosopher');
	const table = page.getByTestId('character-table');
	await expect(table.locator('tbody tr')).toHaveCount(2);
	await page.getByText('Jinxed with locked', { exact: true }).tap();
	await expect(table.locator('tbody tr')).toHaveCount(181);
	return table;
}

test('scrolled sideways, nothing from the scrolling columns shows over the pinned ones', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name === 'phone', 'phones stack the rows and never scroll sideways');
	await page.setViewportSize({ width: 1024, height: 768 });
	const table = await openTable(page);
	const scroller = page.getByRole('region', { name: 'Characters table' });
	await scroller.scrollIntoViewIfNeeded();
	// Trevor, 2026-10-18: header lines overlapped where titles slid past the pinned columns.
	// At every step, each point over the pinned header and first row belongs to a pinned cell.
	const stray = await scroller.evaluate(async (box) => {
		const found: string[] = [];
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const name = box.querySelector('thead th[data-col="name"]')!;
		const firstRow = box.querySelector('tbody tr')!;
		for (let left = 0; left <= 600; left += 20) {
			box.scrollLeft = left;
			await frame();
			const edge = name.getBoundingClientRect();
			for (const row of [name, firstRow]) {
				const r = row.getBoundingClientRect();
				const y = r.top + Math.min(r.height / 2, 20);
				for (let x = box.getBoundingClientRect().left + 2; x < edge.right; x += 4) {
					const hit = document.elementFromPoint(x, y);
					if (!hit?.closest('.sticky')) found.push(`${left}: ${hit?.className} at ${x}`);
				}
			}
		}
		return found;
	});
	expect(stray).toEqual([]);
	await expect(table).toBeVisible();
});

test('each header keeps its label on one line', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name === 'phone', 'phones stack the rows');
	const table = await openTable(page);
	// Trevor, 2026-10-18: Starting alignment took two lines.
	const cut = await table
		.locator('thead .label, thead .plain')
		.evaluateAll((labels) =>
			labels.filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent)
		);
	expect(cut).toEqual([]);
	const heights = await table
		.locator('thead .head')
		.evaluateAll((heads) => heads.map((h) => h.getBoundingClientRect().height));
	expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
});

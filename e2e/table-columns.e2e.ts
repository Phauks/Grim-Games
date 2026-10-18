import { expect, test, type Page } from '@playwright/test';

async function openTable(page: Page) {
	await page.goto('/reference');
	// The view is remembered, so after a reload the table may already be on.
	const toggle = page.getByRole('button', { name: 'Show as table' });
	await expect(toggle).toBeVisible();
	if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.tap();
	const table = page.getByTestId('character-table');
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

test('each header keeps its label, sort and filter on one line', async ({ page }, testInfo) => {
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

test('columns can be hidden and shown again, and stay that way', async ({ page }) => {
	const table = await openTable(page);
	const ability = table.locator('[data-col="ability"]');
	await expect(ability.first()).toBeAttached();
	await table.getByRole('button', { name: 'Columns', exact: true }).tap();
	const list = page.getByRole('dialog', { name: 'Columns' });
	// The name says which row is which, so it always stays.
	await expect(list.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
	await list.getByRole('checkbox', { name: 'Ability' }).tap();
	await expect(ability).toHaveCount(0);
	await expect(table.getByRole('button', { name: 'Columns (some hidden)' })).toBeVisible();

	await page.reload();
	const again = await openTable(page);
	await expect(again.locator('[data-col="ability"]')).toHaveCount(0);
	await again.getByRole('button', { name: 'Columns (some hidden)' }).tap();
	await page
		.getByRole('dialog', { name: 'Columns' })
		.getByRole('checkbox', { name: 'Ability' })
		.tap();
	await expect(again.locator('thead [data-col="ability"]')).toHaveCount(1);
});

test('every column filters: a search for words, a list for a few values', async ({ page }) => {
	const table = await openTable(page);
	const count = page.getByTestId('table-count');
	const rows = table.locator('tbody tr');

	// Ability had no filter of its own: it gets a contains search.
	await table.getByRole('button', { name: 'Filter Ability' }).tap();
	await page
		.getByRole('dialog', { name: 'Filter Ability' })
		.getByLabel('Search Ability')
		.fill('Demon');
	await expect(count).toContainText('1 filter');
	const fewer = await rows.count();
	expect(fewer).toBeLessThan(181);
	await expect(count).toContainText(`${fewer} of 181`);
	await page.keyboard.press('Enter');
	await expect(table.getByRole('button', { name: 'Filter Ability (set)' })).toBeVisible();

	// Clear empties it along with Reference's own filters.
	await page.getByRole('button', { name: 'Clear filters' }).tap();
	await expect(rows).toHaveCount(181);

	// Edition has a few values: a list to tick.
	await table.getByRole('button', { name: 'Filter Edition' }).tap();
	await page
		.getByRole('dialog', { name: 'Filter Edition' })
		.getByRole('checkbox', { name: 'Trouble Brewing' })
		.tap();
	await page.keyboard.press('Escape');
	const editions = await table
		.locator('tbody td[data-col="edition"]')
		.evaluateAll((cells) => [...new Set(cells.map((c) => c.textContent?.trim()))]);
	expect(editions).toEqual(['Trouble Brewing']);
});

import { expect, test } from '@playwright/test';

// Trevor (2026-10-17): every page reached from the sidebar uses the same page structure
// (src/lib/ui/layout/Page.svelte). The preview route renders every slot.

test('the page title row keeps its actions beside the title', async ({ page }) => {
	await page.goto('/spikes/page');
	const main = page.getByRole('main');
	const title = main.getByRole('heading', { level: 1, name: 'Page layout preview' });
	await expect(title).toBeVisible();
	await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
	const action = main.getByRole('button', { name: 'Action' });
	const titleBox = await title.boundingBox();
	const actionBox = await action.boundingBox();
	// Same row: the action's vertical middle sits within the title's line.
	const actionMiddle = actionBox!.y + actionBox!.height / 2;
	expect(actionMiddle).toBeGreaterThan(titleBox!.y - actionBox!.height / 2);
	expect(actionMiddle).toBeLessThan(titleBox!.y + titleBox!.height + actionBox!.height / 2);
	expect(actionBox!.x).toBeGreaterThan(titleBox!.x);
});

test('subtitle, toolbar and sections follow the title in order', async ({ page }) => {
	await page.goto('/spikes/page');
	const main = page.getByRole('main');
	const top = async (box: Promise<{ y: number } | null>) => (await box)!.y;
	const title = await top(main.getByRole('heading', { level: 1 }).boundingBox());
	const subtitle = await top(main.getByText('Subtitle line').boundingBox());
	const search = await top(main.getByRole('searchbox', { name: 'Search' }).boundingBox());
	const first = await top(main.getByRole('heading', { name: 'First section' }).boundingBox());
	expect(subtitle).toBeGreaterThan(title);
	expect(search).toBeGreaterThan(subtitle);
	expect(first).toBeGreaterThan(search);
	await expect(main.getByRole('region', { name: 'First section' })).toBeVisible();
});

test('a collapsible section closes from its header and remembers it', async ({ page }) => {
	await page.goto('/spikes/page');
	const toggle = page.getByRole('button', { name: 'Second section' });
	await expect(page.getByText('Collapsible content')).toBeVisible();
	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByText('Collapsible content')).toBeHidden();
	await page.reload();
	await expect(page.getByText('Collapsible content')).toBeHidden();
});

test('the side column sits above the content on phones and tablets', async ({ page }) => {
	await page.goto('/spikes/page');
	const side = await page.getByText('Side column').boundingBox();
	const first = await page.getByRole('heading', { name: 'First section' }).boundingBox();
	expect(side!.y).toBeLessThan(first!.y);
});

test('on a computer window the side column sits beside the content', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/spikes/page');
	const side = await page.getByText('Side column').boundingBox();
	const first = await page.getByRole('heading', { name: 'First section' }).boundingBox();
	expect(side!.x + side!.width).toBeLessThanOrEqual(first!.x);
});

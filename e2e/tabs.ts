import { expect, type Page } from '@playwright/test';

/** Opens a tab, from the ⋯ menu when it is not on the row (a phone has no room for all). */
export async function openTab(page: Page, name: string) {
	const tab = page.getByRole('tab', { name, exact: true });
	await expect(page.getByRole('tab').first()).toBeVisible();
	if (!(await tab.count())) {
		await page.getByRole('button', { name: 'More tabs' }).tap();
		await page.getByRole('dialog', { name: 'More tabs' }).getByRole('button', { name }).tap();
	}
	await tab.tap();
}

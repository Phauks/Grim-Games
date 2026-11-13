import { expect, type Locator, type Page } from '@playwright/test';

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

/**
 * Opens the player's Notes and returns where they show: their own tab on a phone, or beside
 * the chosen tab where the screen has room (plan E3), turned on from the Notes button at the
 * end of the tabs' bar.
 */
export async function openNotes(scope: Page | Locator): Promise<Locator> {
	await expect(scope.getByRole('tab').first()).toBeVisible();
	const tab = scope.getByRole('tab', { name: 'Notes', exact: true });
	if (await tab.count()) {
		await tab.tap();
		return scope.getByRole('tabpanel', { name: 'Notes' });
	}
	const toggle = notesToggle(scope);
	if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.tap();
	return scope.getByRole('complementary', { name: 'Notes' });
}

/** The Notes button at the end of the tabs' bar, where Notes show beside the chosen tab. */
export const notesToggle = (scope: Page | Locator) =>
	scope.locator('[data-bottom-bar]').getByRole('button', { name: 'Notes', exact: true });

/** The tabs' names, with Notes last whether they are a tab or shown beside one. */
export async function tabNames(scope: Page | Locator): Promise<string[]> {
	const names = (await scope.getByRole('tab').allTextContents()).map((name) => name.trim());
	return (await notesToggle(scope).count()) ? [...names, 'Notes'] : names;
}

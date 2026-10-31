import type { Locator, Page } from '@playwright/test';

/**
 * Picks a number from a NumberSelect drop-down (Trevor, 2026-10-30: numbers are picked from a
 * drop-down, not stepped), as a finger would: the drop-down by its name, then the option.
 */
export async function pickNumber(scope: Page | Locator, name: string, option: number | string) {
	await scope.getByRole('combobox', { name, exact: true }).tap();
	const page = 'page' in scope && typeof scope.page === 'function' ? scope.page() : scope;
	await (page as Page).getByRole('option', { name: String(option), exact: true }).tap();
}

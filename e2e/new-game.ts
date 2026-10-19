import { expect, type Page } from '@playwright/test';

const BASE_THREE = ['Trouble Brewing', 'Bad Moon Rising', 'Sects & Violets'];

/**
 * Chooses New game's script: a tap on one of the base three, or any other script found by
 * typing its name in the script search (Trevor, 2026-10-19).
 */
export async function pickScript(page: Page, name: string): Promise<void> {
	if (BASE_THREE.includes(name)) {
		await page.getByRole('radiogroup', { name: 'Script' }).getByText(name, { exact: true }).tap();
		return;
	}
	const field = page.getByRole('combobox', { name: 'Find a script' });
	await field.tap();
	await field.fill(name);
	await page.getByRole('option').filter({ hasText: name }).first().tap();
	await expect(field).toHaveValue(name);
}

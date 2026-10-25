import { expect, test } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

/**
 * Every section of Settings is built from the shared setting pieces in `ui/settings` (Trevor,
 * 2026-10-24: "all settings use a similar framework"): each control sits inside a
 * `data-setting` row, which is what draws the line between stacked settings (ui/base.css). A
 * control built outside them would sit without a line, as Theme's colours once did.
 */
test('every control in every Settings section sits in a shared setting row', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettingsDialog(page);
	const nav = dialog.getByRole('navigation', { name: 'Settings sections' });
	const sections = await nav.locator('li button .label').allInnerTexts();
	expect(sections.length).toBeGreaterThan(5);

	for (const name of sections.map((text) => text.trim())) {
		if (!(await nav.isVisible())) await dialog.getByRole('button', { name: 'All settings' }).tap();
		await nav.getByRole('button', { name, exact: true }).tap();
		const content = dialog.locator('section.content');
		await expect(content.getByRole('heading', { name, level: 2 })).toBeVisible();
		// Open every closed group, so the settings inside are checked too.
		const closed = content.locator('.collapsible > .head button[aria-expanded="false"]');
		while (await closed.count()) await closed.first().tap();

		const loose = await content.evaluate((root) =>
			[
				...root.querySelectorAll<HTMLElement>(
					'input:not([type="hidden"]), select, textarea, button, [role="combobox"], [role="switch"]'
				)
			]
				.filter(
					(control) =>
						control.getClientRects().length > 0 &&
						!control.closest('.heading, [aria-hidden="true"], [data-setting]')
				)
				.map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim())
		);
		expect(loose, `${name}: controls outside a setting row`).toEqual([]);
	}
});

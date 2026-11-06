import type { Page } from '@playwright/test';

/**
 * An open night step. Its title is the night (Trevor, 2026-11-06: "just say" the night, the
 * name is already beneath), so the step is found by the name its row shows.
 */
export const nightStep = (page: Page, name: string) =>
	page
		.getByRole('dialog', { name: /^(First night|Other nights)$/ })
		.filter({ has: page.locator(`[data-step-name="${name}"]`) });

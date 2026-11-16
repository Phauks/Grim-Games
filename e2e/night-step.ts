import type { Page } from '@playwright/test';

/**
 * An open night step, the pane's Night tab (Trevor, 2026-11-16). Its title is the night (Trevor, 2026-11-06: "just say" the night, the
 * name is already beneath), so the step is found by the name its row shows.
 */
export const nightStep = (page: Page, name: string) =>
	page
		.getByRole('region', { name: /^(First night|Other nights)$/ })
		.filter({ has: page.locator(`[data-step-name="${name}"]`) });

/**
 * Tonight's walk-through: the strip under the board on a phone, the pane's Night tab beside
 * the board (Trevor, 2026-11-16). On a phone with the step open over it, the step.
 */
export const walkThrough = (page: Page) => page.locator('[data-walk]').last();

/** The walk-through's step name. */
export const walkName = (page: Page) => walkThrough(page).locator('[data-walk-name]');

/** The walk-through's Next, which ticks the step. */
export const walkNext = (page: Page) =>
	walkThrough(page).getByRole('button', { name: 'Next step', exact: true });

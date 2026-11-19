import { expect, test } from '@playwright/test';
import { pickScript } from './new-game.ts';

// Trevor, 2026-11-19: "Character specific none is bad. We should unify all empty null ones
// into single format, as decided by previous None for announcements" (muted italic, left
// aligned, inset to where a row's text starts; 2026-11-18). Every empty state is NoneState.

test('an empty Fabled section shows the shared None, not a dashed slot', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const fabled = page.getByRole('button', { name: 'Fabled', exact: true });
	await fabled.tap();
	await expect(fabled).toHaveAttribute('aria-expanded', 'true');
	const section = page.locator(`[id="${await fabled.getAttribute('aria-controls')}"]`);
	const none = section.locator('.none-state');
	await expect(none).toHaveText('None');
	await expect(none).toBeVisible();
	const look = await none.evaluate((el) => {
		const s = getComputedStyle(el);
		return {
			italic: s.fontStyle,
			align: s.textAlign,
			border: s.borderTopStyle,
			inset: parseFloat(s.paddingInlineStart),
			height: el.getBoundingClientRect().height
		};
	});
	expect(look.italic).toBe('italic');
	expect(['start', 'left']).toContain(look.align);
	expect(look.border).toBe('none');
	expect(look.inset).toBeGreaterThan(0);
	// A row tall, so a tap target's room is kept for what may appear there.
	expect(look.height).toBeGreaterThanOrEqual(44);
});

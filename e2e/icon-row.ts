import { expect, type Locator } from '@playwright/test';

/** What makes an icon button look like one: its box, edge, fill and where its icon sits. */
async function looks(button: Locator) {
	return button.evaluate((el) => {
		const box = el.getBoundingClientRect();
		const icon = el.querySelector('.icon')?.getBoundingClientRect();
		const style = getComputedStyle(el);
		return {
			width: Math.round(box.width),
			height: Math.round(box.height),
			border: style.borderTopWidth,
			radius: style.borderRadius,
			ring: style.boxShadow,
			fill: style.backgroundColor,
			colour: style.color,
			// The icon's offset inside the button: centred in every one.
			iconX: icon ? Math.round(icon.left - box.left) : null,
			iconY: icon ? Math.round(icon.top - box.top) : null,
			iconSize: icon ? Math.round(icon.width) : null
		};
	});
}

/**
 * Every button in a row of icon buttons (a page's title actions, a dialog's header) looks the
 * same, whatever it opens: a drop-down there is `Select icon=`, a toggle is `IconButton`
 * (Trevor, 2026-10-26: "consolidate the various buttons and row functionality so new buttons
 * don't have these issues"). `names` are the buttons' accessible names, in order.
 */
export async function expectMatchingIconRow(row: Locator, names: (string | RegExp)[]) {
	const buttons = names.map((name) =>
		row.getByRole('button', { name, exact: true }).or(row.getByRole('combobox', { name }))
	);
	for (const button of buttons) await expect(button).toBeVisible();
	const first = await looks(buttons[0]);
	for (const [i, button] of buttons.entries())
		expect(await looks(button), `"${names[i]}" looks like "${names[0]}"`).toEqual(first);
}

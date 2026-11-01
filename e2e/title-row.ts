import { expect, type Locator } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

/**
 * The script's name against the header's buttons (/play and the board's Script): on their row,
 * level with them, when it fits there at its full size, otherwise under them (Trevor,
 * 2026-11-01: "if there is space in the front row where there would not be reflow, we do that,
 * otherwise, put it beneath"). `scope` holds the header; returns whether it shared the row.
 */
export async function expectTitleBesideOrUnder(
	scope: Locator,
	title: Box,
	icon: Box
): Promise<boolean> {
	const oneRow = (await scope.locator('[data-title-below][data-one-row]').count()) > 0;
	if (!oneRow) {
		expect(title.y).toBeGreaterThanOrEqual(icon.y + icon.height - 1);
		return false;
	}
	expect(Math.abs(title.y + title.height / 2 - (icon.y + icon.height / 2))).toBeLessThan(
		icon.height / 2
	);
	expect(title.x + title.width).toBeLessThanOrEqual(icon.x + 1);
	return true;
}

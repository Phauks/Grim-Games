import { expect, type Page } from '@playwright/test';

/**
 * The phone is in its room with nothing to report: the status box shows the game (or Your
 * character, or Select seat), not Joining, Offline, Choosing or Game over (playerStatus).
 */
export async function expectInRoom(page: Page): Promise<void> {
	await expect(page.getByTestId('player-status-row')).toHaveAttribute(
		'data-status',
		/^(phase|none|character|selectSeat)$/
	);
}

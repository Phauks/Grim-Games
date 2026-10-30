import { t } from '#lib/i18n/locale.svelte.ts';

/**
 * What the row over the player screen's tabs says once the game is over, the same words as
 * the Storyteller's board: on phones, and in the Storyteller's player view (Trevor, 2026-10-30).
 */
export function gameOverText(winner: 'good' | 'evil' | undefined): string {
	return winner === 'good'
		? t('room.gameOverGood')
		: winner === 'evil'
			? t('room.gameOverEvil')
			: t('room.gameOver');
}

import { t } from '#lib/i18n/locale.svelte.ts';
import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
import { jinxesOnlyName } from './player-script.ts';

/**
 * The name of the character whose ability is only the jinxes (the Djinn), for the switches that
 * put it on script sheets (Trevor, 2026-11-16), from the official data; "Loading…" until that
 * arrives, so the row is there from the start.
 */
export function jinxesOnlyLabel(): string {
	const data = officialData.current;
	if (!data) {
		void loadOfficialData();
		return t('player.loading');
	}
	return jinxesOnlyName(data) ?? t('player.loading');
}

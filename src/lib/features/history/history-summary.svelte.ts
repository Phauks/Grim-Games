import { historyStats, type GameRecord } from '#lib/core/stats/index.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { intl, t } from '#lib/i18n/locale.svelte.ts';
import { loadGameRecords } from './records.ts';

/**
 * History's summary on this device (games, good won, evil won), for the places that show it
 * beside the player's own look: Home's player card and the Profile (Trevor, 2026-11-15).
 * Read once `load` is called, from a component's mount.
 */
export class HistorySummary {
	#records = $state.raw<GameRecord[]>([]);
	readonly counts = $derived.by(() => {
		const { summary } = historyStats(this.#records);
		return [
			{ label: t('history.games'), value: intl.number(summary.games) },
			{ label: t('history.goodWins'), value: intl.number(summary.wins.good) },
			{ label: t('history.evilWins'), value: intl.number(summary.wins.evil) }
		];
	});

	load(): void {
		loadGameRecords()
			.then((records) => (this.#records = records))
			.catch((e: unknown) => reportError(e, { area: 'history' }));
	}
}

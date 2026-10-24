import type { GamePhase } from '#lib/core/rules/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/** "Setup", "Night 4" or "Day 3": a phase as the board, Game info and Resume all say it. */
export function phaseText(phase: GamePhase): string {
	if (phase.kind === 'setup') return t('day.setup');
	return phase.kind === 'night'
		? t('day.nightNumber', { number: phase.number })
		: t('day.titleNumber', { number: phase.number });
}

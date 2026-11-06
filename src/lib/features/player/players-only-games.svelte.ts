/**
 * The towns this phone keeps with no Storyteller (plan M55), newest first, each with a script
 * it can still load. Join game's Players only, the leave dialog and the menu's last game share
 * them.
 */
import { editionScript, type LoadedScript } from '#lib/core/data/index.ts';
import { officialData } from '#lib/features/characters/game-data.svelte.ts';
import { recentScripts } from '#lib/features/scripts/current-script.svelte.ts';
import { reloadSavedScript, type ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { keptLocalTown, localTownVisits, type LocalTownVisit } from './local-town.svelte.ts';

export interface PlayersOnlyGame {
	visit: LocalTownVisit;
	script: LoadedScript;
	source: ScriptSource;
	seats: number;
	dead: number;
}

/** Reactive while the character data loads: empty until it has. */
export function playersOnlyGames(): PlayersOnlyGame[] {
	const data = officialData.current;
	if (!data) return [];
	return localTownVisits().flatMap((visit) => {
		const seats = keptLocalTown(visit.key)?.seats ?? [];
		if (seats.length === 0) return [];
		const saved = visit.scriptId
			? recentScripts.list.find((s) => s.scriptId === visit.scriptId)
			: undefined;
		const script = visit.edition
			? editionScript(visit.edition, data)
			: saved && reloadSavedScript(saved, data);
		if (!script) return [];
		const source = saved?.source ?? { kind: 'edition' as const };
		const dead = seats.filter((s) => s.dead).length;
		return [{ visit, script, source, seats: seats.length, dead }];
	});
}

/** "7 seats · 2 dead": a town's row line. */
export function playersOnlyLine(seats: number, dead: number): string {
	return t('player.local.summary', {
		seats: t('player.local.seats', { count: seats }),
		dead: dead ? t('player.local.dead', { count: dead }) : t('player.local.noneDead')
	});
}

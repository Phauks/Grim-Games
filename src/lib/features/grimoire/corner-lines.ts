/**
 * What the board's lower left corner shows under the script's name (BoardCorner), worked out
 * once so the Storyteller's board and every phone's grim show the same lines (Trevor,
 * 2026-10-24: the player grim must show "the same information in the bottom left"). The
 * board sends it to phones in the room's public state (public-projection.ts).
 */
import type { GameId } from '#lib/core/model/index.ts';
import type { PublicCorner, PublicPhase } from '#lib/core/sync/public-projection.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { gameModeNames } from './game-mode-name.ts';

/**
 * The night or day in play (Trevor, 2026-10-23): Setup until Start game, then Night 1, and a
 * night from End day (Dusk) until its Dawn starts the next day.
 */
export function boardPhase(started: boolean, pastDays: number, nightBegun: boolean): PublicPhase {
	if (!started) return { kind: 'setup' };
	return pastDays === 0 || nightBegun
		? { kind: 'night', number: pastDays + 1 }
		: { kind: 'day', number: pastDays };
}

export function phaseText(phase: PublicPhase): string {
	if (phase.kind === 'setup') return t('day.setup');
	return phase.kind === 'night'
		? t('day.nightNumber', { number: phase.number })
		: t('day.titleNumber', { number: phase.number });
}

/**
 * The corner's lines as this device's Board settings show them. A spectator's board
 * (`watching`) has no join code, phase or Game time of its own.
 */
export function cornerLines(options: {
	gameId: GameId;
	phase: PublicPhase;
	startedAt?: number;
	endedAt?: number;
	watchers: number;
	watching: boolean;
}): PublicCorner {
	const { assistance } = preferences.current;
	const own = !options.watching;
	return {
		modes: gameModeNames(options.gameId),
		...(own && assistance.roomCode ? { joinCode: true } : {}),
		// A watched board can't tell when the game started, so its phase would read Setup.
		...(own && assistance.boardPhase ? { phase: options.phase } : {}),
		...(own && assistance.gameClock
			? {
					gameTime: {
						...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
						...(options.endedAt !== undefined ? { endedAt: options.endedAt } : {})
					}
				}
			: {}),
		...(options.watchers > 0 ? { watchers: options.watchers } : {})
	};
}

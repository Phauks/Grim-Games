/**
 * The game as it stood just after each "New day", oldest first, from the game's log: what
 * the Savant generator compares to say what changed overnight or since the start
 * (`core/rules/savant.ts`). Entries after the cursor (undone) are left out.
 */
import type { Game } from '#lib/core/model/types.ts';
import type { GameLog } from './log.ts';
import { applyEvents } from './reducer.ts';

export function dawnGames(log: GameLog): Game[] {
	const out: Game[] = [];
	let game: Game | undefined;
	for (const entry of log.entries.slice(0, log.cursor)) {
		game = applyEvents(game, entry.events);
		if (game && entry.events.some((e) => e.type === 'DayStarted')) out.push(game);
	}
	return out;
}

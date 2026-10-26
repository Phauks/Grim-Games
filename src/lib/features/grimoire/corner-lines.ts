/**
 * What the board's lower left corner shows under the script's name (BoardCorner), worked out
 * once so the Storyteller's board and every phone's grim show the same lines (Trevor,
 * 2026-10-24: the player grim must show "the same information in the bottom left"). The
 * board sends it to phones in the room's public state (public-projection.ts).
 */
import type { GameId } from '#lib/core/model/index.ts';
import type { PublicCorner, PublicPhase } from '#lib/core/sync/public-projection.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { gameModeParts } from './game-mode-name.ts';

/**
 * The corner's lines as this device's eyes show them (Game info and Settings > Board; Trevor,
 * 2026-10-24). A spectator's board (`watching`) has no join code or Game time of its own.
 */
export function cornerLines(options: {
	gameId: GameId;
	phase: PublicPhase;
	startedAt?: number;
	endedAt?: number;
	watchers: number;
	watching: boolean;
	/** The script's version and the players line, as Game info gives them. */
	version?: string;
	players?: string;
}): PublicCorner {
	const lines = preferences.current.cornerLines;
	const own = !options.watching;
	const { mode, rules } = gameModeParts(options.gameId);
	return {
		modes: [...(mode && lines.mode ? [mode] : []), ...(lines.rules ? rules : [])],
		...(lines.author ? {} : { author: false }),
		...(lines.storyteller ? {} : { storyteller: false }),
		...(lines.version && options.version ? { version: options.version } : {}),
		...(lines.players && options.players ? { players: options.players } : {}),
		...(own && lines['join-code'] ? { joinCode: true } : {}),
		...(lines['game-time'] ? { phase: options.phase } : {}),
		...(own && lines['game-time']
			? {
					gameTime: {
						begun: options.phase.kind !== 'setup',
						...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
						...(options.endedAt !== undefined ? { endedAt: options.endedAt } : {})
					}
				}
			: {}),
		...(lines.watchers && options.watchers > 0 ? { watchers: options.watchers } : {})
	};
}

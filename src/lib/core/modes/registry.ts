/** The game modes the app ships, Standard first, then A–Z. */
import type { GameMode } from './types.ts';
import { STANDARD } from './library/standard.ts';
import { FLESH_AND_BONE } from './library/flesh-and-bone.ts';
import { INFINITE_POSSIBILITIES } from './library/infinite-possibilities.ts';
import { SPECTERS } from './library/specters.ts';
import { SUSHI_BUFFET } from './library/sushi-buffet.ts';
import { TWO_TOWNS } from './library/two-towns.ts';
import { TWO_GAMES_AT_ONCE } from './library/two-games-at-once.ts';
import { WHALE_BUFFET } from './library/whale-buffet.ts';

export { STANDARD };

export const GAME_MODES: readonly GameMode[] = [
	STANDARD,
	INFINITE_POSSIBILITIES,
	FLESH_AND_BONE,
	SPECTERS,
	SUSHI_BUFFET,
	TWO_GAMES_AT_ONCE,
	TWO_TOWNS,
	WHALE_BUFFET
];

export function gameModeById(id: string): GameMode | undefined {
	return GAME_MODES.find((m) => m.id === id);
}

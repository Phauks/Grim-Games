import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/**
 * Two scripts played at the same time by the same players, each with a character in both
 * games (a Saint in one and a Vigormortis in the other); the only restriction is that no one
 * is the Demon in both. As Trevor described it (2026-10-17); no published source or name was
 * found yet, so the name is a placeholder and everything but the towns is unconfirmed. It
 * lists no source: Trevor's notes aren't one (Trevor, 2026-10-19).
 */
export const TWO_GAMES_AT_ONCE: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'two-games-at-once',
	name: 'Two games at once',
	about:
		'The same players play two scripts at the same time, with a character in each game. No one may be the Demon in both.',
	sources: [],
	unconfirmed: ['pool', 'counts', 'winConditions'],
	parts: {
		pool: { kind: 'per-town', scripts: [] },
		towns: { count: 2, storytellers: 1, samePlayers: true, notInEveryTown: ['demon'] }
	}
};

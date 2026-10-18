/**
 * One setup for every town of a mode game (Trevor, 2026-10-18: "build bag 1, ... build bag 2,
 * ... then build from there", without going back to the home page in between). Two Towns
 * and a Boomdandy and Two games at once share it: New game opens town 1's setup, building a
 * town's bag opens the next town's setup, and the last bag opens a review of both towns'
 * characters, then the draw (one token for both games when the same players play both).
 * Players type their names when they draw.
 */
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { GameData } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { inPlayFor, STANDARD, type GameMode } from '#lib/core/modes/index.ts';
import { OpenGame } from '#lib/features/game/session.svelte.ts';
import { findMode } from './custom-modes.svelte.ts';
import { seedInPlay } from './in-play.ts';
import { townGroupOf, type TownGroup } from './town-groups.ts';

/** Town `index`'s setup, with the characters the mode always has in that town put in first. */
export function townSetupHref(group: TownGroup, index: number, players: number): ResolvedPathname {
	const gameId = group.gameIds[index];
	seedInPlay(gameId, players, inPlayFor(findMode(group.modeId) ?? STANDARD, index));
	return resolve('/grimoire/[gameId]/setup', { gameId });
}

/**
 * Where a town's setup goes once its bag is built: the next town's setup, then the draw.
 * Undefined for a game that isn't a town, whose setup opens its own draw. `seed` runs once
 * the next setup is open: seeding before would be undone as the last setup closes.
 */
export async function afterTownBag(
	gameId: GameId,
	data: Pick<GameData, 'characters'>
): Promise<{ href: ResolvedPathname; seed?: () => void } | undefined> {
	const group = townGroupOf(gameId);
	if (!group) return undefined;
	const index = group.gameIds.indexOf(gameId);
	const nextId = group.gameIds[index + 1];
	const next = nextId ? await OpenGame.open(data, nextId) : undefined;
	if (next) {
		const mode = findMode(group.modeId) ?? STANDARD;
		const players = next.game.seating.length;
		return {
			href: resolve('/grimoire/[gameId]/setup', { gameId: nextId }),
			seed: () => seedInPlay(nextId, players, inPlayFor(mode, index + 1))
		};
	}
	// Every bag is built: both towns' characters are reviewed before the draw.
	return { href: resolve('/towns/[groupId]/review', { groupId: group.groupId }) };
}

/** The draw once the bags are reviewed: one token for both games when the players are the same. */
export function townDrawHref(group: TownGroup, mode: GameMode | undefined): ResolvedPathname {
	if (mode?.parts.towns?.samePlayers)
		return resolve('/towns/[groupId]/draw', { groupId: group.groupId });
	return resolve('/grimoire/[gameId]/draw', { gameId: group.gameIds[0] });
}

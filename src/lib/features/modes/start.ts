import { toScript, type GameData, type LoadedScript, type Script } from '#lib/core/data/index.ts';
import { modeScript, STANDARD, type StorytellerRestrictions } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import { findMode } from './custom-modes.svelte.ts';
import { writeGameMode } from './game-mode-store.ts';
import { saveTownGroup } from './town-groups.ts';

interface StartInput<G> {
	modeId: string;
	restrictions: StorytellerRestrictions;
	data: GameData;
	loaded: LoadedScript;
	/** Creates and saves the game with the mode's script. */
	create: (script: Script) => Promise<G>;
}

/**
 * Starts a game in a mode: the game is created with the mode's script (its pool, less banned
 * and restricted characters, plus those it always puts on the script), and the mode is kept
 * beside the game on this device.
 */
export async function startInMode<G extends { game: { gameId: GameId } }>(
	input: StartInput<G>
): Promise<G> {
	const mode = findMode(input.modeId) ?? STANDARD;
	const script = modeScript(
		mode,
		toScript(input.loaded),
		input.loaded.characters,
		input.data.characters,
		input.restrictions
	);
	const open = await input.create(script);
	writeGameMode(open.game.gameId, { modeId: mode.id, restrictions: input.restrictions });
	return open;
}

/**
 * Where a new game opens: the draft or choose screen for a mode that doesn't use the bag
 * (Sushi Buffet, Whale Buffet), otherwise the board.
 */
export function startHref(modeId: string, gameId: GameId): ResolvedPathname {
	const kind = (findMode(modeId) ?? STANDARD).parts.assignment?.kind;
	return kind === 'draft' || kind === 'choose-own'
		? resolve('/grimoire/[gameId]/deal', { gameId })
		: resolve('/grimoire/[gameId]', { gameId });
}

interface TownsInput<G> {
	modeId: string;
	restrictions: StorytellerRestrictions;
	data: GameData;
	/** One script per town. */
	scripts: LoadedScript[];
	/** Players per town. */
	sizes: number[];
	create: (script: Script, players: number) => Promise<G>;
}

/**
 * Starts a game of several towns: one saved game per town, tied together by a town group.
 * Returns the group's id.
 */
export async function startTowns<G extends { game: { gameId: GameId } }>(
	input: TownsInput<G>
): Promise<string> {
	const mode = findMode(input.modeId) ?? STANDARD;
	const gameIds: GameId[] = [];
	for (const [i, loaded] of input.scripts.entries()) {
		const script = modeScript(
			mode,
			toScript(loaded),
			loaded.characters,
			input.data.characters,
			input.restrictions
		);
		const open = await input.create(script, input.sizes[i] ?? input.sizes[0]);
		writeGameMode(open.game.gameId, { modeId: mode.id, restrictions: input.restrictions });
		gameIds.push(open.game.gameId);
	}
	const groupId = crypto.randomUUID();
	saveTownGroup({ groupId, modeId: mode.id, gameIds, createdAt: Date.now() });
	return groupId;
}

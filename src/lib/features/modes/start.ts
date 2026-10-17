import { toScript, type GameData, type LoadedScript, type Script } from '#lib/core/data/index.ts';
import {
	gameModeById,
	modeScript,
	STANDARD,
	type StorytellerRestrictions
} from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { writeGameMode } from './game-mode-store.ts';

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
	const mode = gameModeById(input.modeId) ?? STANDARD;
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

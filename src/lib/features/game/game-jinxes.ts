import {
	findJinx,
	fromScript,
	type CharacterId,
	type GameData,
	type Jinx
} from '#lib/core/data/index.ts';
import { charactersInPlay, type Game } from '#lib/core/model/index.ts';
import { activeJinxes, scriptJinxes, type ScriptJinx } from '#lib/core/rules/jinxes/jinxes.ts';

/**
 * A game's jinxes for where the Storyteller runs each character (L107): the script's jinxes
 * (TPI's and its homebrew ones) whose both characters are in play, on a seat or as a rule
 * character. Each character's own come from `jinxesOnStep` with `inPlay`.
 */
export interface GameJinxes {
	jinxes: ScriptJinx[];
	inPlay: CharacterId[];
}

export function gameJinxes(game: Game, data: GameData | undefined): GameJinxes {
	const inPlay = [...charactersInPlay(game), ...game.ruleCharacters];
	if (!data) return { jinxes: [], inPlay };
	const script = fromScript(game.script, data).script;
	const jinxes = scriptJinxes(
		data.jinxes,
		script.characters.map((c) => c.id),
		script.homebrewJinxes,
		new Map(script.characters.map((c) => [c.id, c]))
	);
	return { jinxes: activeJinxes(jinxes, inPlay), inPlay };
}

/**
 * The jinxes a character's card shows its player (Show to player): the ones in effect in this
 * game, both characters in play (Trevor, 2026-11-04, chosen over every jinx of theirs on the
 * script though it tells the player their partner is in play).
 */
export function characterJinxes(
	game: Game,
	data: GameData | undefined,
	id: CharacterId
): ScriptJinx[] {
	return gameJinxes(game, data).jinxes.filter((j) => j.characters.includes(id));
}

/**
 * The jinx between `a` and `b` as the game shows it: the script's (its homebrew wording
 * first), else TPI's, so a character from off the script still shows its jinx.
 */
export function jinxBetween(
	game: Game,
	data: GameData | undefined,
	a: CharacterId,
	b: CharacterId
): Jinx | undefined {
	if (!data) return undefined;
	const script = fromScript(game.script, data).script;
	const own = script.homebrewJinxes.find(
		({ characters: [x, y] }) => (x === a && y === b) || (x === b && y === a)
	);
	return own ?? findJinx(data.jinxes, a, b);
}

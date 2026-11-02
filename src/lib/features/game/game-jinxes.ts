import { fromScript, type CharacterId, type GameData } from '#lib/core/data/index.ts';
import { charactersInPlay, type Game } from '#lib/core/model/index.ts';
import { activeJinxes, scriptJinxes, type ScriptJinx } from '#lib/core/rules/jinxes.ts';

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

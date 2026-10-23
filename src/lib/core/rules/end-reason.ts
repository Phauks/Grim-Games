/**
 * How a game was won, as End game saves it (Trevor, 2026-10-18: alternate win stats need End
 * game to say how the game ended). The usual ends are the Demon dying and just 2 players
 * living (https://wiki.bloodontheclocktower.com/Glossary, "Demon", "Evil"); any other is a
 * character's own win condition, or the Storyteller's call (`other`).
 */
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game } from '#lib/core/model/types.ts';
import { gameEnds, type GameEnd, type GameEndOptions } from './game-end.ts';

export type EndReason = 'demon-dead' | 'two-alive' | `character:${CharacterId}` | 'other';

const characterReason = (id: CharacterId): EndReason => `character:${id}`;

/** The character an end reason names, if any. */
export function endReasonCharacter(reason: EndReason | undefined): CharacterId | undefined {
	return reason?.startsWith('character:') ? reason.slice('character:'.length) : undefined;
}

/** A reason other than the usual ends and the Storyteller's call. */
export const isAlternateEnd = (reason: EndReason | undefined): boolean =>
	endReasonCharacter(reason) !== undefined;

/** Reads a saved reason, dropping anything this build doesn't know. */
export function parseEndReason(value: unknown): EndReason | undefined {
	if (value === 'demon-dead' || value === 'two-alive' || value === 'other') return value;
	if (typeof value === 'string' && value.startsWith('character:') && value.length > 10) {
		return value as EndReason;
	}
	return undefined;
}

function reasonOf(end: GameEnd): EndReason {
	if (end.rule === 'demon-dead' || end.rule === 'two-alive') return end.rule;
	return end.characterId ? characterReason(end.characterId) : 'other';
}

/**
 * The reason the grimoire shows for this winner: a usual end if one gave it, else the first
 * other rule that did, else `other`.
 */
export function detectedEndReason(
	game: Game,
	characters: CharacterLookup,
	winner: Alignment,
	options: GameEndOptions = { dayEnded: true }
): EndReason {
	const ends = gameEnds(game, characters, options).filter((e) => e.winner === winner);
	const end = ends.find((e) => e.rule === 'demon-dead' || e.rule === 'two-alive') ?? ends[0];
	return end ? reasonOf(end) : 'other';
}

/**
 * The characters End game offers: those on the script, in a seat, or in play as a rule
 * character (the Fiddler) whose ability can decide the game, plus `extra` (a saved reason).
 * First those `gameEnds` checks (`gameEnd.ends`), then those only the Storyteller can judge
 * (`gameEnd.decidedByStoryteller`: a public claim, guess or choice), each in the order found.
 * An inverted winner (the Heretic) is left out: it flips whichever end happened.
 */
export function endCharacters(
	game: Game,
	characters: CharacterLookup,
	extra?: EndReason
): CharacterId[] {
	const present = new Set<CharacterId>(game.ruleCharacters);
	for (const entry of game.script.entries) {
		present.add(entry.kind === 'official' ? entry.id : entry.character.id);
	}
	for (const id of game.seating) {
		const c = trueCharacter(game, id, characters);
		if (c) present.add(c);
	}
	const saved = endReasonCharacter(extra);
	if (saved) present.add(saved);
	const rules = (id: CharacterId) => rulesOf(id, characters)?.gameEnd;
	const listed = [
		...[...present].filter((id) => (rules(id)?.ends?.length ?? 0) > 0),
		...[...present].filter((id) => rules(id)?.decidedByStoryteller)
	];
	return saved && !listed.includes(saved) ? [...listed, saved] : listed;
}

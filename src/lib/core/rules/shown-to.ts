import type { CharacterId } from '../data/index.ts';
import { rulesOf } from '../data/rules/index.ts';
import type { CharacterLookup } from '../model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '../model/selectors.ts';
import type { Game, SeatId } from '../model/types.ts';

/**
 * The players woken and shown a character's token (`shownTo` in its rules block): every
 * Minion (the Damsel, https://wiki.bloodontheclocktower.com/Damsel), or whoever carries its
 * `carrier` reminder (the Widow's Know, https://wiki.bloodontheclocktower.com/Widow). None
 * when nobody carries the reminder yet. Undefined when the character shows its token to no one.
 */
export function shownToSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] | undefined {
	const shownTo = rulesOf(characterId, characters)?.shownTo;
	if (!shownTo) return undefined;
	return game.seating.filter(
		(s) =>
			(shownTo.minions && typeOf(game, s, characters) === 'minion') ||
			(shownTo.carrier !== undefined &&
				game.seats[s].reminders.some(
					(r) => r.characterId === characterId && r.label === shownTo.carrier
				))
	);
}

/**
 * The characters in play whose token every Minion is shown at Minion info (the Damsel: "All
 * Minions know a Damsel is in play").
 */
export function shownAtMinionInfo(game: Game, characters: CharacterLookup): CharacterId[] {
	const ids = game.seating.flatMap((s) => trueCharacter(game, s, characters) ?? []);
	return [...new Set(ids)].filter((id) => rulesOf(id, characters)?.shownTo?.minions);
}

/**
 * What each evil player learns from a character's `evilLearns` rule (the Storm Catcher,
 * https://wiki.bloodontheclocktower.com/Storm_Catcher): the evil players to wake, and the
 * player carrying its reminder with their character. No `marked` when nobody carries it: they
 * are then shown the named character as not in play.
 */
export interface EvilLearns {
	evil: SeatId[];
	marked?: { seatId: SeatId; characterId?: CharacterId };
}

export function evilLearns(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): EvilLearns | undefined {
	const rule = rulesOf(characterId, characters)?.evilLearns;
	if (!rule) return undefined;
	const evil = game.seating.filter((s) => alignmentOf(game, s) === 'evil');
	const seatId = game.seating.find((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === rule.carrier)
	);
	if (seatId === undefined) return { evil };
	const id = trueCharacter(game, seatId, characters);
	return { evil, marked: { seatId, ...(id ? { characterId: id } : {}) } };
}

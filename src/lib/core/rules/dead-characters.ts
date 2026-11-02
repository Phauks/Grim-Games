import type { CharacterRules } from '../data/character-rules.ts';
import type { CharacterId } from '../data/index.ts';
import { rulesOf } from '../data/rules/index.ts';
import type { CharacterLookup } from '../model/characters.ts';
import type { Game, SeatId } from '../model/index.ts';
import { trueCharacter, typeOf } from '../model/selectors.ts';

type RulesLookup = ReadonlyMap<CharacterId, { rules?: CharacterRules }>;

/**
 * Whether a character's ability still acts once its player is dead (`actsWhenDead` in its
 * rules block: our `data/rules/<id>.json`, or a custom character's own `rules`). Their
 * reminders stay with the living ones in the bank. The tests cite each wiki page.
 */
export function actsWhenDead(characterId: CharacterId, characters?: RulesLookup): boolean {
	return rulesOf(characterId, characters)?.actsWhenDead === true;
}

/**
 * Whether a dead player keeps their ability because another character's reminder on them says
 * so (`keepsAbility`: the Vigormortis's Has Ability on a Minion it killed,
 * https://wiki.bloodontheclocktower.com/Vigormortis). They stay in the night order, and their
 * ability still works. Living players never need it.
 *
 * The kept ability lasts only while the token's character does (M15g): once every player of it
 * is dead, or no player is it any more (the Pit-Hag turns the Vigormortis into another Demon),
 * the ability is gone. `sourceWorks`, when given, judges each player of that character instead of
 * "alive" (`rules/ability.ts` asks whether its ability works, so a drunk or poisoned
 * Vigormortis's Minions lose theirs too).
 */
export function keepsAbilityWhenDead(
	game: Game,
	seatId: SeatId,
	characters?: CharacterLookup,
	sourceWorks?: (sourceSeat: SeatId) => boolean
): boolean {
	const seat = game.seats[seatId];
	if (!seat?.dead) return false;
	return seat.reminders.some((r) => {
		const keeps = rulesOf(r.characterId, characters)?.keepsAbility;
		if (keeps?.token !== r.label) return false;
		if (keeps.type && (!characters || typeOf(game, seatId, characters) !== keeps.type))
			return false;
		const sources = (game.seating ?? []).filter(
			(s) =>
				s !== seatId &&
				(characters ? trueCharacter(game, s, characters) : game.seats[s]?.characterId) ===
					r.characterId
		);
		const works = sourceWorks ?? ((s: SeatId) => !game.seats[s].dead);
		return sources.some(works);
	});
}

/**
 * Characters in play whose every player is dead and whose ability ends with them: their
 * reminders still off the board go in the bank's dead players section (Trevor, 2026-10-19).
 */
export function deadCharacters(game: Game, characters?: CharacterLookup): Set<CharacterId> {
	const alive = new Set<CharacterId>();
	const dead = new Set<CharacterId>();
	for (const [seatId, seat] of Object.entries(game.seats)) {
		if (!seat.characterId) continue;
		const ended = seat.dead && !keepsAbilityWhenDead(game, seatId, characters);
		(ended ? dead : alive).add(seat.characterId);
	}
	for (const id of [...dead]) if (alive.has(id) || actsWhenDead(id, characters)) dead.delete(id);
	return dead;
}

/**
 * Whether a reminder belongs to a character whose ability has ended with its player's death,
 * so putting it on the board asks first (Trevor, 2026-10-20; warn, never lock). The seat that
 * owns this copy decides when the reminder knows it; otherwise every player of the character
 * must be dead, and a dead player who keeps their ability (`keepsAbility`) counts as alive.
 * Characters that act once dead (`actsWhenDead`, the Sweetheart's Drunk) and
 * reminders of characters on no seat (Fabled, a Drunk's "Is The Drunk") never ask.
 */
export function reminderOwnerDead(
	game: Game,
	reminder: { characterId: CharacterId; ownerSeatId?: string },
	characters?: CharacterLookup
): boolean {
	if (actsWhenDead(reminder.characterId, characters)) return false;
	const ownerId = reminder.ownerSeatId;
	if (ownerId && game.seats[ownerId])
		return !!game.seats[ownerId].dead && !keepsAbilityWhenDead(game, ownerId, characters);
	return deadCharacters(game, characters).has(reminder.characterId);
}

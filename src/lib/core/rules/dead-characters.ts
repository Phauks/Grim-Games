import type { CharacterRules } from '../data/character-rules.ts';
import type { CharacterId } from '../data/index.ts';
import { rulesOf } from '../data/rules/index.ts';
import type { Game } from '../model/index.ts';

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
 * Characters in play whose every player is dead and whose ability ends with them: their
 * reminders still off the board go in the bank's dead players section (Trevor, 2026-10-19).
 */
export function deadCharacters(game: Game, characters?: RulesLookup): Set<CharacterId> {
	const alive = new Set<CharacterId>();
	const dead = new Set<CharacterId>();
	for (const seat of Object.values(game.seats)) {
		if (!seat.characterId) continue;
		(seat.dead ? dead : alive).add(seat.characterId);
	}
	for (const id of [...dead]) if (alive.has(id) || actsWhenDead(id, characters)) dead.delete(id);
	return dead;
}

/**
 * Whether a reminder belongs to a character whose ability has ended with its player's death,
 * so putting it on the board asks first (Trevor, 2026-10-20; warn, never lock). The seat that
 * owns this copy decides when the reminder knows it; otherwise every player of the character
 * must be dead. Characters that act once dead (`actsWhenDead`, the Sweetheart's Drunk) and
 * reminders of characters on no seat (Fabled, a Drunk's "Is The Drunk") never ask.
 */
export function reminderOwnerDead(
	game: Game,
	reminder: { characterId: CharacterId; ownerSeatId?: string },
	characters?: RulesLookup
): boolean {
	if (actsWhenDead(reminder.characterId, characters)) return false;
	const owner = reminder.ownerSeatId ? game.seats[reminder.ownerSeatId] : undefined;
	if (owner) return !!owner.dead;
	return deadCharacters(game, characters).has(reminder.characterId);
}

import type { CharacterId } from '../data/index.ts';
import type { Game } from '../model/index.ts';

/**
 * Characters whose ability still acts once their player is dead: it triggers on their death
 * ("When you die", "If you died today or tonight") or says it works "even if dead". Their
 * reminders stay with the living ones in the bank. Read from each ability's text in the
 * official character data; the tests cite each wiki page.
 */
const ACTS_WHEN_DEAD: ReadonlySet<CharacterId> = new Set([
	'atheist',
	'banshee',
	'barber',
	'farmer',
	'hatter',
	'heretic',
	'klutz',
	'mayor',
	'moonchild',
	'plaguedoctor',
	'politician',
	'poppygrower',
	'puzzlemaster',
	'ravenkeeper',
	'recluse',
	'sage',
	'saint',
	'spy',
	'sweetheart',
	'zombuul'
]);

export function actsWhenDead(characterId: CharacterId): boolean {
	return ACTS_WHEN_DEAD.has(characterId);
}

/**
 * Characters in play whose every player is dead and whose ability ends with them: their
 * reminders still off the board go in the bank's dead players section (Trevor, 2026-10-19).
 */
export function deadCharacters(game: Game): Set<CharacterId> {
	const alive = new Set<CharacterId>();
	const dead = new Set<CharacterId>();
	for (const seat of Object.values(game.seats)) {
		if (!seat.characterId) continue;
		(seat.dead ? dead : alive).add(seat.characterId);
	}
	for (const id of [...dead]) if (alive.has(id) || actsWhenDead(id)) dead.delete(id);
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
	reminder: { characterId: CharacterId; ownerSeatId?: string }
): boolean {
	if (actsWhenDead(reminder.characterId)) return false;
	const owner = reminder.ownerSeatId ? game.seats[reminder.ownerSeatId] : undefined;
	if (owner) return !!owner.dead;
	return deadCharacters(game).has(reminder.characterId);
}

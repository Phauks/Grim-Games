/**
 * Each player's own character on their own phone (Trevor, 2026-10-26: the app deals the
 * characters, "Storyteller tells people they can see it on their screen"). Only the
 * Storyteller's device works these out, and the room sends each phone its own seat's alone,
 * and only while the Storyteller lets players see them.
 *
 * A player sees what they were shown, never what the grimoire holds: a confirmed bag tile's
 * `shows` (the Lunatic sees a Demon), and otherwise the seat's character. A seat whose
 * character is shown something else, with no tile to say what, is left out, so the phone
 * never shows the truth (https://wiki.bloodontheclocktower.com/Lunatic).
 */
import { defaultAlignment, type Alignment, type CharacterId } from '#lib/core/data/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { standInKind } from '#lib/core/rules/bag-plan.ts';

/**
 * What one phone shows its player. `alignment` is set only when the player is told it: a
 * Traveller's, or one that differs from the character's own (the Storyteller's choice).
 * A role with only an alignment says just "You are Evil" (a Traveller, plan item 3).
 */
export interface SeatRole {
	characterId?: CharacterId;
	alignment?: Alignment;
}

/** The longest character id a role carries; ids are short, homebrew ones included. */
export const MAX_ROLE_ID = 80;

/** The role for every seat whose player may be shown one, by seat. */
export function seatRoles(game: Game, characters: CharacterLookup): Record<SeatId, SeatRole> {
	const shownBy = new Map<SeatId, CharacterId>();
	for (const tile of Object.values(game.bag?.tiles ?? {})) {
		const seatId = tile.drawnBySeat;
		if (tile.confirmed && seatId && game.seats[seatId]?.characterId === tile.grimoire) {
			shownBy.set(seatId, tile.shows);
		}
	}
	const roles: Record<SeatId, SeatRole> = {};
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		const truth = seat?.characterId && characters.get(seat.characterId);
		if (!seat || !truth) continue;
		const shows = shownBy.get(seatId);
		if (shows === undefined && standInKind(truth)) continue;
		const role: SeatRole = { characterId: shows ?? truth.id };
		const told = truth.type === 'traveller' || seat.alignment !== defaultAlignment(truth.type);
		if (seat.alignment && told) role.alignment = seat.alignment;
		roles[seatId] = role;
	}
	return roles;
}

/** Seats with a character whose player can't be shown it (see `seatRoles`). */
export function withheldSeats(game: Game, characters: CharacterLookup): SeatId[] {
	const roles = seatRoles(game, characters);
	return game.seating.filter((id) => game.seats[id]?.characterId && !roles[id]);
}

/** A role as one string, so the room can tell whether a player has seen this one. */
export function roleKey(role: SeatRole): string {
	return `${role.characterId ?? ''}|${role.alignment ?? ''}`;
}

/** A role from a device, checked; anything else is `undefined`. */
export function parseSeatRole(raw: unknown): SeatRole | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const { characterId, alignment } = raw as Record<string, unknown>;
	const role: SeatRole = {};
	if (typeof characterId === 'string' && characterId && characterId.length <= MAX_ROLE_ID)
		role.characterId = characterId;
	if (alignment === 'good' || alignment === 'evil') role.alignment = alignment;
	return role.characterId || role.alignment ? role : undefined;
}

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
 * What one phone shows its player. `alignment` is set only when the player is told it: one
 * that differs from the character's own (the Storyteller's choice). A Traveller's role is
 * only their alignment, "You are Evil" (Trevor, 2026-10-26, plan H2: "no draw, just good or
 * evil"): they chose their character in front of everyone
 * (https://wiki.bloodontheclocktower.com/Travellers), so the alignment is the secret.
 */
export interface SeatRole {
	characterId?: CharacterId;
	alignment?: Alignment;
}

/** The longest character id a role carries; ids are short, homebrew ones included. */
const MAX_ROLE_ID = 80;

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
		if (truth.type === 'traveller') {
			// Nothing to tell until the Storyteller has chosen it.
			if (seat.alignment) roles[seatId] = { alignment: seat.alignment };
			continue;
		}
		const shows = shownBy.get(seatId);
		if (shows === undefined && standInKind(truth)) continue;
		const role: SeatRole = { characterId: shows ?? truth.id };
		if (seat.alignment && seat.alignment !== defaultAlignment(truth.type))
			role.alignment = seat.alignment;
		roles[seatId] = role;
	}
	return roles;
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

/**
 * Why a seat's player won't see a character on their phone when the Storyteller shows
 * them (Trevor, 2026-10-31: "should show some information if not all seats are filled, or
 * not all players have assigned characters"). `no-character`: the seat has none yet;
 * `withheld`: it has one the player must not see and no tile to say what they were shown;
 * `no-alignment`: a Traveller whose alignment isn't chosen; `no-phone`: no phone sits there.
 */
export type RoleGap = 'no-character' | 'withheld' | 'no-alignment' | 'no-phone';

/** Every seat whose player won't see a character, in seat order, with each reason. */
export function roleGaps(
	game: Game,
	characters: CharacterLookup,
	phoneSeats: ReadonlySet<SeatId>
): { seatId: SeatId; gaps: RoleGap[] }[] {
	const roles = seatRoles(game, characters);
	return game.seating.flatMap((seatId) => {
		const characterId = game.seats[seatId]?.characterId;
		const gaps: RoleGap[] = [];
		if (!characterId) gaps.push('no-character');
		else if (!roles[seatId])
			gaps.push(characters.get(characterId)?.type === 'traveller' ? 'no-alignment' : 'withheld');
		if (!phoneSeats.has(seatId)) gaps.push('no-phone');
		return gaps.length ? [{ seatId, gaps }] : [];
	});
}

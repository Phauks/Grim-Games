/**
 * The character a player is mad as, by a character's `madAs` rule (`data/mad-as-rules.ts`,
 * https://wiki.bloodontheclocktower.com/Madness), for the board's ! mark beside the mad
 * player's seat (Trevor, 2026-11-03, M36):
 * - `mad: "carrier"`: the player carrying the token is mad as the character recorded on it
 *   (`ReminderInstance.madAs`), chosen on the night step (the Cerenovus);
 * - `mad: "self"`: the token's own player is mad as the character of the player carrying it
 *   (the Pixie, shown an in-play Townsfolk).
 * The Storyteller judges whether madness was kept, so nothing here acts on its own.
 */
import type { MadAs } from '#lib/core/data/mad-as-rules.ts';
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { madAsPartners } from './jinx-effects.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** `characterId`'s `madAs` rule, if it has one. */
export function madAsRule(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): MadAs | undefined {
	return rulesFor(game, characterId, characters)?.madAs;
}

export interface MadAsMark {
	/** The character the player is mad as. */
	characterId: CharacterId;
	/** The character whose ability made them mad. */
	by: CharacterId;
	/** The token it is found by. */
	reminderId: ReminderId;
}

/** The characters the player in `seatId` is mad as, each with the token it is found by. */
export function madAsOf(game: Game, seatId: SeatId, characters: CharacterLookup): MadAsMark[] {
	const seat = game.seats[seatId];
	if (!seat) return [];
	const out: MadAsMark[] = [];
	for (const r of seat.reminders) {
		const rule = madAsRule(game, r.characterId, characters);
		if (rule?.mad === 'carrier' && r.label === rule.token && r.madAs !== undefined)
			out.push({ characterId: r.madAs, by: r.characterId, reminderId: r.reminderId });
	}
	const own = trueCharacter(game, seatId, characters);
	const rule = own === undefined ? undefined : madAsRule(game, own, characters);
	if (own !== undefined && rule?.mad === 'self') {
		for (const s of game.seating) {
			if (s === seatId) continue;
			const as = trueCharacter(game, s, characters);
			if (as === undefined) continue;
			for (const r of game.seats[s].reminders)
				if (
					r.characterId === own &&
					r.label === rule.token &&
					(r.ownerSeatId === undefined || r.ownerSeatId === seatId)
				)
					out.push({ characterId: as, by: own, reminderId: r.reminderId });
		}
	}
	return out;
}

export interface MadAsChoice {
	/** The types the character is chosen from, with the jinxed partners it may also be. */
	types: readonly CharacterType[];
	partners: CharacterId[];
	/** The token the choice is recorded on, once placed. */
	token?: { reminderId: ReminderId; seatId: SeatId; madAs?: CharacterId };
}

/**
 * What `by`'s night step records, when its rule has the carrier mad as a chosen character
 * (the Cerenovus): its placed token, and what the character may be chosen from.
 */
export function madAsChoice(
	game: Game,
	by: CharacterId,
	characters: CharacterLookup
): MadAsChoice | undefined {
	const rule = madAsRule(game, by, characters);
	if (rule?.mad !== 'carrier' || !rule.choose) return undefined;
	let token: MadAsChoice['token'];
	for (const seatId of game.seating)
		for (const r of game.seats[seatId].reminders)
			if (r.characterId === by && r.label === rule.token && token === undefined)
				token = { reminderId: r.reminderId, seatId, ...(r.madAs ? { madAs: r.madAs } : {}) };
	return {
		types: rule.choose,
		partners: [...new Set([...(rule.characters ?? []), ...madAsPartners(game, by, characters)])],
		...(token ? { token } : {})
	};
}

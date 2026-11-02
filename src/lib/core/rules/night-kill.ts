/**
 * What a killing character's step may do tonight, from its `kills` rule (`data/parts/kills.ts`)
 * and the tokens on the grimoire. A suggestion for the Storyteller, never a lock.
 * - `max`: how many players it may choose: `count` (1 when not given; the Shabaloth's 2), or
 *   `charged.count` while its `charged.token` is on its player (the Po, after choosing no one,
 *   attacks 3, https://wiki.bloodontheclocktower.com/Po), even after a night it did not wake;
 *   0 while another ability's token stops it waking or killing tonight (the Exorcist's Chosen,
 *   https://wiki.bloodontheclocktower.com/Exorcist; the Princess's Doesn't Kill).
 * - `delayed`: the players its earlier choice kills tonight, carrying its `delayed` token,
 *   who die even when it does not wake (the Pukka's Poisoned,
 *   https://wiki.bloodontheclocktower.com/Pukka); none while it is stopped from killing.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { stoppedWaking } from './woke-tonight.ts';

export interface NightKill {
	max: number;
	delayed: SeatId[];
}

/** What `holder`'s `characterId` step may kill tonight; undefined for a character that doesn't kill. */
export function nightKill(
	game: Game,
	holder: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): NightKill | undefined {
	const kills = rulesOf(characterId, characters)?.kills;
	if (!kills) return undefined;
	const seat = game.seats[holder];
	if (!seat) return undefined;
	const noKill = seat.reminders.some((r) => {
		const stops = rulesOf(r.characterId, characters)?.stopsKilling;
		return (
			stops?.token === r.label && (!stops.type || typeOf(game, holder, characters) === stops.type)
		);
	});
	const delayed =
		kills.delayed === undefined || noKill
			? []
			: game.seating.filter((s) =>
					game.seats[s].reminders.some(
						(r) => r.characterId === characterId && r.label === kills.delayed
					)
				);
	if (noKill || stoppedWaking(game, holder, characters)) return { max: 0, delayed };
	const charged =
		kills.charged !== undefined &&
		seat.reminders.some((r) => r.characterId === characterId && r.label === kills.charged!.token);
	return { max: charged ? kills.charged!.count : (kills.count ?? 1), delayed };
}

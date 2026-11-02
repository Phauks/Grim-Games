/**
 * Night alerts a jinx adds at its partner's step, for this character's player (owner's side
 * of the `jinxes` block, `data/jinx-rules.ts`):
 * - `wakes-with` (`wakesWithPartner`): the player wakes with the partner and learns whom it
 *   chooses (the Vizier with the Fearmonger,
 *   https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes);
 * - `keeps-protection` (`keepsProtection`): the partner's ability has taken this player's
 *   ability away, so they learn this, and their protection still holds (the Vizier with the
 *   Courtier and the Preacher still can't die by day).
 * The jinx itself applies each one, so they work whatever the owner's ability's state. Data
 * only, no wording: `NightAlerts.svelte` says them.
 */
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { ownJinxRules } from './jinxes.ts';
import type { NightAlert } from './night-alerts.ts';

/** The `wakes-with` and `keeps-protection` alerts at the step of `partner`, in seating order. */
export function jinxPartnerAlerts(
	game: Game,
	partner: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const out: NightAlert[] = [];
	for (const seatId of game.seating) {
		const owner = trueCharacter(game, seatId, characters);
		if (owner === undefined || game.seats[seatId].dead) continue;
		const rule = ownJinxRules(game, owner, partner, characters);
		if (!rule) continue;
		const state = abilityState(game, seatId, characters);
		const kinds: NightAlert['kind'][] = [];
		if (rule.wakesWithPartner) kinds.push('wakes-with');
		if (rule.keepsProtection && state.impairments.some((i) => i.source.characterId === partner))
			kinds.push('keeps-protection');
		const character = characters.get(owner);
		for (const kind of kinds)
			out.push({
				kind,
				seatId,
				source: { characterId: owner, seatId },
				works: true,
				impairments: [],
				...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
			});
	}
	return out;
}

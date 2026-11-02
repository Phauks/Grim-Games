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
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { ownJinxes, ownJinxRules } from './jinxes.ts';
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

/**
 * The alerts at `characterId`'s step that a jinx lets a player learn about a partner
 * (https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes), in seating order:
 * - `learns-no-ability` (`learnsNoAbility`): on the first night, the waking player learns the
 *   partner took their ability (the Engineer with Legion);
 * - `might-learn` (`partnerKeepsAbility`): one of this player's `impairs` tokens would reach
 *   a partner's player, who keeps their ability, so this player might learn the partner is in
 *   play; at this player's step and at the partner's (the Minstrel and the Preacher with
 *   Legion).
 */
export function jinxLearnAlerts(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const out: NightAlert[] = [];
	const alert = (
		kind: NightAlert['kind'],
		seatId: SeatId,
		owner: CharacterId,
		partner: CharacterId
	): NightAlert => {
		const character = characters.get(owner);
		return {
			kind,
			seatId,
			source: { characterId: owner, seatId },
			works: true,
			impairments: [],
			partner,
			...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
		};
	};
	for (const seatId of game.seating) {
		const owner = trueCharacter(game, seatId, characters);
		if (owner === undefined) continue;
		if (owner === characterId && game.pastDays.length === 0 && !game.seats[seatId].dead) {
			const impairs = abilityState(game, seatId, characters).impairments;
			const learns = ownJinxes(game, owner, (r) => r.learnsNoAbility === true, characters);
			for (const { partner } of learns)
				if (impairs.some((i) => i.source.characterId === partner))
					out.push(alert('learns-no-ability', seatId, owner, partner));
		}
		const spared = ownJinxes(game, owner, (r) => r.partnerKeepsAbility === true, characters);
		for (const { partner } of spared) {
			if (characterId !== owner && characterId !== partner) continue;
			if (wouldImpair(game, owner, partner, characters))
				out.push(alert('might-learn', seatId, owner, partner));
		}
	}
	return out;
}

/** Whether one of `owner`'s `impairs` tokens on the board would reach a `partner` player. */
function wouldImpair(
	game: Game,
	owner: CharacterId,
	partner: CharacterId,
	characters: CharacterLookup
): boolean {
	const tokens = rulesOf(owner, characters)?.impairs?.tokens ?? {};
	const partners = game.seating.filter((s) => trueCharacter(game, s, characters) === partner);
	return game.seating.some((on) =>
		game.seats[on].reminders.some((r) => {
			const rule = r.characterId === owner ? tokens[r.label] : undefined;
			if (!rule) return false;
			return rule.on === 'others' ? partners.some((p) => p !== on) : partners.includes(on);
		})
	);
}

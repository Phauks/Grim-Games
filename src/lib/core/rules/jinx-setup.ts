/**
 * What setup needs from a jinx on a character whose player gains another's ability
 * (`withPartnerAbility` in the character's own `jinxes` block, `data/jinx-rules.ts`): the
 * Alchemist-Summoner's [No Demon], and the Alchemist-Marionette with the real Marionette in
 * play (https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes).
 *
 * Which ability the player has is only chosen once the tokens are out (the Alchemist's
 * `setupPrep`), after the bag is built. So at the bag the jinx's change is a possibility:
 * its counts are allowed as well as the usual ones (`analyseSetup`'s `mayApply`), with a note
 * saying why, and nothing is required.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { WithPartnerAbility } from '#lib/core/data/jinx-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';

export interface AbilityJinxSetup {
	/** Setup changes that may apply through a chosen character (`SetupInput.mayApply`). */
	mayApply: { character: Character; as: string }[];
	/** Setup notes, "Alchemist with the Marionette ability: …". */
	notes: string[];
}

/** One chosen character's jinx with a partner on the script, by what it needs. */
interface Found {
	owner: Character;
	partner: Character;
	need: WithPartnerAbility;
}

/**
 * The `withPartnerAbility` jinxes in effect for the characters `chosen` for play, read from
 * each chosen character's own side, with each partner on the script (`scriptIds`).
 */
export function abilityJinxSetup(
	chosen: readonly CharacterId[],
	scriptIds: readonly CharacterId[],
	lookup: (id: CharacterId) => Character | undefined
): AbilityJinxSetup {
	const found: Found[] = [];
	for (const id of new Set(chosen)) {
		const owner = lookup(id);
		const jinxes = (owner?.rules ?? rulesOf(id))?.jinxes;
		if (!owner || !jinxes) continue;
		for (const [partnerId, rule] of Object.entries(jinxes)) {
			const partner = lookup(partnerId);
			if (!rule.withPartnerAbility || !partner || partnerId === id) continue;
			if (!scriptIds.includes(partnerId)) continue;
			found.push({ owner, partner, need: rule.withPartnerAbility });
		}
	}
	const as = ({ owner, partner }: Found) => `${owner.name} with the ${partner.name} ability`;
	return {
		mayApply: found
			.filter((f) => f.need === 'partner-setup')
			.map((f) => ({ character: f.partner, as: as(f) })),
		notes: found
			.filter((f) => f.need === 'partner-in-play')
			.map(
				(f) =>
					`${as(f)}: the ${f.partner.name} is in play too, and the ${f.owner.name} has no ability.`
			)
	};
}

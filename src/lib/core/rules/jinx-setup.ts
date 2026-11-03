/**
 * What setup needs from a jinx on a character whose player gains another's ability (its
 * `jinxes` effects for that player, `data/jinx-rules.ts`): `partnerSetup`, the
 * Alchemist-Summoner's [No Demon]; `partnerInPlay`, the real Marionette (Spy, Widow, Wraith,
 * Organ Grinder) in play too; `impairs` with `has-partner-ability`, the Alchemist-Mastermind
 * with no ability, or the Alchemist and the Organ Grinder both drunk while both are sober
 * (https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes).
 *
 * Which ability the player has is only chosen once the tokens are out (the Alchemist's
 * `setupPrep`), after the bag is built. So at the bag the jinx's change is a possibility:
 * its counts are allowed as well as the usual ones (`analyseSetup`'s `mayApply`), with a note
 * saying why, and nothing is required.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { JinxRules } from '#lib/core/data/jinx-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { pairView } from './jinxes.ts';
import { aboutHolder } from './jinx-when.ts';

export interface AbilityJinxSetup {
	/** Setup changes that may apply through a chosen character (`SetupInput.mayApply`). */
	mayApply: { character: Character; as: string }[];
	/** Setup notes, "Alchemist with the Marionette ability: …". */
	notes: string[];
}

/** One chosen character's jinx with a partner on the script. */
interface Found {
	owner: Character;
	partner: Character;
	rule: JinxRules;
}

const IS = { poisoned: 'is poisoned', drunk: 'is drunk', 'no-ability': 'has no ability' };

/**
 * The jinxes in effect for the characters `chosen` for play while their player has a
 * partner's ability, read for each chosen character from either file, with each partner on
 * the script (`scriptIds`).
 */
export function abilityJinxSetup(
	chosen: readonly CharacterId[],
	scriptIds: readonly CharacterId[],
	lookup: (id: CharacterId) => Character | undefined
): AbilityJinxSetup {
	const jinxesOf = (c: Character | undefined, id: CharacterId) => (c?.rules ?? rulesOf(id))?.jinxes;
	const found: Found[] = [];
	for (const id of new Set(chosen)) {
		const owner = lookup(id);
		if (!owner) continue;
		const own = Object.keys(jinxesOf(owner, id) ?? {});
		const named = scriptIds.filter((p) => jinxesOf(lookup(p), p)?.[id] !== undefined);
		for (const partnerId of new Set([...own, ...named])) {
			if (!scriptIds.includes(partnerId)) continue;
			const partner = partnerId === id ? undefined : lookup(partnerId);
			if (!partner) continue;
			const rule = pairView(jinxesOf(owner, id)?.[partnerId], jinxesOf(partner, partnerId)?.[id]);
			const held = rule?.impairs && aboutHolder(rule.impairs);
			if (rule && (rule.partnerSetup || rule.partnerInPlay || held))
				found.push({ owner, partner, rule });
		}
	}
	const as = ({ owner, partner }: Found) => `${owner.name} with the ${partner.name} ability`;
	return {
		mayApply: found
			.filter((f) => f.rule.partnerSetup)
			.map((f) => ({ character: f.partner, as: as(f) })),
		notes: found.flatMap((f) => {
			const said: string[] = [];
			if (f.rule.partnerInPlay) said.push(`the ${f.partner.name} is in play too`);
			const impairs = aboutHolder(f.rule.impairs) ? f.rule.impairs : undefined;
			if (impairs?.who === 'both' && impairs.unlessImpaired)
				said.push(`while both are sober, both are ${impairs.kind}`);
			else if (impairs) said.push(`the ${f.owner.name} ${IS[impairs.kind]}`);
			return said.length > 0 ? [`${as(f)}: ${said.join(', and ')}.`] : [];
		})
	};
}

import { obj, oneOf, opt, STR, STRS, T, variants, type SpecValue } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

export const DEATH_KINDS = ['kills', 'own-death', 'execution', 'gained-ability'] as const;
export type DeathKind = (typeof DEATH_KINDS)[number];

const VICTIM = variants(
	{
		label: 'Registers as',
		has: 'as',
		spec: obj({
			who: oneOf(['registers']),
			as: oneOf(['demon', 'not-demon', 'good', 'townsfolk']),
			notSelf: opt(T)
		})
	},
	{ label: 'Who', spec: obj({ who: oneOf(['self', 'not-self', 'alive-neighbour']) }) }
);

export type VictimRule = SpecValue<typeof VICTIM>;
/** What a `registers` victim rule needs the player to register as. */
export type RegistersAs = Extract<VictimRule, { who: 'registers' }>['as'];

/**
 * Whether a character's ability can cause a player to die, and how: the `deathCause` part of
 * its rules block, read here and used by `rules/death-causes.ts` so the death picker offers
 * only characters that could have caused the death.
 *
 * Kinds (`DEATH_KINDS`):
 * - `kills`: can kill a player, possibly including itself (Slayer, Witch, every Demon that
 *   kills, a Storyteller punishment such as the Angel's);
 * - `own-death`: can only cause its own player's death (Tinker, Gambler, Grandmother);
 * - `execution`: causes an execution or an extra one (Virgin, Butcher, Judge), or lets
 *   the Storyteller execute a player (Mutant, Cerenovus);
 * - `gained-ability`: causes a death only through another character's ability it has or
 *   gives (Philosopher, Pixie, Hermit, Plague Doctor), or the ability the Storyteller chose
 *   for it (Amnesiac). The death is recorded as this character's; once the ability it holds
 *   is known (`gainedFrom`, or `givesAbility` to `self`), that ability's rule says who it can
 *   kill (`rules/death-causes.ts`).
 *
 * `onlyWith`: the rule applies only when one of these characters is also on the script or in
 * play (a jinx gives the ability its death).
 *
 * `afterChanging`: the rule applies only once a player this character changed (`Seat.changedBy`)
 * is of this character type: the Pit-Hag's extra deaths once it has made a Demon
 * (https://wiki.bloodontheclocktower.com/Pit-Hag).
 *
 * `victim`: who the ability can kill, when that is narrower than any player (`own-death`
 * needs none: it only ever kills its own player):
 * - `self`: only its own player (the Mutant and Scapegoat are the ones executed);
 * - `not-self`: anyone but its own player (the Boomdandy is executed, the others die; the
 *   Vizier cannot die during the day);
 * - `alive-neighbour`: an alive neighbour of its player (the Gangster);
 * - `registers`: the player must be, or register as, this. `notSelf` also rules out its own
 *   player (the Moonchild is already dead when it chooses).
 *
 * `none`: why the ability never causes a death, in a few of our own words, so the picker
 * knows it has been checked and does not offer it. A character with neither is offered as
 * `unknown` (a Demon as `kills`).
 *
 * The kinds are our reading of TPI's ability text and the character's wiki page.
 */
export const deathCause = specPart(
	'Death cause',
	'Whether and how its ability can cause a death.',
	variants(
		{ label: 'None', has: 'none', spec: obj({ none: STR }) },
		{
			label: 'Causes a death',
			has: 'kind',
			spec: obj({
				kind: oneOf(DEATH_KINDS),
				onlyWith: opt(STRS),
				afterChanging: opt(oneOf(SEATED_TYPES)),
				victim: opt(VICTIM)
			})
		}
	)
);

export type DeathCauseRule = PartValue<typeof deathCause>;

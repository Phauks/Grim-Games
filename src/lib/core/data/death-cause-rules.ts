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
 *   gives (Philosopher, Pixie, Hermit, Plague Doctor).
 *
 * `onlyWith`: the rule applies only when one of these characters is also on the script or in
 * play (a jinx gives the ability its death).
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
import type { CharacterId } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readEnum,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

export const DEATH_KINDS = ['kills', 'own-death', 'execution', 'gained-ability'] as const;
export type DeathKind = (typeof DEATH_KINDS)[number];

const VICTIMS = ['self', 'not-self', 'alive-neighbour', 'registers'] as const;
const REGISTERS_AS = ['demon', 'not-demon', 'good', 'townsfolk'] as const;

export type VictimRule =
	| { who: 'self' }
	| { who: 'not-self' }
	| { who: 'alive-neighbour' }
	| { who: 'registers'; as: (typeof REGISTERS_AS)[number]; notSelf?: true };

export type DeathCauseRule =
	{ kind: DeathKind; onlyWith?: readonly CharacterId[]; victim?: VictimRule } | { none: string };

function readVictim(raw: unknown, path: string, issues: Issues): VictimRule | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const who = readEnum(raw, 'who', VICTIMS, path, issues, true);
	checkKeys(raw, who === 'registers' ? ['who', 'as', 'notSelf'] : ['who'], path, issues);
	if (who !== 'registers') return who ? { who } : undefined;
	const as = readEnum(raw, 'as', REGISTERS_AS, path, issues, true);
	if (raw.notSelf !== undefined && raw.notSelf !== true) {
		issues.add(`${path}.notSelf`, 'expected true');
	}
	return as ? { who, as, ...(raw.notSelf === true ? { notSelf: true as const } : {}) } : undefined;
}

/** Reads a `deathCause` block. */
export function readDeathCause(
	raw: unknown,
	path: string,
	issues: Issues
): DeathCauseRule | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	if (raw.none !== undefined) {
		checkKeys(raw, ['none'], path, issues);
		const none = readString(raw, 'none', path, issues, true);
		return none === undefined ? undefined : { none };
	}
	checkKeys(raw, ['kind', 'onlyWith', 'victim'], path, issues);
	const kind = readEnum(raw, 'kind', DEATH_KINDS, path, issues, true);
	const onlyWith = readStringArray(raw, 'onlyWith', path, issues);
	const victim =
		raw.victim === undefined ? undefined : readVictim(raw.victim, `${path}.victim`, issues);
	if (!kind) return undefined;
	return { kind, ...(onlyWith ? { onlyWith } : {}), ...(victim ? { victim } : {}) };
}

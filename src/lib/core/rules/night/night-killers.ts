/**
 * Which night steps can kill and whose abilities a death sets off: `kills` and `onDeath` in a
 * character's rules block (our `data/rules/<id>.json`, or a custom character's `rules`), read
 * for the night step's alerts (`night-alerts.ts`) and the death steps.
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { DeathCause, Game } from '#lib/core/model/types.ts';
import { isExecution } from '#lib/core/rules/abilities/death-causes.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** Who a killing step's ability is: the Demon's kill, or another ability's. */
export type KillBy = 'demon' | 'other';

export interface NightKiller {
	by: KillBy;
	/** `self`: the ability can only kill its own player (the Gambler, the Acrobat). */
	targets: 'any' | 'self';
	/** The Assassin's kill ignores protection. */
	ignoresProtection: boolean;
}

/**
 * Whether `characterId`'s night step can kill, and how (`kills` in its rules block: our
 * `data/rules/<id>.json`, or a custom character's `rules`). Every Demon kills at night except
 * the Riot and the Leviathan, whose deaths happen by day.
 */
export function nightKiller(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightKiller | undefined {
	const kills = rulesFor(game, characterId, characters)?.kills;
	return (
		kills && {
			by: kills.by,
			targets: kills.targets ?? 'any',
			ignoresProtection: kills.ignoresProtection ?? false
		}
	);
}

/**
 * Whether `characterId`'s ability is set off by its player's death, and by which deaths
 * (`onDeath` in its rules block: our `data/rules/<id>.json`, or a custom character's `rules`).
 */
export function onDeathTrigger(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): { by: KillBy | 'any'; night?: true; places?: ReminderLabel; placesOn?: 'chosen' } | undefined {
	return rulesFor(game, characterId, characters)?.onDeath;
}

/**
 * Whether a death of this `cause` sets off the trigger: `by` the Demon only for a Demon's kill
 * (the Sage, https://wiki.bloodontheclocktower.com/Sage; the Banshee,
 * https://wiki.bloodontheclocktower.com/Banshee), and with `night` never an execution or exile
 * (the Ravenkeeper, https://wiki.bloodontheclocktower.com/Ravenkeeper: "getting killed during
 * the day reveals nothing"; the Farmer). A death whose cause was not recorded counts, so the
 * Storyteller is still shown the step (warn, never lock).
 */
export function onDeathApplies(
	game: Game,
	trigger: { by: KillBy | 'any'; night?: true },
	cause: DeathCause | undefined,
	characters: CharacterLookup
): boolean {
	if (cause === undefined) return true;
	const executed = cause === 'exile' || isExecution(game, cause, characters);
	if (trigger.night && executed) return false;
	if (trigger.by === 'any') return true;
	const byDemon = cause === 'demon' || characters.get(cause)?.type === 'demon';
	return trigger.by === 'demon' ? byDemon : !byDemon && !executed;
}

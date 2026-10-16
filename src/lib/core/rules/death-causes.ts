/**
 * Characters that can cause a death, for the death-cause picker: the script's characters
 * whose ability can kill, cause their own death or cause an execution, plus any such
 * character in play off the script (Travellers, Fabled and Loric can join any game).
 *
 * The data is `death-causes.data.ts`. Returns data only; the UI words it. The picker's
 * general causes (executed, the Demon, something else) are `GENERAL_DEATH_CAUSES`.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	charactersInPlay,
	getSeat,
	isTraveller,
	registersAsDead,
	trueCharacter
} from '#lib/core/model/selectors.ts';
import {
	GENERAL_DEATH_CAUSES,
	type DeathCause,
	type Game,
	type SeatId
} from '#lib/core/model/types.ts';
import {
	abilityState,
	registrations,
	registrationWorlds,
	type AbilitySource,
	type RegistrationWorld
} from './ability.ts';
import {
	DEATH_CAUSE_ENTRIES,
	DEATH_KINDS,
	NO_DEATH,
	VICTIM_RULES,
	type DeathCauseEntry,
	type DeathKind,
	type VictimRule
} from './death-causes.data.ts';

export { DEATH_CAUSE_ENTRIES, DEATH_KINDS, NO_DEATH, VICTIM_RULES };
export type { DeathCauseEntry, DeathKind, VictimRule };

/**
 * One character the picker can offer. `kind` is `unknown` for a character not in our data
 * (homebrew), except a Demon, which is taken to kill.
 */
export interface DeathCauseOption {
	characterId: CharacterId;
	kind: DeathKind | 'unknown';
}

/** The data entry for an official character that can cause a death, if any. */
export function deathCauseEntry(id: CharacterId): DeathCauseEntry | undefined {
	return Object.hasOwn(DEATH_CAUSE_ENTRIES, id) ? DEATH_CAUSE_ENTRIES[id] : undefined;
}

/**
 * The characters that can cause a death: those on the script in script order, then those
 * in `inPlay` that are not on the script (a Traveller in play, the Fabled and Loric in
 * play), in that order, each once.
 */
export function deathCauses(
	scriptIds: Iterable<CharacterId>,
	characters: CharacterLookup,
	inPlay: Iterable<CharacterId> = []
): DeathCauseOption[] {
	const ids = [...new Set([...scriptIds, ...inPlay])];
	const present = new Set(ids);
	const out: DeathCauseOption[] = [];
	for (const id of ids) {
		const entry = deathCauseEntry(id);
		if (entry) {
			if (!entry.onlyWith || entry.onlyWith.some((other) => present.has(other))) {
				out.push({ characterId: id, kind: entry.kind });
			}
		} else if (!Object.hasOwn(NO_DEATH, id)) {
			const type = characters.get(id)?.type;
			if (type !== undefined) {
				out.push({ characterId: id, kind: type === 'demon' ? 'kills' : 'unknown' });
			}
		}
	}
	return out;
}

/** `deathCauses` for a game: its script, the characters on seats and the Fabled and Loric. */
export function gameDeathCauses(game: Game, characters: CharacterLookup): DeathCauseOption[] {
	return deathCauses(scriptCharacterIds(game.script), characters, [
		...charactersInPlay(game),
		...game.ruleCharacters
	]);
}

// ── Valid causes for one player ─────────────────────────────────────────────

/**
 * Why a cause is offered with a caution rather than plainly:
 * - `registers`: only if the player registered falsely (a Recluse as the Demon for the
 *   Slayer, a Spy as a Townsfolk for the Virgin), by `source`'s ability;
 * - `impaired`: every player who has the character is drunk, poisoned or without ability
 *   now, so it did nothing unless that was not so when the player died;
 * - `unknown`: the player's alignment or character is not set, so the rule cannot be checked.
 */
export type DeathCauseFlag =
	| { code: 'registers'; source: AbilitySource; wiki: string }
	| { code: 'impaired'; seatIds: SeatId[] }
	| { code: 'unknown' };

export interface ValidDeathCause {
	cause: DeathCause;
	/** `general` for executed, exiled and the Demon. */
	kind: DeathKind | 'unknown' | 'general';
	flags: DeathCauseFlag[];
}

/**
 * The causes of death that are valid for this player given the grimoire, in picker order:
 * executed (exiled for a Traveller), the Demon, then the characters that could have killed
 * them (script order). "Something else" is not offered (Trevor, 2026-10-16); a cause stays
 * optional, and saved games may still hold 'other'.
 *
 * A character is left out when no player has it (true character, so a Drunk shown as the
 * Slayer is not one) and it is not a Fabled or Loric in play; when it only kills its own
 * player and this is someone else; and when its `VICTIM_RULES` rule fails however anyone
 * registers. Demons are left out: "the Demon" covers them. A rule that holds only through
 * a false registration, a character whose players are all impaired now, and a player
 * whose alignment or character is unset give flagged entries instead.
 */
export function validDeathCauses(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): ValidDeathCause[] {
	const [execution, demon, , exile] = GENERAL_DEATH_CAUSES;
	const general = (cause: DeathCause): ValidDeathCause => ({ cause, kind: 'general', flags: [] });
	if (!getSeat(game, seatId)) return [];

	const regs = registrations(game, characters);
	let worlds: RegistrationWorld[] | undefined;
	// Travellers are exiled, not executed (Trevor, 2026-10-16;
	// https://wiki.bloodontheclocktower.com/Exile).
	const removed = isTraveller(game, seatId, characters) ? exile : execution;
	const out: ValidDeathCause[] = [general(removed), general(demon)];

	for (const { characterId, kind } of gameDeathCauses(game, characters)) {
		if (characters.get(characterId)?.type === 'demon') continue;
		const holders = game.seating.filter((s) => trueCharacter(game, s, characters) === characterId);
		if (holders.length === 0 && !game.ruleCharacters.includes(characterId)) continue;

		const rule: VictimRule | undefined =
			kind === 'own-death' ? { victim: 'self' } : VICTIM_RULES[characterId];
		const acting = holders.filter((h) => holderFits(game, rule, h, seatId));
		if (holders.length > 0 && acting.length === 0) continue;

		const flags: DeathCauseFlag[] = [];
		if (rule?.victim === 'registers') {
			worlds ??= registrationWorlds(game, characters, regs);
			const verdict = registersAs(game, seatId, rule.as, worlds);
			if (verdict === 'never') continue;
			if (verdict === 'unknown') flags.push({ code: 'unknown' });
			if (verdict === 'falsely') {
				const reg = regs.find((r) => r.seatId === seatId);
				if (reg) flags.push({ code: 'registers', source: reg.source, wiki: reg.wiki });
			}
		}
		if (
			acting.length > 0 &&
			acting.every((h) => abilityState(game, h, characters).impairments.length > 0)
		) {
			flags.push({ code: 'impaired', seatIds: acting });
		}
		out.push({ cause: characterId, kind, flags });
	}
	return out;
}

/** Whether the player with the character at `holder` could have killed `victim`. */
function holderFits(
	game: Game,
	rule: VictimRule | undefined,
	holder: SeatId,
	victim: SeatId
): boolean {
	switch (rule?.victim) {
		case undefined:
			return true;
		case 'self':
			return holder === victim;
		case 'not-self':
			return holder !== victim;
		case 'registers':
			return !rule.notSelf || holder !== victim;
		case 'alive-neighbour':
			// Neighbours as they were before the victim died.
			return aliveNeighbours(
				game,
				holder,
				(s) => s !== victim && registersAsDead(game, s)
			).includes(victim);
	}
}

/**
 * Whether the player is (`truly`), could register as (`falsely`) or cannot be (`never`)
 * what the rule needs, or `unknown` when their alignment or character is not set. A player
 * babysitting Lil' Monsta ("Is The Demon") is the Demon
 * (https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
 */
function registersAs(
	game: Game,
	seatId: SeatId,
	as: 'demon' | 'not-demon' | 'good' | 'townsfolk',
	worlds: readonly RegistrationWorld[]
): 'truly' | 'falsely' | 'never' | 'unknown' {
	const babysitter = getSeat(game, seatId)?.reminders.some(
		(r) => r.characterId === 'lilmonsta' && r.label === 'Is The Demon'
	);
	const test = (world: RegistrationWorld): boolean | undefined => {
		if (as === 'good') {
			const alignment = world.alignment(seatId);
			return alignment === undefined ? undefined : alignment === 'good';
		}
		const type = world.type(seatId);
		if (as === 'townsfolk') return type === undefined ? undefined : type === 'townsfolk';
		const isDemon = babysitter || (type === undefined ? undefined : type === 'demon');
		if (isDemon === undefined) return undefined;
		return as === 'demon' ? isDemon : !isDemon;
	};
	const first = test(worlds[0]);
	if (first === undefined) return 'unknown';
	if (first) return 'truly';
	return worlds.some((w) => test(w)) ? 'falsely' : 'never';
}

/**
 * Characters that can cause a death, for the death-cause picker: the script's characters
 * whose ability can kill, cause their own death or cause an execution, plus any such
 * character in play off the script (Travellers, Fabled and Loric can join any game).
 *
 * The data is each character's `deathCause` rule (`data/death-cause-rules.ts`). Returns data only; the UI words it. The picker's
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
import { gainedAbilities } from './gained-abilities.ts';
import {
	DEATH_KINDS,
	type DeathCauseRule,
	type DeathKind,
	type VictimRule
} from '#lib/core/data/death-cause-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';

export { DEATH_KINDS };
export type { DeathCauseRule, DeathKind, VictimRule };

/** A `deathCause` rule for a character whose ability can cause a death. */
export type DeathCauseEntry = Extract<DeathCauseRule, { kind: DeathKind }>;

/**
 * One character the picker can offer. `kind` is `unknown` for a character not in our data
 * (homebrew), except a Demon, which is taken to kill.
 */
export interface DeathCauseOption {
	characterId: CharacterId;
	kind: DeathKind | 'unknown';
}

/** A character's `deathCause` rule: its own (a custom character's) or our overlay file's. */
export function deathCauseRule(
	id: CharacterId,
	characters?: CharacterLookup
): DeathCauseRule | undefined {
	return rulesOf(id, characters)?.deathCause;
}

/** The `deathCause` rule of a character that can cause a death, if any. */
export function deathCauseEntry(
	id: CharacterId,
	characters?: CharacterLookup
): DeathCauseEntry | undefined {
	const rule = deathCauseRule(id, characters);
	return rule && 'kind' in rule ? rule : undefined;
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
		const rule = deathCauseRule(id, characters);
		if (rule && 'kind' in rule) {
			if (!rule.onlyWith || rule.onlyWith.some((other) => present.has(other))) {
				out.push({ characterId: id, kind: rule.kind });
			}
		} else if (!rule) {
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

/**
 * The cause a reminder gives the death it marks: its own character, when that character can
 * cause a death in this game (Trevor, 2026-10-23: the Fang Gu's "Dead" on a player "should know
 * the token caused the death"). Undefined for the ∞ reminder, a character whose ability never
 * kills, or a homebrew one we know nothing about.
 */
export function reminderDeathCause(
	game: Game,
	characters: CharacterLookup,
	characterId: CharacterId
): CharacterId | undefined {
	const option = gameDeathCauses(game, characters).find((o) => o.characterId === characterId);
	return option && option.kind !== 'unknown' ? option.characterId : undefined;
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
	/**
	 * For a character that kills only through an ability it gained (Cannibal, Pixie,
	 * Philosopher): the character whose ability it has, shown beside it.
	 */
	gained?: CharacterId;
	flags: DeathCauseFlag[];
}

/**
 * Characters whose deaths come only from the ability they gained, which the grimoire shows:
 * - Cannibal: the executee carrying its Lunch reminder
 *   (https://wiki.bloodontheclocktower.com/Cannibal: the ability of the player who last died
 *   by execution);
 * - Pixie: the Townsfolk whose ability it has once "Has Ability" is placed
 *   (https://wiki.bloodontheclocktower.com/Pixie, `gainedAbilities`);
 * - Philosopher: the token it was swapped for ("Is The Philosopher"), or the player its
 *   Drunk reminder is on (https://wiki.bloodontheclocktower.com/Philosopher).
 * Without that, they are not offered (Trevor, 2026-10-17: the Cannibal can't kill unless
 * the ability it gained can).
 */
const GAINED_FROM: Readonly<
	Record<
		CharacterId,
		(game: Game, holder: SeatId, characters: CharacterLookup) => CharacterId | undefined
	>
> = {
	cannibal: (game, _holder, characters) => {
		const lunch = game.seating.find((s) =>
			game.seats[s].reminders.some((r) => r.characterId === 'cannibal' && r.label === 'Lunch')
		);
		return lunch === undefined ? undefined : trueCharacter(game, lunch, characters);
	},
	pixie: (game, holder) =>
		gainedAbilities(game).find((g) => g.seatId === holder && g.status === 'has-ability')
			?.characterId,
	philosopher: (game, holder, characters) => {
		const token = game.seats[holder].characterId;
		if (token !== undefined && token !== 'philosopher') return token;
		const drunk = game.seating.find((s) =>
			game.seats[s].reminders.some((r) => r.characterId === 'philosopher' && r.label === 'Drunk')
		);
		return drunk === undefined ? undefined : trueCharacter(game, drunk, characters);
	}
};

/**
 * The causes of death that are valid for this player given the grimoire, in picker order:
 * executed (exiled for a Traveller), the Demon, then the characters that could have killed
 * them (script order). "Something else" is not offered (Trevor, 2026-10-16); a cause stays
 * optional, and saved games may still hold 'other'.
 *
 * A character is left out when no player has it (true character, so a Drunk shown as the
 * Slayer is not one) and it is not a Fabled or Loric in play; when it only kills its own
 * player and this is someone else; and when its `deathCause.victim` rule fails however anyone
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

		// A gained ability: the rules of the character it came from.
		const from = Object.hasOwn(GAINED_FROM, characterId) ? GAINED_FROM[characterId] : undefined;
		const gainedBy = new Map<SeatId, CharacterId>();
		for (const h of from ? holders : []) {
			const id = from!(game, h, characters);
			const entry = id === undefined ? undefined : deathCauseEntry(id, characters);
			if (id !== undefined && entry && entry.kind !== 'gained-ability') gainedBy.set(h, id);
		}
		if (from && gainedBy.size === 0) continue;
		const ruleFor = (h: SeatId): VictimRule | undefined => {
			const id = gainedBy.get(h) ?? characterId;
			const k = gainedBy.has(h) ? deathCauseEntry(id, characters)!.kind : kind;
			return k === 'own-death' ? { who: 'self' } : deathCauseEntry(id, characters)?.victim;
		};
		const acting = holders.filter(
			(h) => (!from || gainedBy.has(h)) && holderFits(game, ruleFor(h), h, seatId)
		);
		if (holders.length > 0 && acting.length === 0) continue;
		const gained = acting.length > 0 ? gainedBy.get(acting[0]) : undefined;
		const rule = acting.length > 0 ? ruleFor(acting[0]) : ruleFor(holders[0]);

		const flags: DeathCauseFlag[] = [];
		if (rule?.who === 'registers') {
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
		out.push({ cause: characterId, kind, ...(gained ? { gained } : {}), flags });
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
	switch (rule?.who) {
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

/**
 * Abilities a player has from another player's character, by the `gainedFrom` rule of their
 * own character (`data/gained-from-rules.ts`). The Pixie
 * (https://wiki.bloodontheclocktower.com/Pixie), for one:
 * - the Pixie starts knowing an in-play Townsfolk, marked "Mad";
 * - when that player dies, and the Storyteller judges the Pixie was mad about being that
 *   character, the Storyteller swaps "Mad" for "Has Ability": the Pixie now has the
 *   Townsfolk's ability and wakes when that Townsfolk would normally wake (the wiki's How to
 *   Run, which puts the step at the gained character's place in the night order).
 *
 * Until "Has Ability" is placed the step is still shown, at the same place, marked
 * `if-mad`: the Storyteller makes the madness call there (swap Mad for Has Ability, or not).
 *
 * A player also has the abilities they hold without a token (`Seat.abilities`), given by
 * another character's `givesAbility` rule: the Boffin's good ability on the Demon, who
 * wakes when that good character would (https://wiki.bloodontheclocktower.com/Boffin). And
 * those their own character's `givesAbility` gives them from the script (`ownHeld`): the
 * Hermit has every other Outsider on the script, waking as each would and keeping after death
 * only those that work even if dead (https://wiki.bloodontheclocktower.com/Hermit).
 */
import type { GainedFrom } from '#lib/core/data/gained-from-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { scriptCharacterIds } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, HeldAbility, SeatId } from '#lib/core/model/types.ts';
import { abilityState, worksWhenDead } from './ability.ts';
import type { Night, NightStep } from './night-order.ts';

export interface GainedAbility {
	/** The player who gains the ability (the Pixie). */
	seatId: SeatId;
	/** The character whose ability they gain. */
	characterId: CharacterId;
	/** The character whose ability grants it. */
	via: CharacterId;
	/** The player whose character it was; unset for a swapped token. */
	fromSeat?: SeatId;
	/** `has-ability`: the Storyteller placed "Has Ability"; `if-mad`: still their call. */
	status: 'has-ability' | 'if-mad';
	/**
	 * Set on a night step when the gained character has no text for this night and its
	 * first-night text is used: a "you start knowing" ability gives its information the
	 * night it is gained (the Pixie's Washerwoman example on the wiki).
	 */
	firstNightText?: boolean;
}

/**
 * The ability `holder` has by `via`'s `gainedFrom` rule: their swapped token, the true
 * character of the player carrying its `token`, or, while that is unplaced, of a dead player
 * carrying its `pending` token (`if-mad`).
 */
export function gainedBy(
	game: Game,
	holder: SeatId,
	via: CharacterId,
	rule: GainedFrom,
	characters: CharacterLookup
): Omit<GainedAbility, 'seatId' | 'via'> | undefined {
	const token = game.seats[holder]?.characterId;
	if (rule.swapped && token !== undefined && token !== via)
		return { characterId: token, status: 'has-ability' };
	const carrier = (label: string) =>
		game.seating.find((s) =>
			game.seats[s].reminders.some((r) => r.characterId === via && r.label === label)
		);
	const has = carrier(rule.token);
	const pending = rule.pending === undefined ? undefined : carrier(rule.pending);
	const from = has ?? (pending !== undefined && game.seats[pending].dead ? pending : undefined);
	const characterId = from === undefined ? undefined : trueCharacter(game, from, characters);
	if (from === undefined || characterId === undefined) return undefined;
	return { characterId, fromSeat: from, status: has !== undefined ? 'has-ability' : 'if-mad' };
}

/**
 * Whether `holder` has the ability held by `via`'s `givesAbility` rule now: they are still
 * who it goes to (the Demon), and, for `whileWorks`, a player of `via` has a working ability
 * (a drunk, poisoned or dead Boffin takes it away for as long as that lasts).
 */
export function holdsAbility(
	game: Game,
	holder: SeatId,
	held: HeldAbility,
	characters: CharacterLookup
): boolean {
	const rule = rulesOf(held.via, characters)?.givesAbility;
	if (rule?.to === 'self') {
		// Their own ability gives it: while it works, and after death only an ability that
		// works even if dead.
		const seat = game.seats[holder];
		if (seat?.characterId !== held.via) return false;
		const state = abilityState(game, holder, characters);
		return (
			state.impairments.length === 0 && (!seat.dead || worksWhenDead(held.characterId, characters))
		);
	}
	if (rule?.to !== 'demon' || typeOf(game, holder, characters) !== 'demon') return false;
	if (!rule.whileWorks) return true;
	return game.seating.some(
		(s) =>
			trueCharacter(game, s, characters) === held.via && abilityState(game, s, characters).works
	);
}

/**
 * Every living player's gained (or about to be gained) ability that wakes them. They wake by
 * the token they hold (a Drunk who thinks they are the Pixie too). Abilities held without a
 * token (`Seat.abilities`) follow, while `holdsAbility`.
 */
export function gainedAbilities(game: Game, characters: CharacterLookup): GainedAbility[] {
	const out: GainedAbility[] = [];
	for (const seatId of game.seating) {
		const via = game.seats[seatId].characterId;
		if (via === undefined || game.seats[seatId].dead) continue;
		const rule = rulesOf(via, characters)?.gainedFrom;
		if (!rule?.wakes) continue;
		const gained = gainedBy(game, seatId, via, rule, characters);
		if (!gained) continue;
		out.push({ seatId, via, ...gained });
	}
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		if (seat.dead) continue;
		for (const held of allHeld(game, seatId, characters)) {
			if (!holdsAbility(game, seatId, held, characters)) continue;
			out.push({ seatId, via: held.via, characterId: held.characterId, status: 'has-ability' });
		}
	}
	return out;
}

/**
 * Adds a step for each gained ability, right after the gained character's own step, with
 * that character's night text. A character not in play (the Boffin's) has no step of its
 * own, so its step goes where `order` (the night sheet's ids for tonight) puts it; with no
 * place there, just before Dawn. A gained
 * ability with no night text adds nothing. The step keeps the gaining character (the Pixie) as
 * its character, with `gained` saying whose ability it is and whether it is still `if-mad`.
 */
export function withGainedSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night,
	order: readonly string[] = []
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	// Before the first step the sheet puts after `id`.
	const bySheet = (id: string) => {
		const at = order.indexOf(id);
		if (at < 0) return -1;
		return out.findIndex((s) => order.indexOf(s.id) > at);
	};
	for (const gained of gainedAbilities(game, characters)) {
		// The step is the holder's own token's: the Pixie's, or the Demon holding the Boffin's.
		const token = game.seats[gained.seatId]?.characterId;
		const via = characters.get(token ?? gained.via);
		const as: Character | undefined = characters.get(gained.characterId);
		if (!via || !as) continue;
		const own = night === 'first' ? as.firstNightReminder : as.otherNightReminder;
		const reminder = own ?? (night === 'other' ? as.firstNightReminder : undefined);
		if (reminder === undefined) continue;
		const step: NightStep = {
			id: `${gained.via}@${gained.seatId}:${gained.characterId}`,
			kind: 'character',
			character: via,
			reminder,
			afterDawn: false,
			placement: 'night-sheet',
			notes: [],
			gained: own === undefined ? { ...gained, firstNightText: true } : gained
		};
		const anchor = out.findIndex((s) => s.id === gained.characterId);
		const placed = anchor >= 0 ? anchor + 1 : bySheet(gained.characterId);
		const dawn = out.findIndex((s) => s.id === 'dawn');
		const at = placed >= 0 ? placed : dawn >= 0 ? dawn : out.length;
		out.splice(at, 0, step);
	}
	return out;
}

/**
 * The characters in play whose `givesAbility` goes to `seatId` (the Boffin's, while it is
 * the Demon; the seat's own, to `self` with nothing on the script to give: the Amnesiac's), so
 * its ⋯ menu offers to pick that ability.
 */
export function abilityGivers(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId[] {
	const givers = new Set<CharacterId>();
	for (const s of game.seating) {
		const id = trueCharacter(game, s, characters);
		const rule = id === undefined ? undefined : rulesOf(id, characters)?.givesAbility;
		if (!id || !rule) continue;
		if (rule.to === 'demon' && typeOf(game, seatId, characters) === 'demon') givers.add(id);
		if (rule.to === 'self' && !rule.onScript && s === seatId) givers.add(id);
	}
	return [...givers];
}

/**
 * The abilities `seatId`'s own character gives it from the script, by a `givesAbility` to
 * `self` with `onScript`: every other character of its types there (the Hermit's Outsiders).
 */
function ownHeld(game: Game, seatId: SeatId, characters: CharacterLookup): HeldAbility[] {
	const via = game.seats[seatId]?.characterId;
	const rule = via === undefined ? undefined : rulesOf(via, characters)?.givesAbility;
	if (via === undefined || rule?.to !== 'self' || !rule.onScript) return [];
	const types: readonly string[] = rule.types;
	return scriptCharacterIds(game.script)
		.filter((id) => id !== via && types.includes(characters.get(id)?.type ?? ''))
		.map((characterId) => ({ characterId, via }));
}

/** Every ability `seatId` holds without a token: picked for it, then its own. */
function allHeld(game: Game, seatId: SeatId, characters: CharacterLookup): HeldAbility[] {
	return [...(game.seats[seatId]?.abilities ?? []), ...ownHeld(game, seatId, characters)];
}

/** The abilities `seatId` holds without a token, each with whether they have it now. */
export function heldAbilitiesOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): (HeldAbility & { works: boolean })[] {
	return allHeld(game, seatId, characters).map((held) => ({
		...held,
		works: holdsAbility(game, seatId, held, characters)
	}));
}

/**
 * Adds a step for each ability the Storyteller holds (the Plague Doctor's Minion), with that
 * Minion's night text: right after the Minion's own step when it is in play too, else where
 * `order` (the night sheet's ids for tonight) puts it, else just before Dawn. The Storyteller
 * makes its choices (the Plague Doctor's How to Run); it wakes nobody.
 */
export function withStorytellerSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night,
	order: readonly string[] = []
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	for (const held of game.storytellerAbilities ?? []) {
		const as = characters.get(held.characterId);
		const reminder = as && (night === 'first' ? as.firstNightReminder : as.otherNightReminder);
		if (!as || reminder === undefined) continue;
		const step: NightStep = {
			id: `storyteller:${held.via}:${held.characterId}`,
			kind: 'character',
			character: as,
			reminder,
			afterDawn: false,
			placement: 'night-sheet',
			notes: ['The Storyteller makes this choice; nobody wakes.'],
			storytellerAbility: held
		};
		const own = out.findIndex((s) => s.id === held.characterId);
		const at = order.indexOf(held.characterId);
		const later = at < 0 ? -1 : out.findIndex((s) => order.indexOf(s.id) > at);
		const dawn = out.findIndex((s) => s.id === 'dawn');
		const placed = own >= 0 ? own + 1 : later >= 0 ? later : dawn >= 0 ? dawn : out.length;
		out.splice(placed, 0, step);
	}
	return out;
}

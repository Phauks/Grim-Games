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
 */
import type { GainedFrom } from '#lib/core/data/gained-from-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
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
 * Every living player's gained (or about to be gained) ability that wakes them. They wake by
 * the token they hold (a Drunk who thinks they are the Pixie too).
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
	return out;
}

/**
 * Adds a step for each gained ability, right after the gained character's own step (or
 * just before Dawn when it has none tonight), with that character's night text. A gained
 * ability with no night text adds nothing. The step keeps the gaining character (the Pixie) as
 * its character, with `gained` saying whose ability it is and whether it is still `if-mad`.
 */
export function withGainedSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	for (const gained of gainedAbilities(game, characters)) {
		const via = characters.get(gained.via);
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
		const dawn = out.findIndex((s) => s.id === 'dawn');
		const at = anchor >= 0 ? anchor + 1 : dawn >= 0 ? dawn : out.length;
		out.splice(at, 0, step);
	}
	return out;
}

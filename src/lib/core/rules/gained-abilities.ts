/**
 * Abilities a player gains from another character during the game, and the night steps
 * they add. Today this is the Pixie (https://wiki.bloodontheclocktower.com/Pixie):
 * - the Pixie starts knowing an in-play Townsfolk, marked "Mad";
 * - when that player dies, and the Storyteller judges the Pixie was mad about being that
 *   character, the Storyteller swaps "Mad" for "Has Ability": the Pixie now has the
 *   Townsfolk's ability and wakes when that Townsfolk would normally wake (the wiki's How to
 *   Run, which puts the step at the gained character's place in the night order).
 *
 * Until "Has Ability" is placed the step is still shown, at the same place, marked
 * `if-mad`: the Storyteller makes the madness call there (swap Mad for Has Ability, or not).
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { Night, NightStep } from './night-order.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

export interface GainedAbility {
	/** The player who gains the ability (the Pixie). */
	seatId: SeatId;
	/** The character whose ability they gain. */
	characterId: CharacterId;
	/** The character whose ability grants it. */
	via: CharacterId;
	/** The player whose character it was. */
	fromSeat: SeatId;
	/** `has-ability`: the Storyteller placed "Has Ability"; `if-mad`: still their call. */
	status: 'has-ability' | 'if-mad';
	/**
	 * Set on a night step when the gained character has no text for this night and its
	 * first-night text is used: a "you start knowing" ability gives its information the
	 * night it is gained (the Pixie's Washerwoman example on the wiki).
	 */
	firstNightText?: boolean;
	wiki: string;
}

/** Every living Pixie's gained (or about to be gained) ability. */
export function gainedAbilities(game: Game): GainedAbility[] {
	const out: GainedAbility[] = [];
	// The Pixie wakes by the token it holds (a Drunk who thinks they are the Pixie too).
	const pixies = game.seating.filter(
		(s) => game.seats[s].characterId === 'pixie' && !game.seats[s].dead
	);
	if (pixies.length === 0) return out;
	const carrier = (label: string) =>
		game.seating.find((s) =>
			game.seats[s].reminders.some((r) => r.characterId === 'pixie' && r.label === label)
		);
	const has = carrier('Has Ability');
	const mad = carrier('Mad');
	const from = has ?? (mad !== undefined && game.seats[mad].dead ? mad : undefined);
	const characterId = from !== undefined ? game.seats[from].characterId : undefined;
	if (from === undefined || characterId === undefined) return out;
	for (const seatId of pixies) {
		out.push({
			seatId,
			characterId,
			via: 'pixie',
			fromSeat: from,
			status: has !== undefined ? 'has-ability' : 'if-mad',
			wiki: `${W}Pixie`
		});
	}
	return out;
}

/**
 * Adds a step for each gained ability, right after the gained character's own step (or
 * just before Dawn when it has none tonight), with that character's night text. A gained
 * ability with no night text adds nothing. The Pixie's step keeps the Pixie as its
 * character, with `gained` saying whose ability it is and whether it is still `if-mad`.
 */
export function withGainedSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	for (const gained of gainedAbilities(game)) {
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

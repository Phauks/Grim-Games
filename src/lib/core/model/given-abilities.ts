/**
 * Abilities the Storyteller gives a player without changing their character (`GivenAbility`,
 * M34): a character's, kept in `Seat.abilities`, or free text, kept in `Seat.customAbilities`.
 */
import type { GivenAbility, HeldAbility, Seat } from './types.ts';

/** Whether `a` is the same entry as `b`: the same text, or the same character and giver. */
export function sameGiven(a: GivenAbility, b: GivenAbility): boolean {
	if ('text' in a || 'text' in b) return 'text' in a && 'text' in b && a.text === b.text;
	return a.characterId === b.characterId && a.via === b.via;
}

/** Whether `seat` already has `ability`. */
export function hasGiven(seat: Seat, ability: GivenAbility): boolean {
	if ('text' in ability) return (seat.customAbilities ?? []).includes(ability.text);
	return (seat.abilities ?? []).some((held) => sameGiven(held, ability));
}

/**
 * `seat` with `ability` given (`on`) or taken away. A character's ability recorded for a giver
 * replaces any that giver gave before (one per `via`); one given by hand, or a text, is added
 * once.
 */
export function withGiven(seat: Seat, ability: GivenAbility, on: boolean): Seat {
	if ('text' in ability) {
		const others = (seat.customAbilities ?? []).filter((t) => t !== ability.text);
		const customAbilities = on ? [...others, ability.text] : others;
		if (customAbilities.length > 0) return { ...seat, customAbilities };
		const rest = { ...seat };
		delete rest.customAbilities;
		return rest;
	}
	const replaced = (held: HeldAbility) =>
		sameGiven(held, ability) || (on && ability.via !== undefined && held.via === ability.via);
	const others = (seat.abilities ?? []).filter((held) => !replaced(held));
	const entry: HeldAbility = {
		characterId: ability.characterId,
		...(ability.via !== undefined ? { via: ability.via } : {})
	};
	const abilities = on ? [...others, entry] : others;
	if (abilities.length > 0) return { ...seat, abilities };
	const rest = { ...seat };
	delete rest.abilities;
	return rest;
}

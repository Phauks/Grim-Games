/**
 * A player brought back to life tonight whose character wakes on the first night only wakes
 * now, right after the step of the ability that revived them, to use their first-night
 * ability (the Professor, https://wiki.bloodontheclocktower.com/Professor). The reviving
 * ability is the one whose reminder on them revives (`reminderPrompts`: `revive`).
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { actsTonight, type Night, type NightStep } from './night-order.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

export function withRevivedFirstNightSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night,
	revived: readonly SeatId[] = []
): (T | NightStep)[] {
	if (night === 'first' || revived.length === 0) return [...steps];
	const out: (T | NightStep)[] = [...steps];
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		if (!revived.includes(seatId) || seat.dead || !seat.characterId) continue;
		const character = characters.get(seat.characterId);
		if (!character || !actsTonight(character, 'first') || actsTonight(character, 'other')) continue;
		if (out.some((s) => s.id === character.id)) continue;
		const by = seat.reminders.find(
			(r) => rulesFor(game, r.characterId, characters)?.reminderPrompts?.[r.label] === 'revive'
		);
		if (!by) continue;
		const reviver = characters.get(by.characterId)?.name ?? by.characterId;
		const own = out.findIndex((s) => s.id === by.characterId);
		const dawn = out.findIndex((s) => s.id === 'dawn');
		const at = own >= 0 ? own + 1 : dawn >= 0 ? dawn : out.length;
		out.splice(at, 0, {
			id: character.id,
			kind: 'character',
			character,
			reminder: character.firstNightReminder,
			afterDawn: false,
			placement: 'unplaced',
			notes: [`Revived tonight by the ${reviver}: wakes now for its first-night ability.`]
		});
	}
	return out;
}

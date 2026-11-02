/**
 * A player brought back to life tonight by another character's ability acts only at the
 * steps after that ability's own: their own step earlier in the night has passed (the
 * Shabaloth's regurgitated Exorcist, https://wiki.bloodontheclocktower.com/Shabaloth). The
 * reviving ability is the one whose reminder on them revives (`reminderPrompts`: `revive`).
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/**
 * Whether `seatId`, revived tonight (`revivedTonight`, from `revivedSinceNewDay`), was revived
 * by an ability whose step comes after `stepId` in tonight's `order` (step ids), so they do
 * not wake for `stepId`.
 */
export function revivedAfterStep(
	game: Game,
	seatId: SeatId,
	stepId: string,
	order: readonly string[],
	characters: CharacterLookup,
	revivedTonight: ReadonlySet<SeatId>
): boolean {
	const seat = game.seats[seatId];
	if (!seat || seat.dead || !revivedTonight.has(seatId)) return false;
	const at = order.indexOf(stepId);
	if (at < 0) return false;
	return seat.reminders.some(
		(r) =>
			rulesOf(r.characterId, characters)?.reminderPrompts?.[r.label] === 'revive' &&
			order.indexOf(r.characterId) > at
	);
}

/**
 * A player whose ability works twice until dusk (M15c, the `actsTwice` part: the Barista's
 * Acts Twice, https://wiki.bloodontheclocktower.com/Barista). While the token is on them:
 * - each of their night steps wakes them a second time, straight after the first: they act,
 *   sleep, then wake to act again (`withActsTwiceSteps`). An optional choice may be made
 *   twice and a mandatory one must be; information is given again;
 * - a once-per-game ability already spent may be used once more, and one not yet used may be
 *   used twice (`dayUsesAllowed` by day, `actsTwice` waiving a night step's spent token in
 *   `wakes-when.ts`).
 * The token is placed again each night, so a step tonight that comes before the step of the
 * token's character carries last night's token and is not doubled. Warns only: the Storyteller
 * may tick or skip any step.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import type { NightStep } from './night-order.ts';

/** The token that makes a seat act twice, and whether its character's ability works now. */
export interface ActsTwiceSource {
	characterId: CharacterId;
	/** The seat whose character placed it, when one holds that character. */
	seatId?: SeatId;
	reminderId: ReminderId;
	/** False when that character's player is drunk, poisoned or has no ability. */
	works: boolean;
}

/** The token on `seatId` that makes its ability work twice, if any (`actsTwice` part). */
export function actsTwiceSource(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): ActsTwiceSource | undefined {
	const seat = getSeat(game, seatId);
	const token = seat?.reminders.find(
		(r) => rulesOf(r.characterId, characters)?.actsTwice?.token === r.label
	);
	if (!token) return undefined;
	const owners = game.seating.filter(
		(s) => s !== seatId && trueCharacter(game, s, characters) === token.characterId
	);
	const working = owners.find((s) => abilityState(game, s, characters).works);
	const from = working ?? owners[0];
	return {
		characterId: token.characterId,
		...(from ? { seatId: from } : {}),
		reminderId: token.reminderId,
		// With no player holding the token's character, the token is the Storyteller's to judge.
		works: owners.length === 0 || working !== undefined
	};
}

/** Whether `seatId`'s ability works twice now: it carries a working `actsTwice` token. */
export function actsTwice(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return actsTwiceSource(game, seatId, characters)?.works ?? false;
}

/**
 * How many times `seatId` may use its day ability today: once, or with a working
 * `actsTwice` token twice, or once more when it was spent before today (`spentBefore`).
 */
export function dayUsesAllowed(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	spentBefore: boolean
): number {
	if (!actsTwice(game, seatId, characters)) return spentBefore ? 0 : 1;
	return spentBefore ? 1 : 2;
}

/**
 * Adds a second wake after each character step whose player acts twice (`actsTwiceSource`
 * works): a copy of the step for that seat alone, marked `again`, with its own id so it is
 * ticked on its own. Not for a step before the step of the token's character tonight (that is
 * last night's token), a step the Storyteller acts in, or a changed character's wake.
 */
export function withActsTwiceSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [];
	const passed = new Set<CharacterId>();
	const onTonight = new Set(steps.flatMap((s) => (s.character ? [s.character.id] : [])));
	for (const step of steps) {
		out.push(step);
		const character = step.character;
		if (!character) continue;
		passed.add(character.id);
		if (step.kind !== 'character' || step.changed || step.storytellerAbility || step.again)
			continue;
		const seats = step.gained
			? [step.gained.seatId]
			: game.seating.filter((s) => game.seats[s].characterId === character.id);
		for (const seatId of seats) {
			const source = actsTwiceSource(game, seatId, characters);
			if (!source?.works) continue;
			if (onTonight.has(source.characterId) && !passed.has(source.characterId)) continue;
			out.push({
				...step,
				id: `${step.id}:again:${seatId}`,
				again: { seatId, characterId: source.characterId }
			});
		}
	}
	return out;
}

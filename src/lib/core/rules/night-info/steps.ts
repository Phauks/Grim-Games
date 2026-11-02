/**
 * Night information: the data each night order step carries. Part of `night-info.ts`.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { type AbilityState, abilityState } from '../ability.ts';
import { withTravellerAlignmentStep } from '../traveller-alignment.ts';
import { withGainedSteps, withStorytellerSteps } from '../gained-abilities.ts';
import { type DeathCheck, deathCheck } from '../night-deaths.ts';
import type { Night, NightStep } from '../night-order.ts';
import { type NightAnswer } from './reliability.ts';
import { type NightToday, markedSeats, nightAnswer } from './answers.ts';
import { type InfoPicker, infoPicker } from './picker.ts';

/** Data a night step carries: worked-out answers, pickers or death checks, one per waking player. */
export type NightStepInfo =
	| { kind: 'answer'; answers: NightAnswer[] }
	| { kind: 'picker'; pickers: InfoPicker[] }
	| { kind: 'death'; checks: DeathCheck[] };

/**
 * The night info for one character step: one entry per player whose token is that
 * character (a Drunk who thinks they are the Washerwoman wakes as the Washerwoman, and the
 * answer is marked unreliable), or for `seats` when given (a Pixie with that ability).
 * `night` picks a first-night answer where the character has one (the Godfather's), and on
 * the first night skips death checks, so a character learns instead (the Grandmother).
 * Undefined when nothing is worked out for the character.
 */
export function nightStepInfo(
	game: Game,
	character: Pick<Character, 'id'>,
	characters: CharacterLookup,
	seats: readonly SeatId[] = characterStepSeats(game, character.id, characters),
	today?: NightToday,
	night?: Night
): NightStepInfo | undefined {
	if (seats.length === 0) return undefined;
	if (rulesOf(character.id, characters)?.answers) {
		const answers = seats.flatMap(
			(s) => nightAnswer(game, s, character.id, characters, today, night) ?? []
		);
		return { kind: 'answer', answers };
	}
	// Ability deaths happen on other nights (the Grandmother wakes on the first night to learn).
	const checks =
		night === 'first'
			? []
			: seats.flatMap((s) => deathCheck(game, s, character.id, characters) ?? []);
	if (checks.length > 0) return { kind: 'death', checks };
	const pickers = seats.flatMap((s) => infoPicker(game, s, character.id, characters, night) ?? []);
	return pickers.length > 0 ? { kind: 'picker', pickers } : undefined;
}

/**
 * The players who wake for a character's step: those whose token is that character, or, for a
 * character whose answer wakes the players it marks (`answers.wakes: 'marked'`), each player
 * carrying one of its reminders (the Duchess's visitors,
 * https://wiki.bloodontheclocktower.com/Duchess).
 */
export function characterStepSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	if (rulesOf(characterId, characters)?.answers?.wakes === 'marked')
		return markedSeats(game, characterId);
	return game.seating.filter((s) => game.seats[s].characterId === characterId);
}

/** Whether a character's step wakes the players it marks rather than a holder. */
export const wakesMarked = (characterId: CharacterId, characters: CharacterLookup): boolean =>
	rulesOf(characterId, characters)?.answers?.wakes === 'marked';

/**
 * Adds what the game says to the steps of a night order (see `nightOrder`): `info`
 * (answers, pickers, death checks), `impaired` (waking players whose ability does not
 * work, such as a Minion the Preacher chose), and, given `night`, a step for each gained
 * ability (the Pixie's, `withGainedSteps`) and a first step for Travellers without an
 * alignment (`withTravellerAlignmentStep`); `order` places a gained ability not in play.
 * Steps get a copy; the order is not otherwise
 * changed.
 */
export function withNightInfo<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night?: Night,
	today?: NightToday,
	order?: readonly string[]
): (T | NightStep)[] {
	const all = withTravellerAlignmentStep(
		night
			? withStorytellerSteps(
					withGainedSteps(steps, game, characters, night, order),
					game,
					characters,
					night,
					order
				)
			: steps,
		game,
		characters
	);
	return all.map((step) => {
		// A wake step for a changed character shows the player; it works out nothing.
		// Nor does one the Storyteller acts in: it wakes nobody.
		if (!step.character || step.changed || step.storytellerAbility) return step;
		const gained = step.gained;
		const seats = gained
			? [gained.seatId]
			: characterStepSeats(game, step.character.id, characters);
		const as = gained ? (characters.get(gained.characterId) ?? step.character) : step.character;
		const info = nightStepInfo(game, as, characters, seats, today, night);
		// The players a rule character marks wake for its ability, not their own.
		const impaired = (gained || !wakesMarked(step.character.id, characters) ? seats : [])
			.map((s): AbilityState => abilityState(game, s, characters))
			.filter((a) => a.impairments.length > 0);
		return {
			...step,
			...(info ? { info } : {}),
			...(impaired.length > 0 ? { impaired } : {})
		};
	});
}

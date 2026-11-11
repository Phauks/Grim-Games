/**
 * Night information: the data each night order step carries. Part of `night-info.ts`.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { type AbilityState, abilityState } from '../ability.ts';
import { withSetupAlignmentStep } from '../setup-alignment.ts';
import { withTravellerAlignmentStep, withTravellerJoinsStep } from '../traveller-alignment.ts';
import { withGainedSteps, withStorytellerSteps } from '../gained-abilities.ts';
import { withJinxChoiceSteps } from '../jinx-choices.ts';
import { withLateEvilInfoSteps } from '../late-evil-info.ts';
import { withRevivedFirstNightSteps } from '../revived-first-night.ts';
import { type DeathCheck, deathCheck } from '../night-deaths.ts';
import { nightKill } from '../night-kill.ts';
import { type Night, type NightStep, wakesTooNote } from '../night-order.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { type NightAnswer } from './reliability.ts';
import { type NightToday, markedSeats, nightAnswer } from './answers.ts';
import { type InfoPicker, infoPicker } from './picker.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

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
 * `basis` is whose own day an answer reads, when not the waking player's (`nightAnswer`).
 * Undefined when nothing is worked out for the character.
 */
export function nightStepInfo(
	game: Game,
	character: Pick<Character, 'id'>,
	characters: CharacterLookup,
	seats: readonly SeatId[] = characterStepSeats(game, character.id, characters),
	today?: NightToday,
	night?: Night,
	basis?: SeatId
): NightStepInfo | undefined {
	if (seats.length === 0) return undefined;
	if (rulesFor(game, character.id, characters)?.answers) {
		const answers = seats.flatMap(
			(s) => nightAnswer(game, s, character.id, characters, today, night, basis) ?? []
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
	if (rulesFor(game, characterId, characters)?.answers?.wakes === 'marked')
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
 * ability (the Pixie's, `withGainedSteps`), a step for each jinx night choice (the
 * Leviathan's with the Sage, `withJinxChoiceSteps`) and a first step for Travellers without an
 * alignment (`withTravellerAlignmentStep`), and before that one for Travellers not in play
 * (`withTravellerJoinsStep`); on the first night a step for players a setup change makes start
 * with the other alignment (`withSetupAlignmentStep`); `order` places a gained ability not in
 * play.
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
	const all = withTravellerJoinsStep(
		withTravellerAlignmentStep(
			night
				? withJinxChoiceSteps(
						withStorytellerSteps(
							withRevivedFirstNightSteps(
								withLateEvilInfoSteps(
									withGainedSteps(steps, game, characters, night, order),
									game,
									characters,
									night
								),
								game,
								characters,
								night,
								today?.revived
							),
							game,
							characters,
							night,
							order
						),
						game,
						characters,
						night,
						order
					)
				: steps,
			game,
			characters
		),
		game,
		characters
	);
	// The first night, right after Dusk: who starts with the other alignment (the Bounty
	// Hunter's evil Townsfolk), picked if still to pick, and told.
	const withAlignments = night === 'first' ? withSetupAlignmentStep(all, game, characters) : all;
	const asleep = asleepWithEvil(game, characters);
	return withAlignments.map((each) => {
		const step =
			asleep.length > 0 && each.notes.some((n) => asleep.includes(n))
				? { ...each, notes: each.notes.filter((n) => !asleep.includes(n)) }
				: each;
		// A wake step for a changed character shows the player; it works out nothing.
		// Nor does one the Storyteller acts in: it wakes nobody. A jinx's night choice is
		// recorded on its own step (`jinx-choices.ts`).
		if (!step.character || step.changed || step.storytellerAbility || step.jinxChoice) return step;
		const gained = step.gained;
		const seats = gained
			? [gained.seatId]
			: characterStepSeats(game, step.character.id, characters);
		const as = gained ? (characters.get(gained.characterId) ?? step.character) : step.character;
		// A jinx may have them learn what that ability's own player would have (the
		// Cannibal's Juggler): the answer reads that player's day.
		const basis = gained?.learns === 'answer' ? gained.fromSeat : undefined;
		const info = nightStepInfo(game, as, characters, seats, today, night, basis);
		// The players a rule character marks wake for its ability, not their own.
		const impaired = (gained || !wakesMarked(step.character.id, characters) ? seats : [])
			.map((s): AbilityState => abilityState(game, s, characters))
			.filter((a) => a.impairments.length > 0);
		const killNotes = gained ? [] : nightKillNotes(game, step.character.id, seats, characters);
		return {
			...step,
			...(killNotes.length > 0 ? { notes: [...step.notes, ...killNotes] } : {}),
			...(info ? { info } : {}),
			...(impaired.length > 0 ? { impaired } : {})
		};
	});
}

/**
 * The "wakes too" notes to take off evil players' steps: a character that wakes with evil
 * (`wakesWithEvil`) whose every player has lost their ability is not woken
 * (https://wiki.bloodontheclocktower.com/Wraith).
 */
function asleepWithEvil(game: Game, characters: CharacterLookup): string[] {
	const ids = new Set(
		game.seating.flatMap((s) => {
			const id = trueCharacter(game, s, characters);
			return id !== undefined && rulesFor(game, id, characters)?.wakesWithEvil ? [id] : [];
		})
	);
	return [...ids].flatMap((id) => {
		const seats = game.seating.filter((s) => trueCharacter(game, s, characters) === id);
		const asleep = seats.every((s) => !abilityState(game, s, characters).works);
		const name = characters.get(id)?.name;
		return asleep && name ? [wakesTooNote(name)] : [];
	});
}

/**
 * Notes on a killing step whose kill differs tonight (`nightKill`): more players than usual
 * (the Po after choosing no one), or none chosen while an earlier choice still dies (a Pukka
 * the Exorcist chose).
 */
function nightKillNotes(
	game: Game,
	characterId: string,
	seats: readonly SeatId[],
	characters: CharacterLookup
): string[] {
	const usual = rulesFor(game, characterId, characters)?.kills?.count ?? 1;
	const kills = seats.flatMap((s) => nightKill(game, s, characterId, characters) ?? []);
	const most = Math.max(0, ...kills.map((k) => k.max));
	const notes: string[] = [];
	if (most > usual) notes.push(`May choose up to ${most} players tonight.`);
	if (kills.some((k) => k.max === 0 && k.delayed.length > 0))
		notes.push('Does not choose tonight, but its earlier choice still dies.');
	return notes;
}

/**
 * Setup alignment changes: a character whose [bracketed] text makes players of a type start
 * with the other alignment, as the Bounty Hunter's "[1 Townsfolk is evil]"
 * (https://wiki.bloodontheclocktower.com/Bounty_Hunter: during setup one Townsfolk token is
 * turned upside down). Read from the `alignments` of its setup change (`setupModifier`),
 * never by character id.
 *
 * The Storyteller picks the player once characters are on seats. Until enough players fit,
 * Start game warns and the first night opens with a step to pick them (warn, never lock).
 * Players know their own alignment (https://wiki.bloodontheclocktower.com/Glossary), so the
 * same first-night step wakes each one to tell them.
 *
 * Only the true character counts: a Drunk who thinks they are the Bounty Hunter makes nobody
 * evil (the wiki page's third example), and a Bounty Hunter the Kazali turned into a Minion
 * no longer does either (https://wiki.bloodontheclocktower.com/Kazali, Related Jinxes).
 */
import type { Alignment, CharacterId, SeatedType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { NightStep } from './night-order.ts';
import { setupModifierFor } from './setup-modifiers.ts';

/** The id of the first-night step that picks and wakes these players. */
export const SETUP_ALIGNMENT_STEP = 'setup-alignment';

export interface SetupAlignmentTask {
	/** The character whose setup change this is (the Bounty Hunter). */
	characterId: CharacterId;
	/** Its setup change in our words: "1 Townsfolk is evil". */
	summary: string;
	/** Players of `type` who start with `alignment`. */
	type: SeatedType;
	alignment: Alignment;
	/** How many must. */
	count: number;
	/** Players of `type` who already have `alignment`, in seating order. */
	seats: SeatId[];
	/** Players of `type` who could be picked, in seating order. */
	candidates: SeatId[];
	/** Enough players have it. */
	done: boolean;
}

/**
 * Every setup alignment change in play, one per character and change, with who already fits.
 * A second copy of the character adds nothing, as with other setup changes.
 */
export function setupAlignmentTasks(game: Game, characters: CharacterLookup): SetupAlignmentTask[] {
	const out: SetupAlignmentTask[] = [];
	const seen = new Set<CharacterId>();
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		const character = characters.get(id);
		const modifier = character ? setupModifierFor(character) : undefined;
		for (const op of modifier?.alignments ?? []) {
			const ofType = game.seating.filter((s) => typeOf(game, s, characters) === op.type);
			const seats = ofType.filter((s) => alignmentOf(game, s) === op.alignment);
			out.push({
				characterId: id,
				summary: modifier!.summary,
				type: op.type,
				alignment: op.alignment,
				count: op.count,
				seats,
				candidates: ofType.filter((s) => !seats.includes(s)),
				done: seats.length >= op.count
			});
		}
	}
	return out;
}

/** The setup alignment changes not yet made, for Start game's warning. */
export function pendingSetupAlignments(
	game: Game,
	characters: CharacterLookup
): SetupAlignmentTask[] {
	return setupAlignmentTasks(game, characters).filter((t) => !t.done);
}

/**
 * The first night's steps with one more right after Dusk when a setup alignment change is in
 * play: pick the players still to pick, and wake each one to tell them their alignment.
 */
export function withSetupAlignmentStep<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup
): (T | NightStep)[] {
	const tasks = setupAlignmentTasks(game, characters);
	if (tasks.length === 0) return [...steps];
	const step: NightStep = {
		id: SETUP_ALIGNMENT_STEP,
		kind: 'custom',
		title: 'Starting alignment',
		reminder:
			'Wake each player below, one at a time. Show them the You are info token, then a thumbs down for evil or a thumbs up for good.',
		afterDawn: false,
		placement: 'marker',
		notes: [],
		setupAlignments: tasks
	};
	const dusk = steps.findIndex((s) => s.id === 'dusk');
	return [...steps.slice(0, dusk + 1), step, ...steps.slice(dusk + 1)];
}

/**
 * How the board names and draws a night step (its name, its icon) and the walk-through's own
 * keys and wording. The night order itself, and who wakes for each step, are pure rules in
 * `core/rules/night/board-steps.ts`.
 */
import type { GameData, NightMarker } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import { diedSinceNewDay, revivedSinceNewDay } from '#lib/core/rules/night/night-numbers.ts';
import { MARKER_TEXT, type NightStep } from '#lib/core/rules/night/night-order.ts';
import { SETUP_ALIGNMENT_STEP } from '#lib/core/rules/setup/setup-alignment.ts';
import {
	TRAVELLER_ALIGNMENT_STEP,
	TRAVELLER_JOINS_STEP
} from '#lib/core/rules/setup/traveller-alignment.ts';
import { type AnswerValue } from '#lib/core/rules/night/info/reliability.ts';
import { type Night } from '#lib/core/model/overrides.ts';
import { boardNightSteps, tonight } from '#lib/core/rules/night/board-steps.ts';
import { sheetStepId } from '#lib/core/rules/night/copy-steps.ts';
import type { GameLog } from '#lib/core/engine/index.ts';
import type { SpecialRule } from '#lib/core/modes/index.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
import { appliedEntries } from '#lib/core/engine/applied-entries.ts';

/** What a step's name needs: a player's night order passes its markers and characters too. */
export type NamedStep = Pick<
	NightStep,
	'id' | 'kind' | 'character' | 'title' | 'again' | 'pretend'
>;

export function stepName(step: NamedStep): string {
	if (step.kind === 'marker') return MARKER_TEXT[step.id as NightMarker].name;
	// A second wake for a player who acts twice (`withActsTwiceSteps`) says "again".
	const again = step.again ? ' again' : '';
	// A step the pretend evil team acts out says so (Trevor, 2026-11-02: "Fake").
	const fake = step.pretend ? 'Fake ' : '';
	// eslint-disable-next-line grim/names-as-badges -- the step's own name, on its band (StepPiece)
	return `${fake}${step.title ?? step.character?.name ?? step.id}${again}`;
}

/** Steps with no character get an icon of their own. */
export const MARKER_ICONS: Record<string, IconSlot> = {
	dusk: 'night',
	dawn: 'day',
	minioninfo: 'players',
	demoninfo: 'demon',
	[TRAVELLER_ALIGNMENT_STEP]: 'traveller',
	[SETUP_ALIGNMENT_STEP]: 'alignment',
	[TRAVELLER_JOINS_STEP]: 'alive'
};

/** Seats revived since the New day, from the log: a first-night-only one wakes again tonight. */
export function revivedToday(log: GameLog): SeatId[] {
	return [...revivedSinceNewDay(appliedEntries(log).flatMap((e) => e.events))];
}

/**
 * What `stepWakes` needs from the log for tonight: who died, whose character changed and
 * who was revived since the New day, and, when anyone was revived, tonight's step ids (`order`).
 */
export function tonightFromLog(
	log: GameLog,
	game: Game,
	characters: CharacterLookup,
	data: GameData | undefined,
	today: Parameters<typeof boardNightSteps>[4],
	rules: readonly SpecialRule[]
): { diedTonight: Set<SeatId>; became: Set<SeatId>; revived: Set<SeatId>; order?: string[] } {
	const events = appliedEntries(log).flatMap((e) => e.events);
	const revived = revivedSinceNewDay(events);
	const order =
		data && revived.size > 0
			? boardNightSteps(game, characters, tonight(game), data, today, rules).map(sheetStepId)
			: undefined;
	return {
		diedTonight: diedSinceNewDay(events),
		became: new Set(today?.changes?.map((c) => c.seatId)),
		revived,
		...(order ? { order } : {})
	};
}

/** A seat's PlayerBadge text; the one helper lives with the other seat names. */
export { seatName } from '#lib/features/game/seat-label.ts';

/** A tick belongs to one night, by the number of days before it: a new day starts afresh. */
export const doneKey = (day: number, night: Night, step: { id: string }): string =>
	`${day}:${night}:${step.id}`;

/**
 * Whether a step gives its player a number, so the walk-through offers the "Your number is"
 * info token (Trevor, 2026-10-18): TPI's night text for the step says to give a finger
 * signal (the Chef, Empath, Clockmaker, Chambermaid, Mathematician, Oracle, Juggler, Barista
 * and Duchess in TPI's data).
 */
export const givesNumber = (step: NightStep): boolean => /finger signal/i.test(step.reminder ?? '');

/** A suggested answer in words, for one that is not drawn as badges. */
export function answerValueText(v: AnswerValue): string {
	switch (v.kind) {
		case 'yes-no':
			return v.value ? 'Yes' : 'No';
		case 'character':
			// Drawn as a badge (the value snippet); only its id here.
			return v.value;
		case 'characters':
			// Drawn as badges (the characters snippet); only the ids here.
			return v.value.join(', ');
		case 'number':
			return String(v.value);
		case 'alignment':
			return alignmentText(v.value);
		case 'none':
			return v.reason;
	}
}

/** A General's answer in words: Good, Evil or Neither. */
export function alignmentText(value: 'good' | 'evil' | 'neither'): string {
	return value === 'good' ? 'Good' : value === 'evil' ? 'Evil' : 'Neither';
}

/**
 * A step's place among the night's counted steps, from 0, and how many there are. Dusk and
 * Dawn bookend the night and are not counted (Trevor, 2026-11-18: "Dawn and dusk shouldn't
 * count as night order steps"); on them `place` is -1.
 */
export function countedPlace(
	steps: readonly NightStep[],
	step: NightStep | undefined
): { place: number; of: number } {
	const bookend = (s: NightStep) => s.kind === 'marker' && (s.id === 'dusk' || s.id === 'dawn');
	const counted = steps.filter((s) => !bookend(s));
	const place = step && !bookend(step) ? counted.findIndex((s) => s.id === step.id) : -1;
	return { place, of: counted.length };
}

/**
 * How far the bar under a step is filled, from 0 to 1, over the counted steps (Trevor,
 * 2026-11-19: "Bar should be at start and end on highest and lowest numbers"): empty on the
 * first counted step and on Dusk before it, full on the last and on Dawn after it.
 */
export function nightProgress(steps: readonly NightStep[], index: number): number {
	const step = steps[index];
	if (!step) return 0;
	const { place, of } = countedPlace(steps, step);
	if (place >= 0) return of > 1 ? place / (of - 1) : 1;
	return index === steps.length - 1 ? 1 : 0;
}

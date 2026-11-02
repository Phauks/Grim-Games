/**
 * The night order for a game on the board: the characters in play that wake tonight, in
 * order, with TPI's night text. Shared by the Night order sheet, the guided step and the
 * walk-through strip under the board.
 */
import {
	isSeatable,
	type Character,
	type CharacterId,
	type GameData,
	type NightMarker
} from '#lib/core/data/index.ts';
import {
	trueCharacter,
	type CharacterLookup,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';
import {
	keepsAbilityWhenDead,
	livesWhileDead,
	MARKER_TEXT,
	nightOrder,
	onDeathApplies,
	onDeathTrigger,
	diedSinceNewDay,
	revivedAfterStep,
	revivedSinceNewDay,
	TRAVELLER_ALIGNMENT_STEP,
	wakeConditionMet,
	withCharacterChangeSteps,
	withNightInfo,
	type AnswerValue,
	type Night,
	type NightStep
} from '#lib/core/rules/index.ts';
import type { GameLog } from '#lib/core/engine/index.ts';
import { seatHasAbility, type AbilitiesRule, type SpecialRule } from '#lib/core/modes/index.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

export function boardNightSteps(
	game: Game,
	characters: CharacterLookup,
	night: Night,
	data: GameData,
	/**
	 * Since the most recent New day, from the log: seats whose character changed
	 * (`changedCharacters`), each woken tonight, and who died (`diedToday`), for the Godfather.
	 */
	today: {
		changes?: readonly { seatId: SeatId; characterId: CharacterId }[];
		died?: readonly SeatId[];
	} = {},
	/** The game's special rules, for the steps they add to a night (Council of the Dead). */
	rules: readonly SpecialRule[] = []
): NightStep[] {
	// Players wake by the token they hold (a Drunk wakes as their Townsfolk).
	const inPlay: Character[] = [];
	for (const id of [
		...game.seating.map((s) => game.seats[s].characterId),
		...game.ruleCharacters
	]) {
		const c = id ? characters.get(id) : undefined;
		if (c) inPlay.push(c);
	}
	const { steps } = nightOrder({
		night,
		sheet: data.nightSheet,
		official: data.byId,
		inPlay,
		players: inPlay.filter((c) => isSeatable(c.type) && c.type !== 'traveller').length,
		customOrder: night === 'first' ? game.script.meta?.firstNight : game.script.meta?.otherNight,
		overrides: game.nightOrderOverrides
	});
	// What the game says for each step (suggested answers, impairments), a step for each
	// gained ability, and a step to choose any Traveller's alignment still unset. Dawn is the
	// last step (Trevor, 2026-10-20); the board's End night button still ends the night.
	// A player whose character changed since dawn wakes before Dawn to learn it; changes only
	// count after the first New day, so only other nights have them.
	const woken =
		night === 'other' ? withCharacterChangeSteps(steps, today.changes ?? [], characters) : steps;
	const number = night === 'first' ? 1 : game.pastDays.length + 1;
	return duskToDawn([
		...ruleNightSteps(rules, number),
		...withNightInfo(
			woken,
			game,
			characters,
			night,
			{ died: today.died ?? [] },
			data.nightSheet[night === 'first' ? 'firstNight' : 'otherNight']
		)
	]);
}

/**
 * The steps special rules add to night `number`, right after Dusk: a rule's one-night step
 * for the dead (Council of the Dead, https://beardytas.com/garden-of-djinn/council-of-the-dead/),
 * headed by the rule's name, with the rule's own lines as its text.
 */
export function ruleNightSteps(rules: readonly SpecialRule[], number: number): NightStep[] {
	return rules.flatMap((rule) =>
		(rule.parts.nightSteps ?? []).flatMap((step, i) =>
			step.when === 'one-night' && step.night === number && step.dead
				? [
						{
							id: `rule:${rule.id}:${i}`,
							kind: 'custom' as const,
							title: rule.name,
							reminder: (rule.parts.text ?? []).join(' ') || undefined,
							afterDawn: false,
							placement: 'marker' as const,
							notes: []
						}
					]
				: []
		)
	);
}

/**
 * Dusk is always the first step and Dawn the last (Trevor, 2026-10-16); everything else,
 * Traveller alignment included, falls between them. TPI's few "after Dawn" steps (said to
 * everyone once the night is over) stay after Dawn, as on TPI's night sheet.
 */
function duskToDawn<T extends NightStep>(steps: readonly T[]): T[] {
	const dusk = steps.filter((s) => s.id === 'dusk');
	const dawn = steps.filter((s) => s.id === 'dawn');
	const rest = steps.filter((s) => s.id !== 'dusk' && s.id !== 'dawn');
	return [
		...dusk,
		...rest.filter((s) => !s.afterDawn),
		...dawn,
		...rest.filter((s) => s.afterDawn)
	];
}

/** Tonight: the first night until a day has been played, then the other nights. */
export const tonight = (game: Game): Night => (game.pastDays.length === 0 ? 'first' : 'other');

export function stepName(step: NightStep): string {
	if (step.kind === 'marker') return MARKER_TEXT[step.id as NightMarker].name;
	// eslint-disable-next-line grim/names-as-badges -- a caption beside the step's own icon (StepIcon)
	return step.title ?? step.character?.name ?? step.id;
}

/** Steps with no character get an icon of their own. */
export const MARKER_ICONS: Record<string, IconSlot> = {
	dusk: 'night',
	dawn: 'day',
	minioninfo: 'players',
	demoninfo: 'demon',
	[TRAVELLER_ALIGNMENT_STEP]: 'traveller'
};

/**
 * Who wakes for a step, for "Empath · Sam" and the seats marked on the board: the holder of
 * the step's character, or for Minion info and Demon info every player who really is a
 * Minion or the Demon (Trevor, 2026-10-16), so a Drunk never shows as one.
 */
export function stepHolders(game: Game, step: NightStep, characters: CharacterLookup): SeatId[] {
	const wakes = step.id === 'minioninfo' ? 'minion' : step.id === 'demoninfo' ? 'demon' : undefined;
	if (wakes) {
		return game.seating.filter((s) => {
			const id = trueCharacter(game, s, characters);
			return id !== undefined && characters.get(id)?.type === wakes;
		});
	}
	if (step.changed) return [step.changed.seatId];
	const id = step.character?.id;
	return id ? game.seating.filter((s) => game.seats[s].characterId === id) : [];
}

/**
 * Whether a step wakes anyone tonight, for Run Night Order and the leaf numbers: a step for
 * no player (Dusk, Dawn), or one with a player who has their ability (alive, or as a special
 * rule says), a dead player another character's token keeps it for (`keepsAbility`: the
 * Vigormortis's Has Ability on a Minion it killed, https://wiki.bloodontheclocktower.com/Vigormortis),
 * a dead player who still lives by their own ability (`livesWhileDead`: the Zombuul after its
 * first death), or one dead since the day began whose ability that death sets off (`onDeath`:
 * the Ravenkeeper killed at night, not executed; the Sage killed by the Demon). A character's
 * own condition must hold too (`wakesWhen`: the King once the dead equal or outnumber the
 * living, the Choirboy when the Demon killed the King, the Seamstress until it is used).
 */
export function stepWakes(
	game: Game,
	step: NightStep,
	characters: CharacterLookup,
	tonight: {
		abilitiesRule?: AbilitiesRule;
		diedTonight: ReadonlySet<SeatId>;
		revived?: ReadonlySet<SeatId>;
		order?: readonly string[];
	}
): boolean {
	const holders = stepHolders(game, step, characters);
	const id = step.character?.id;
	return (
		holders.length === 0 ||
		holders.some(
			(s) =>
				(seatHasAbility(tonight.abilitiesRule, game, s, characters) ||
					keepsAbilityWhenDead(game, s, characters) ||
					livesWhileDead(game, s, characters) ||
					(id !== undefined &&
						tonight.diedTonight.has(s) &&
						setOffByDeath(game, s, id, characters))) &&
				(id === undefined || wakeConditionMet(game, id, s, characters, tonight.diedTonight)) &&
				!(
					tonight.revived &&
					tonight.order &&
					revivedAfterStep(game, s, step.id, tonight.order, characters, tonight.revived)
				)
		)
	);
}

/**
 * What `stepWakes` needs from the log for tonight: who died and who was revived since the
 * New day, and, when anyone was revived, tonight's step ids (`order`).
 */
export function tonightFromLog(
	log: GameLog,
	game: Game,
	characters: CharacterLookup,
	data: GameData | undefined,
	today: Parameters<typeof boardNightSteps>[4],
	rules: readonly SpecialRule[]
): { diedTonight: Set<SeatId>; revived: Set<SeatId>; order?: string[] } {
	const events = log.entries.slice(0, log.cursor).flatMap((e) => e.events);
	const revived = revivedSinceNewDay(events);
	const order =
		data && revived.size > 0
			? boardNightSteps(game, characters, tonight(game), data, today, rules).map((s) => s.id)
			: undefined;
	return { diedTonight: diedSinceNewDay(events), revived, ...(order ? { order } : {}) };
}

/** Whether `seatId`'s death, by its recorded cause, sets off `characterId`'s ability. */
function setOffByDeath(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): boolean {
	const trigger = onDeathTrigger(characterId, characters);
	return !!trigger && onDeathApplies(trigger, game.seats[seatId]?.deathCause, characters);
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
		case 'none':
			return v.reason;
	}
}

/**
 * The night order for a game on the board: the characters in play that wake tonight, in
 * order, with TPI's night text. Shared by the Night order sheet, the guided step and the
 * walk-through strip under the board.
 */
import {
	isSeatable,
	type Character,
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
	MARKER_TEXT,
	nightOrder,
	TRAVELLER_ALIGNMENT_STEP,
	withNightInfo,
	type Night,
	type NightStep
} from '#lib/core/rules/index.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

export function boardNightSteps(
	game: Game,
	characters: CharacterLookup,
	night: Night,
	data: GameData
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
		inPlay,
		players: inPlay.filter((c) => isSeatable(c.type) && c.type !== 'traveller').length,
		customOrder: night === 'first' ? game.script.meta?.firstNight : game.script.meta?.otherNight,
		overrides: game.nightOrderOverrides
	});
	// What the game says for each step (suggested answers, impairments), a step for each
	// gained ability, and a step to choose any Traveller's alignment still unset.
	return duskToDawn(withNightInfo(steps, game, characters, night));
}

/**
 * Dusk is always the first step and Dawn the last (Trevor, 2026-10-16); everything else,
 * Traveller alignment included, falls between them. TPI's few "after Dawn" steps (said to
 * everyone once the night is over) stay after Dawn, as on TPI's night sheet.
 */
export function duskToDawn<T extends NightStep>(steps: readonly T[]): T[] {
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
	const id = step.character?.id;
	return id ? game.seating.filter((s) => game.seats[s].characterId === id) : [];
}

export const seatName = (game: Game, seatId: SeatId): string =>
	game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;

/** A tick belongs to one night, by the number of days before it: a new day starts afresh. */
export const doneKey = (day: number, night: Night, step: { id: string }): string =>
	`${day}:${night}:${step.id}`;

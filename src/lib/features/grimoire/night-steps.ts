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
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
import {
	MARKER_TEXT,
	nightOrder,
	TRAVELLER_ALIGNMENT_STEP,
	withTravellerAlignmentStep,
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
	// A first step to choose any Traveller's alignment that is still unset.
	return withTravellerAlignmentStep(steps, game, characters);
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

/** Who holds a step's character, for "Empath · Sam". */
export function stepHolders(game: Game, step: NightStep): SeatId[] {
	return game.seating.filter((s) => game.seats[s].characterId === step.character?.id);
}

export const seatName = (game: Game, seatId: SeatId): string =>
	game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;

/** A tick belongs to one night: a new day starts afresh. */
export const doneKey = (game: Game, night: Night, step: NightStep): string =>
	`${game.pastDays.length}:${night}:${step.id}`;

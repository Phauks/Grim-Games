/**
 * The reducers for today's log, marks and tallies, the Storyteller's night records, and the start
 * of a day, one for each event type (`reducer.ts` looks them up).
 */
import { startDay } from '#lib/core/engine/day-start.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { DayMark } from '#lib/core/data/day-mark-rules.ts';
import type { DayTallyLog, Game } from '#lib/core/model/index.ts';
import { omit, replaceAt, removeAt, type Reducers } from '#lib/core/engine/reduce/shared.ts';

function setDayTally(
	game: Game,
	characterId: CharacterId,
	change: (tally: DayTallyLog) => DayTallyLog
): Game {
	const tallies = { ...game.today.tallies };
	const next = change(tallies[characterId] ?? { count: 0 });
	if (next.count === 0 && !next.deaths?.length) delete tallies[characterId];
	else tallies[characterId] = next;
	const today =
		Object.keys(tallies).length > 0 ? { ...game.today, tallies } : omit(game.today, 'tallies');
	return { ...game, today };
}

function setDayMark(game: Game, mark: DayMark, value: boolean | undefined): Game {
	const marks = { ...game.today.marks };
	if (value === undefined) delete marks[mark];
	else marks[mark] = value;
	const today =
		Object.keys(marks).length > 0 ? { ...game.today, marks } : omit(game.today, 'marks');
	return { ...game, today };
}

export const DAY_REDUCERS: Reducers<
	| 'DayEntryAdded'
	| 'DayEntryReplaced'
	| 'DayEntryRemoved'
	| 'DayMarkSet'
	| 'DayTallySet'
	| 'DayTallyDeath'
	| 'PrepValueSet'
	| 'PretendSet'
	| 'StorytellerPairSet'
	| 'StorytellerVisitSet'
	| 'DayStarted'
> = {
	DayEntryAdded(game, event) {
		if (game.today.entries.some((e) => e.entryId === event.entry.entryId)) return game;
		return {
			...game,
			today: { ...game.today, entries: [...game.today.entries, structuredClone(event.entry)] }
		};
	},
	DayEntryReplaced(game, event) {
		const index = game.today.entries.findIndex((e) => e.entryId === event.entry.entryId);
		const entries = replaceAt(game.today.entries, index, structuredClone(event.entry));
		return entries === game.today.entries ? game : { ...game, today: { ...game.today, entries } };
	},
	DayEntryRemoved(game, event) {
		const index = game.today.entries.findIndex((e) => e.entryId === event.entryId);
		const entries = removeAt(game.today.entries, index);
		return entries === game.today.entries ? game : { ...game, today: { ...game.today, entries } };
	},
	DayMarkSet(game, event) {
		return setDayMark(game, event.mark, event.value);
	},
	DayTallySet(game, event) {
		return setDayTally(game, event.characterId, (t) => ({ ...t, count: event.count }));
	},
	DayTallyDeath(game, event) {
		return setDayTally(game, event.characterId, (t) =>
			t.deaths?.includes(event.seatId) ? t : { ...t, deaths: [...(t.deaths ?? []), event.seatId] }
		);
	},
	PrepValueSet(game, event) {
		const prepValues = { ...game.prepValues };
		if (event.value === undefined) delete prepValues[event.key];
		else prepValues[event.key] = event.value;
		return { ...game, prepValues };
	},
	PretendSet(game, event) {
		const pretend = { ...game.pretend };
		if (event.characterId === undefined) delete pretend[event.seatId];
		else pretend[event.seatId] = event.characterId;
		return Object.keys(pretend).length > 0 ? { ...game, pretend } : omit(game, 'pretend');
	},
	StorytellerPairSet(game, event) {
		return event.pair
			? { ...game, storytellerPair: structuredClone(event.pair) }
			: omit(game, 'storytellerPair');
	},
	StorytellerVisitSet(game, event) {
		const visits = { ...game.today.visits };
		if (event.storyteller === undefined) delete visits[event.seatId];
		else visits[event.seatId] = event.storyteller;
		const today =
			Object.keys(visits).length > 0 ? { ...game.today, visits } : omit(game.today, 'visits');
		return { ...game, today };
	},
	DayStarted(game, event) {
		return startDay(game, event.at);
	}
};

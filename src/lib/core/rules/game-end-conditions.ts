/**
 * The `condition` game ends (M60, `data/game-end-rules.ts`): an event, what must hold and who
 * wins. The Saint, Goblin, Fearmonger, Vortox, Mayor, Leviathan and Legion are presets of it.
 * Each end keeps the official kind it was written as for its rule, key and wording, and a
 * custom one is `condition`. Part of `game-end.ts`.
 */
import type { EndsGame } from '#lib/core/data/game-end-rules.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { isExecution } from './death-causes.ts';
import type { GameEnd, GameEndOptions } from './game-end.ts';
import {
	aliveForEnd,
	aliveNonTravellers,
	carrying,
	days,
	endedDays,
	endsOf,
	executedOn,
	impaired,
	wikiOf,
	winnerFor
} from './game-end-helpers.ts';

interface Found {
	seats: SeatId[];
	/** The player the result turns on, for `wins: 'opposing'`. */
	subject?: SeatId;
	/** What tells this end from another of the same rule. */
	tag: string;
	day?: number;
}

/** Each executed player the condition is about, with the players to show. */
function executedSubjects(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	rule: EndsGame,
	characters: CharacterLookup
): Found[] {
	const subjects = rule.subject === 'self' ? [seatId] : carrying(game, characterId, rule.token!);
	const carries = (s: SeatId) =>
		!rule.carries || carrying(game, characterId, rule.token!).includes(s);
	if (rule.nominatedBySelf) {
		return days(game).flatMap((log) => {
			const executed = executedOn(log);
			return log.entries.flatMap((entry) => {
				if (entry.kind !== 'nomination' || entry.nominator !== seatId) return [];
				const target = entry.nominee;
				if (!subjects.includes(target) || !executed.includes(target) || !carries(target)) return [];
				return [{ seats: [target, seatId], subject: target, tag: target }];
			});
		});
	}
	return subjects
		.filter(
			(s) => game.seats[s].dead && isExecution(game.seats[s].deathCause, characters) && carries(s)
		)
		.map((s) => ({ seats: [s], subject: s, tag: s }));
}

/** When the condition holds, if it does: on which day and which players it shows. */
function found(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	rule: EndsGame,
	characters: CharacterLookup,
	options: GameEndOptions
): Found[] {
	if (rule.whileAlive && !aliveForEnd(game, seatId, characters)) return [];
	const logs = days(game);
	switch (rule.event) {
		case 'executed':
			// Either of a pair is `markedExecuted`'s, in `game-end.ts`.
			if (rule.subject === 'either') return [];
			return executedSubjects(game, seatId, characterId, rule, characters);
		case 'day-ends': {
			const day = endedDays(game, options).find(
				(d) =>
					(rule.onDay === undefined || d === rule.onDay) &&
					(!rule.noExecution || executedOn(logs[d]).length === 0)
			);
			return day === undefined ? [] : [{ seats: [seatId], tag: String(day), day }];
		}
		case 'dusk': {
			if (!options.dayEnded || game.pastDays.length < 1) return [];
			if (rule.noExecution && executedOn(game.today).length > 0) return [];
			const alive = game.seating.filter((id) => aliveForEnd(game, id, characters));
			if (rule.aliveTotal !== undefined && alive.length !== rule.aliveTotal) return [];
			const day = game.pastDays.length;
			return [{ seats: [seatId], tag: String(day), day }];
		}
		case 'always': {
			if (rule.executions !== undefined) {
				const executed = logs
					.flatMap(executedOn)
					.filter((id) => counted(game, id, rule, characters))
					.slice(0, rule.executions);
				if (executed.length < rule.executions) return [];
				return [{ seats: executed, tag: executed.join(',') }];
			}
			const alive = aliveNonTravellers(game, characters);
			// A living seat with no character yet is unknown, so this can't be judged.
			if (alive.some((id) => counted(game, id, rule, characters) === undefined)) return [];
			const left = alive.filter((id) => counted(game, id, rule, characters));
			if (left.length > (rule.aliveAtMost ?? Infinity)) return [];
			return [{ seats: left, tag: left.join(',') }];
		}
		default:
			return [];
	}
}

/**
 * Whether a player is one a condition counts: of its `alignment` and one of its `types`, each
 * when given. Undefined when that can't be told yet (a seat with no character).
 */
function counted(
	game: Game,
	id: SeatId,
	rule: EndsGame,
	characters: CharacterLookup
): boolean | undefined {
	const alignment = alignmentOf(game, id);
	const type = typeOf(game, id, characters);
	if ((rule.alignment && alignment === undefined) || (rule.types && type === undefined))
		return undefined;
	return (
		(!rule.alignment || alignment === rule.alignment) && (!rule.types || rule.types.includes(type!))
	);
}

function winnerOf(game: Game, seatId: SeatId, rule: EndsGame, hit: Found): Alignment {
	return winnerFor(game, seatId, rule, hit.subject);
}

/**
 * The `condition` ends that hold, for the entries `which` picks (the official kind each was
 * written as, or `condition` for a custom one), so each keeps its place among the ends.
 */
export function conditionEnds(
	game: Game,
	characters: CharacterLookup,
	options: GameEndOptions,
	which: (rule: EndsGame) => boolean
): GameEnd[] {
	// Several players of one character (Legion) give one end: the first one's.
	const seen = new Set<string>();
	return endsOf(game, characters, 'condition')
		.filter(({ rule }) => which(rule))
		.flatMap(({ seatId, characterId, rule }) => {
			const name = rule.preset ?? 'condition';
			return found(game, seatId, characterId, rule, characters, options).map((hit): GameEnd => ({
				key: `${name}:${hit.tag}`,
				rule: name,
				winner: winnerOf(game, seatId, rule, hit),
				characterId,
				seats: hit.seats,
				...(hit.day !== undefined ? { day: hit.day } : {}),
				wiki: wikiOf(characterId, characters),
				holds: impaired(game, seatId, characterId, characters)
			}));
		})
		.filter((end) => !seen.has(end.key) && Boolean(seen.add(end.key)));
}

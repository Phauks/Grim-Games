/**
 * Game ends a jinx adds (`jinxes.endsGame`, `data/jinx-rules.ts`), for `rules/game-end.ts`,
 * which hands over its own reading of the board (`EndHelpers`).
 */
import type { JinxEnd } from '#lib/core/data/jinx-rules.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { DayLog, Game, SeatId } from '#lib/core/model/types.ts';
import { isExecution } from './death-causes.ts';
import type { GameEnd, GameHold } from './game-end.ts';
import { ownJinxEffects, ownJinxes } from './jinxes.ts';
import { aboutHolder, jinxApplies, type JinxEvent } from './jinx-when.ts';
import { nomineesNominateNow } from './nominations.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** How `rules/game-end.ts` reads the board, so a jinx end counts as its own ends do. */
export interface EndHelpers {
	/** Every day log, oldest first: index 0 is before the first Dawn. */
	logs: readonly DayLog[];
	/** The days that are over. */
	ended: readonly number[];
	executedOn: (log: DayLog) => SeatId[];
	/** Alive for the game's end. */
	alive: (seatId: SeatId) => boolean;
	/** An `impaired` hold when the player's ability may not work. */
	impaired: (seatId: SeatId, characterId: CharacterId) => GameHold[];
	/** The players carrying a character's reminder. */
	carrying: (characterId: CharacterId, label: ReminderLabel) => SeatId[];
	wiki: (characterId: CharacterId) => string;
}

/** What each jinx end is called on the board, by the official kind or the event. */
const END_NAMES: Readonly<Record<string, GameEnd['rule']>> = {
	'nominated-marked-executed': 'nominated-marked-executed',
	'marked-executed': 'marked-executed',
	executed: 'jinx-executed',
	'day-without-execution': 'day-without-execution',
	'day-ends': 'day-without-execution',
	'ability-stopped': 'partner-stops',
	'ability-used': 'partner-stops'
};

/**
 * The executions among `targets` an `executed` jinx end is about, by day: with
 * `nominatedBySelf`, only those `nominators` nominated (each nomination once); with `died`,
 * players who died by execution, logged or not, on the latest day they were executed.
 */
function executedAmong(
	game: Game,
	characters: CharacterLookup,
	at: EndHelpers,
	targets: readonly SeatId[],
	end: JinxEnd,
	nominators: readonly SeatId[]
): { seatId: SeatId; day?: number; nominator?: SeatId }[] {
	if (end.died) {
		return targets.flatMap((seatId) => {
			const seat = game.seats[seatId];
			if (!seat.dead || !isExecution(seat.deathCause, characters)) return [];
			const day = at.logs.findLastIndex((log) => at.executedOn(log).includes(seatId));
			return [{ seatId, ...(day < 0 ? {} : { day }) }];
		});
	}
	return at.logs.flatMap((log, day) => {
		const executed = at.executedOn(log).filter((s) => targets.includes(s));
		if (!end.nominatedBySelf) return executed.map((seatId) => ({ seatId, day }));
		return log.entries.flatMap((entry) =>
			entry.kind === 'nomination' &&
			nominators.includes(entry.nominator) &&
			executed.includes(entry.nominee)
				? [{ seatId: entry.nominee, day, nominator: entry.nominator }]
				: []
		);
	});
}

/** The players whose true character is `characterId`. */
function playing(game: Game, characterId: CharacterId, characters: CharacterLookup): SeatId[] {
	return game.seating.filter((id) => trueCharacter(game, id, characters) === characterId);
}

/**
 * Ends a jinx adds between a character in play and its partner (`jinxes.endsGame`, a
 * `condition` or an official kind read as one, `data/jinx-rules.ts`), by its event:
 * - `executed`: a player it is about was executed (`subject`: its own, the partner's, or the
 *   one carrying the partner's token). With `nominatedBySelf`, its own player nominated them
 *   (the Leviathan or Riot and the Monk's or Innkeeper's Safe, the Exorcist's Chosen, the
 *   Soldier, https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes); a token's
 *   protection may not have worked if the partner's player is drunk or poisoned, a hold
 *   (`seats`: who was executed, then who nominated them). With `died`, they died of it,
 *   logged or not (the Grandchild);
 * - `day-ends`: day `day` ended (with none, the latest), with `noExecution` with no
 *   execution, and with `bothAlive` while its and the partner's players live, which replaces
 *   the character's own end that day (`replaced`) unless the partner's ability may not work
 *   (the Leviathan and the Mayor on day 5, `seats`: both);
 * - `ability-used`: a player it is about used their ability by day, with `stops` to stop this
 *   character's (the Mayor stopping the riot,
 *   https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes): `winner` wins if exactly
 *   `alive` of its players are alive, otherwise the other team. A drunk or poisoned user may
 *   not have done it: a hold (`seats`: the user, then its living players).
 * Each keeps the board name of its official kind (`END_NAMES`). An end's `when` must hold too,
 * at the moment of its event (M44). The `gained-end` and `night-instead` kinds are read where
 * those ends are (`dead-without-demon.ts`, the extra day in `game-end.ts`).
 */
export function jinxEnds(
	game: Game,
	characters: CharacterLookup,
	at: EndHelpers
): { ends: GameEnd[]; replaced: Set<string> } {
	const ends: GameEnd[] = [];
	const replaced = new Set<string>();
	const owners = new Set(game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? []));
	const logs = at.logs;
	/** The moment `seatId` was executed on day `day`, for the end's `when`. */
	const execution = (day: number, seatId: SeatId): JinxEvent | undefined => {
		const entries = logs[day]?.entries ?? [];
		const i = entries.findIndex((e) => e.kind === 'execution' && e.seatId === seatId);
		if (i < 0) return undefined;
		const entry = entries[i];
		const alive = entry.kind === 'execution' ? entry.alive : undefined;
		return { day, entries: entries.slice(0, i + 1), ...(alive ? { alive } : {}) };
	};
	for (const owner of owners) {
		const seats = playing(game, owner, characters);
		const found = ownJinxes(game, owner, (r) => r.endsGame !== undefined, characters);
		for (const { partner, rule } of found) {
			const end = rule.endsGame!;
			if (end.winner === undefined || aboutHolder(end)) continue;
			const holds = (event?: JinxEvent) =>
				jinxApplies(game, owner, partner, end, characters, event ? { event } : {});
			const partners = playing(game, partner, characters);
			const base = {
				winner: end.winner,
				characterId: owner,
				jinxedWith: partner,
				wiki: at.wiki(owner)
			};
			const partnerImpaired = () => partners.flatMap((id) => at.impaired(id, partner));
			if (end.kind !== 'condition') continue;
			const name = END_NAMES[end.preset ?? end.event!];
			if (end.event === 'executed') {
				const targets =
					end.subject === 'marked'
						? at.carrying(partner, end.token!)
						: end.subject === 'partner'
							? partners
							: seats;
				for (const hit of executedAmong(game, characters, at, targets, end, seats)) {
					if (!holds(hit.day === undefined ? undefined : execution(hit.day, hit.seatId))) continue;
					const by = hit.nominator;
					const perDay = !end.preset || end.preset === 'executed';
					ends.push({
						...base,
						key: `jinx:${owner}:${partner}:${hit.seatId}${perDay ? `:${hit.day}` : ''}`,
						rule: name,
						seats: by ? [hit.seatId, by] : [hit.seatId],
						holds: end.subject === 'marked' && end.nominatedBySelf ? partnerImpaired() : []
					});
				}
			} else if (end.event === 'ability-used') {
				if (!holds()) continue;
				const users = end.subject === 'self' ? seats : partners;
				const user = end.subject === 'self' ? owner : partner;
				for (const entry of logs.flatMap((log) => log.entries)) {
					if (entry.kind !== 'ability' || (end.stops && entry.stops !== owner)) continue;
					if (entry.characterId !== user || !users.includes(entry.seatId)) continue;
					const alive = seats.filter(at.alive);
					const loser = end.winner === 'good' ? 'evil' : 'good';
					ends.push({
						...base,
						winner: end.alive === undefined || alive.length === end.alive ? end.winner : loser,
						key: `jinx:${owner}:${partner}:${entry.entryId}`,
						rule: name,
						seats: [entry.seatId, ...alive],
						holds: at.impaired(entry.seatId, user)
					});
				}
			} else if (end.event === 'day-ends') {
				const day = end.day ?? Math.max(0, ...at.ended);
				if (!at.ended.includes(day)) continue;
				if (end.noExecution && at.executedOn(logs[day]).length > 0) continue;
				if (!holds({ day, entries: logs[day].entries })) continue;
				const alive = (ids: SeatId[]) => ids.filter(at.alive);
				const [own, theirs] = [alive(seats), alive(partners)];
				if (end.bothAlive && (own.length === 0 || theirs.length === 0)) continue;
				const holdsGame = partnerImpaired();
				if (end.bothAlive && holdsGame.length === 0) replaced.add(`${owner}:${day}`);
				ends.push({
					...base,
					key: `jinx:${owner}:${partner}:${day}`,
					rule: name,
					seats: end.bothAlive ? [...own, ...theirs] : own,
					day,
					holds: holdsGame
				});
			}
		}
	}
	return { ends, replaced };
}

/** A player who may stop `owner`'s ability by a jinx (`jinxStoppers`), and whether they did. */
export interface JinxStopper {
	partner: CharacterId;
	seatId: SeatId;
	stopped: boolean;
}

/**
 * The players who may stop `owner`'s ability today by a jinx (`ability-stopped`, the Mayor
 * stopping the riot, https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes): the
 * partner's players, while `owner`'s ability is active (with `nomineesNominate`, while its
 * nominees nominate straight away, `nomineesNominateNow`, the riot; else while a living
 * player is `owner`) or once one of them stopped it today. Their choice is a day use with
 * `stops`.
 */
export function jinxStoppers(
	game: Game,
	owner: CharacterId,
	characters: CharacterLookup
): JinxStopper[] {
	const on =
		rulesFor(game, owner, characters)?.nomineesNominate !== undefined
			? nomineesNominateNow(game, characters).includes(owner)
			: playing(game, owner, characters).some((s) => !game.seats[s].dead);
	const stops = ownJinxEffects(
		game,
		owner,
		'endsGame',
		characters,
		(e) => e.kind === 'condition' && e.event === 'ability-used' && e.stops === true
	);
	return stops.flatMap(({ partner }) =>
		playing(game, partner, characters).flatMap((seatId): JinxStopper[] => {
			const stopped = game.today.entries.some(
				(e) =>
					e.kind === 'ability' &&
					e.seatId === seatId &&
					e.characterId === partner &&
					e.stops === owner
			);
			return on || stopped ? [{ partner, seatId, stopped }] : [];
		})
	);
}

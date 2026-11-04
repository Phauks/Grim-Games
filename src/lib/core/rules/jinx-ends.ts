/**
 * Game ends a jinx adds (`jinxes.endsGame`, `data/jinx-rules.ts`), for `rules/game-end.ts`,
 * which hands over its own reading of the board (`EndHelpers`).
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { DayLog, Game, SeatId } from '#lib/core/model/types.ts';
import { isExecution } from './death-causes.ts';
import type { GameEnd, GameHold } from './game-end.ts';
import { ownJinxEffects, ownJinxes } from './jinxes.ts';
import { aboutHolder, jinxApplies, type JinxEvent } from './jinx-when.ts';
import { nomineesNominateNow } from './nominations.ts';

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

/** The players whose true character is `characterId`. */
function playing(game: Game, characterId: CharacterId, characters: CharacterLookup): SeatId[] {
	return game.seating.filter((id) => trueCharacter(game, id, characters) === characterId);
}

/**
 * Ends a jinx adds between a character in play and its partner (`jinxes.endsGame`), each
 * page's Related Jinxes:
 * - `nominated-marked-executed`: its player nominated and executed the player with the
 *   partner's token, or the partner's player (the Leviathan or Riot and the Monk's or
 *   Innkeeper's Safe, the Exorcist's Chosen, the Soldier,
 *   https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes). A token's protection
 *   may not have worked if the partner's player is drunk or poisoned: a hold, the
 *   Storyteller's call (`seats`: who was executed, then who nominated them);
 * - `marked-executed`: while it is in play, alive or dead, the player with the partner's
 *   token died by execution (the Grandchild, `seats`: them);
 * - `executed` (M44, a custom script's jinx): its own player, or with `player: "partner"` the
 *   partner's, was executed, so `winner` wins (`jinx-executed`, `seats`: them);
 * - `day-without-execution`: its player and the partner's were alive when day `day` ended
 *   with no execution (the Leviathan and the Mayor on day 5, `seats`: both); with no `day`
 *   (its `when` has `final-day`), the latest day that ended. It replaces the character's own
 *   end that day (`replaced`), unless the partner's ability may not work;
 * - `partner-stops`: the partner's player stopped its ability, a day use logged with `stops`
 *   (the Mayor stopping the riot, https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes):
 *   `winner` wins if exactly `alive` of its players are alive, otherwise the other team. A
 *   drunk or poisoned partner may not have stopped it: a hold (`seats`: the partner's player,
 *   then its living players).
 * An end's `when` must hold too, at the moment of its event (M44): an execution's day and
 * who was alive just before it (`JinxEvent`), the day that ended; `partner-stops` now. The
 * `partner-end` and `partner-chooses` kinds are read where those ends are
 * (`dead-without-demon.ts`, the extra day in `game-end.ts`).
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
			if (end.kind === 'nominated-marked-executed') {
				const targets = end.token ? at.carrying(partner, end.token) : partners;
				logs.forEach((log, day) => {
					const executed = at.executedOn(log);
					for (const entry of log.entries) {
						if (entry.kind !== 'nomination' || !seats.includes(entry.nominator)) continue;
						const target = entry.nominee;
						if (!targets.includes(target) || !executed.includes(target)) continue;
						if (!holds(execution(day, target))) continue;
						ends.push({
							...base,
							key: `jinx:${owner}:${partner}:${target}`,
							rule: 'nominated-marked-executed',
							seats: [target, entry.nominator],
							holds: end.token ? partnerImpaired() : []
						});
					}
				});
			} else if (end.kind === 'marked-executed') {
				for (const target of at.carrying(partner, end.token!)) {
					const seat = game.seats[target];
					if (!seat.dead || !isExecution(seat.deathCause, characters)) continue;
					const day = logs.findLastIndex((log) => at.executedOn(log).includes(target));
					if (!holds(day < 0 ? undefined : execution(day, target))) continue;
					ends.push({
						...base,
						key: `jinx:${owner}:${partner}:${target}`,
						rule: 'marked-executed',
						seats: [target],
						holds: []
					});
				}
			} else if (end.kind === 'executed') {
				const targets = end.player === 'partner' ? partners : seats;
				logs.forEach((log, day) => {
					for (const target of at.executedOn(log)) {
						if (!targets.includes(target) || !holds(execution(day, target))) continue;
						ends.push({
							...base,
							key: `jinx:${owner}:${partner}:${target}:${day}`,
							rule: 'jinx-executed',
							seats: [target],
							holds: []
						});
					}
				});
			} else if (end.kind === 'partner-stops') {
				if (!holds()) continue;
				for (const entry of logs.flatMap((log) => log.entries)) {
					if (entry.kind !== 'ability' || entry.stops !== owner) continue;
					if (entry.characterId !== partner || !partners.includes(entry.seatId)) continue;
					const alive = seats.filter(at.alive);
					const loser = end.winner === 'good' ? 'evil' : 'good';
					ends.push({
						...base,
						winner: alive.length === end.alive ? end.winner : loser,
						key: `jinx:${owner}:${partner}:${entry.entryId}`,
						rule: 'partner-stops',
						seats: [entry.seatId, ...alive],
						holds: at.impaired(entry.seatId, partner)
					});
				}
			} else if (end.kind === 'day-without-execution') {
				const day = end.day ?? Math.max(0, ...at.ended);
				if (!at.ended.includes(day)) continue;
				if (at.executedOn(logs[day]).length > 0) continue;
				if (!holds({ day, entries: logs[day].entries })) continue;
				const alive = (ids: SeatId[]) => ids.filter(at.alive);
				const [own, theirs] = [alive(seats), alive(partners)];
				if (own.length === 0 || theirs.length === 0) continue;
				const holdsGame = partnerImpaired();
				if (holdsGame.length === 0) replaced.add(`${owner}:${day}`);
				ends.push({
					...base,
					key: `jinx:${owner}:${partner}:${day}`,
					rule: 'day-without-execution',
					seats: [...own, ...theirs],
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
 * The players who may stop `owner`'s ability today by a jinx (`partner-stops`, the Mayor
 * stopping the riot, https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes): the
 * partner's players, while `owner`'s nominees nominate straight away (`nomineesNominateNow`,
 * the riot) or once one of them stopped it today. Their choice is a day use with `stops`.
 */
export function jinxStoppers(
	game: Game,
	owner: CharacterId,
	characters: CharacterLookup
): JinxStopper[] {
	const on = nomineesNominateNow(game, characters).includes(owner);
	const stops = ownJinxEffects(
		game,
		owner,
		'endsGame',
		characters,
		(e) => e.kind === 'partner-stops'
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

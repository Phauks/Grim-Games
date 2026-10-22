/**
 * Players whose character changed since dawn, from the game's log, so the night order can
 * wake each of them to learn it (the audit in /mnt/project-files/character-changes, Trevor
 * 2026-10-19: "go ahead on character changes"). Abilities that change a character tell the
 * player: the new Imp is woken and shown the Imp token
 * (https://wiki.bloodontheclocktower.com/Imp), as is a player the Pit-Hag changes
 * (https://wiki.bloodontheclocktower.com/Pit-Hag).
 *
 * The game at the most recent New day is compared with the game now, seat by seat, so a
 * change undone or changed back is not listed. Before any New day nothing is listed: the
 * first night's tokens are still being set up.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { replay, type GameLog } from './log.ts';

export interface CharacterChange {
	seatId: SeatId;
	/** The character the seat held at dawn. */
	from: CharacterId;
	/** The character it holds now. */
	characterId: CharacterId;
}

/** The game at the most recent New day, or undefined before the first one. */
function atDawn(log: GameLog): Game | undefined {
	const applied = log.entries.slice(0, log.cursor);
	const dawn = applied.findLastIndex((e) => e.events.some((ev) => ev.type === 'DayStarted'));
	return dawn < 0 ? undefined : replay({ entries: applied, cursor: dawn + 1 });
}

/** Seats that held a character at dawn and hold a different one now, in seating order. */
export function changedCharacters(log: GameLog, game: Game): CharacterChange[] {
	const before = atDawn(log);
	if (!before) return [];
	return game.seating.flatMap((seatId) => {
		const from = before.seats[seatId]?.characterId;
		const now = game.seats[seatId]?.characterId;
		return from && now && from !== now ? [{ seatId, from, characterId: now }] : [];
	});
}

/**
 * Players alive at the most recent New day and dead now, in seating order: who "died today"
 * for abilities such as the Godfather's (https://wiki.bloodontheclocktower.com/Godfather),
 * however they died (executed, or killed by day by the Slayer, the Tinker...). Before any
 * New day nothing is listed.
 */
export function diedToday(log: GameLog, game: Game): SeatId[] {
	const before = atDawn(log);
	if (!before) return [];
	return game.seating.filter((s) => before.seats[s]?.dead === false && game.seats[s]?.dead);
}

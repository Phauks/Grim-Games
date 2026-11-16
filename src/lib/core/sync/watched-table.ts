import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import type { SharedGrimoire } from './shared-grimoire.ts';

/** What a watched board shows its players' view: the room's own table, and how the game ended. */
export interface WatchedTable {
	table?: PublicGameState;
	ended?: { winner?: 'good' | 'evil'; reason?: string };
}

/**
 * The table and its end as sent with a grimoire, trusted as phones trust the room's own
 * (the Storyteller's device sent both); a missing or malformed part is left out.
 */
export function watchedTable(shared: SharedGrimoire): WatchedTable {
	const table = shared.table as PublicGameState | undefined;
	const ended = shared.ended as WatchedTable['ended'] | undefined;
	const tableOk = typeof table === 'object' && table !== null && Array.isArray(table.seats);
	const endedOk = typeof ended === 'object' && ended !== null;
	const winner =
		endedOk && (ended.winner === 'good' || ended.winner === 'evil') ? ended.winner : undefined;
	const reason = endedOk && typeof ended.reason === 'string' ? ended.reason : undefined;
	return {
		...(tableOk ? { table } : {}),
		...(endedOk ? { ended: { ...(winner ? { winner } : {}), ...(reason ? { reason } : {}) } } : {})
	};
}

/**
 * What a grimoire sent to another device carries for its players' view: the seated players'
 * pictures, the table phones get, and how the game ended, each only when there is one.
 */
export function watchedParts(
	pictures: Partial<Record<SeatId, string>>,
	table: PublicGameState | undefined,
	over: { winner?: 'good' | 'evil'; reason?: string } | undefined
): { pictures?: Partial<Record<SeatId, string>>; table?: PublicGameState; ended?: object } {
	const ended = over && {
		...(over.winner ? { winner: over.winner } : {}),
		...(over.reason ? { reason: over.reason } : {})
	};
	return {
		...(Object.keys(pictures).length ? { pictures } : {}),
		...(table ? { table } : {}),
		...(ended ? { ended } : {})
	};
}

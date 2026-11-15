import type { PublicGameState } from '#lib/core/sync/public-projection.ts';
import type { SharedGrimoire } from '#lib/core/sync/shared-grimoire.ts';
import type { WatchedTable } from './grimoire.svelte.ts';

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

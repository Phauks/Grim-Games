import type { SeatId } from '#lib/core/model/index.ts';
import { seatNominations } from '#lib/core/rules/index.ts';
import type { Grimoire } from './grimoire.svelte.ts';

/**
 * Records, changes or clears one side of a seat's nomination today (Track nominations), in
 * the game's day log: `made` is who the seat nominated, `received` who nominated it. `other`
 * undefined clears it. Shared by the seat sheet's rows and the board's nomination marks.
 * Returns the pair when a nomination was recorded or changed, for what it sets off.
 */
export function recordNomination(
	grimoire: Grimoire,
	seatId: SeatId,
	side: 'made' | 'received',
	other: SeatId | undefined
): { nominator: SeatId; nominee: SeatId } | undefined {
	const today = seatNominations(grimoire.game, seatId);
	const entry = side === 'made' ? today.made : today.received;
	if (!other) {
		if (entry) grimoire.run({ type: 'RemoveDayEntry', entryId: entry.entryId });
		return undefined;
	}
	const pair =
		side === 'made' ? { nominator: seatId, nominee: other } : { nominator: other, nominee: seatId };
	const done = grimoire.run(
		entry
			? { type: 'EditNomination', entryId: entry.entryId, ...pair }
			: { type: 'Nominate', ...pair }
	);
	return done ? pair : undefined;
}

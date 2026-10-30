/**
 * What should hold across every test room phone's view at once (features/test-room): problems a player
 * would notice, or a leak they shouldn't see. Each problem is one line for the log.
 */
import type { PlayerView } from '#lib/core/sync/room-protocol.ts';

export function viewProblems(views: ReadonlyMap<string, PlayerView>): string[] {
	const problems: string[] = [];
	const bySeat = new Map<string, string[]>();
	for (const [name, view] of views) {
		const seatId = view.me.seatId;
		const seats = view.public?.seats ?? [];
		if (seatId) {
			bySeat.set(seatId, [...(bySeat.get(seatId) ?? []), name]);
			if (view.public && !seats.some((s) => s.seatId === seatId)) {
				problems.push(`${name} sits in ${seatId}, which isn't at the table`);
			}
			if (!view.takenSeats.includes(seatId)) {
				problems.push(`${name}'s seat ${seatId} isn't in its taken seats`);
			}
		}
		if (view.role && !seatId) problems.push(`${name} was sent a character with no seat`);
		if (new Set(view.takenSeats).size !== view.takenSeats.length) {
			problems.push(`${name} sees a seat taken twice`);
		}
		const numbers = view.countOff?.tokens.map((t) => t.number) ?? [];
		if (new Set(numbers).size !== numbers.length) {
			problems.push(`${name} sees a count off number held twice`);
		}
		if ((view.countOff?.tokens.filter((t) => t.mine).length ?? 0) > 1) {
			problems.push(`${name} holds more than one count off number`);
		}
		if (view.vote && seatId) problems.push(`${name} is seated but sees the spectators' vote`);
	}
	for (const [seatId, names] of bySeat) {
		if (names.length > 1) problems.push(`${names.join(' and ')} all sit in ${seatId}`);
	}
	return problems;
}

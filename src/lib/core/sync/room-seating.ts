/**
 * Phones are seated by name (Trevor, 2026-10-26: "I wanna drop the seat picking"): a phone sits
 * in the seat whose player name is the name it gave, so naming a seat on the board seats it.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomMember } from './room.ts';

export interface SeatChange {
	memberId: string;
	/** Missing: the member leaves their seat. */
	seatId?: SeatId;
}

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

/**
 * The seat changes that make each phone sit where its name is. A seat goes to the phone already
 * in it if the name still matches, else to the first matching phone that is here (`here`), else
 * to the first matching phone. A phone whose name is on no seat leaves its seat.
 */
export function seatChanges(
	members: readonly RoomMember[],
	seats: readonly { seatId: SeatId; playerName?: string }[],
	here: (memberId: string) => boolean = () => true
): SeatChange[] {
	const want: Record<string, SeatId> = {};
	const named = members.filter((m) => m.name);
	for (const seat of seats) {
		if (!seat.playerName) continue;
		const name = key(seat.playerName);
		const free = named.filter((m) => key(m.name!) === name && !(m.memberId in want));
		const pick =
			free.find((m) => m.seatId === seat.seatId) ?? free.find((m) => here(m.memberId)) ?? free[0];
		if (pick) want[pick.memberId] = seat.seatId;
	}
	return members.flatMap((m) => {
		const seatId = want[m.memberId];
		if (seatId === m.seatId) return [];
		return [seatId ? { memberId: m.memberId, seatId } : { memberId: m.memberId }];
	});
}

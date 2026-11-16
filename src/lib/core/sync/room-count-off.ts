/**
 * Count off (plan J40; Trevor, 2026-10-30: "a count off, ppl select, and call it a day if it
 * seems accurate"). The Storyteller locks who is at the top of the clock, number 1 (Trevor,
 * 2026-11-16, after a playtest where nobody knew where to start), and then every phone taps the
 * number it counts to going clockwise, in any order. Each number shows the name of who
 * holds it, phone or not: the Storyteller names numbers for players without a phone. Done, on
 * the Storyteller's device, puts that order and those names on the board (`countOffSeats`).
 */
import type { PlayerName } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { numberedNames } from './room-names.ts';
import { isOpenSeat } from './room-seating-open.ts';
import type { ClientMessage } from './room-protocol.ts';
import type { RoomState } from './room.ts';

/** Who holds a number: a phone in the room, or a name the Storyteller typed. */
export type CountHolder = { number: number; memberId: string } | { number: number; name: string };

export interface CountOff {
	counts: CountHolder[];
}

/** The count as every device sees it: each held number with its player's name. */
export interface CountOffView {
	/** Numbers run from 1 to this. */
	size: number;
	tokens: { number: number; name: string; mine?: true }[];
}

const MAX_NAME = 40;
const cleanName = (name: unknown) =>
	typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';

/** The phones at this game with a name, which are the ones that can count. */
function counting(room: RoomState) {
	return room.members.filter((m) => m.name && (m.seatId || m.game === room.gameId));
}

/** As many numbers as seats, or as phones and named players if there are more. */
export function countOffSize(room: RoomState): number {
	const held = Math.max(0, ...(room.countOff?.counts.map((c) => c.number) ?? []));
	return Math.max(room.public?.seats.length ?? 0, counting(room).length, held);
}

/**
 * Starts a count off, with `first` locked as 1 when given (a phone by member id, or a name);
 * otherwise the Storyteller locks 1 next. A count off already open stays as it is.
 */
export function startCountOff(
	room: RoomState,
	first: { memberId?: unknown; name?: unknown } = {}
): RoomState {
	if (room.countOff) return room;
	const member = room.members.find((m) => m.memberId === first.memberId && m.name);
	const name = cleanName(first.name);
	const holder: CountHolder | undefined = member
		? { number: 1, memberId: member.memberId }
		: name
			? { number: 1, name }
			: undefined;
	return { ...room, countOff: { counts: holder ? [holder] : [] } };
}

/** Ends it, by Done or by Cancel; a new game ends it too. */
export function endCountOff(room: RoomState): RoomState {
	if (!room.countOff) return room;
	const { countOff: _count, ...rest } = room;
	void _count;
	return rest;
}

const valid = (room: RoomState, number: unknown): number is number =>
	typeof number === 'number' &&
	Number.isInteger(number) &&
	number >= 1 &&
	number <= countOffSize(room);

/**
 * Whether phones may tap numbers yet: once the Storyteller has locked who is 1, the top of the
 * clock (Trevor, 2026-11-16: "lock 1, only allow selecting once a 1 is locked"; then "they can
 * go in any order").
 */
export function countOffLocked(view: Pick<CountOffView, 'tokens'>): boolean {
	return view.tokens.some((token) => token.number === 1);
}

/**
 * A phone taps its number: it holds that one only. Number 1 is the Storyteller's to set, and
 * nothing can be tapped before it is. `free` is a tap on a number this phone saw free: if
 * another phone took it first, the tap is refused rather than taking it from them (several
 * players tapping at once, Trevor 2026-11-16). Without `free`, the player confirmed taking it
 * from whoever holds it, who must tap again. `null` lets this phone's number go, for a player
 * who tapped the wrong one ("they couldn't unselect a seat once it had been selected").
 */
export function takeCount(
	room: RoomState,
	memberId: string,
	number: unknown,
	free?: unknown
): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!room.countOff || !member?.name) return room;
	const mine = (c: CountHolder) => 'memberId' in c && c.memberId === memberId;
	// The phone the Storyteller locked as 1 stays 1.
	if (room.countOff.counts.some((c) => c.number === 1 && mine(c))) return room;
	const others = room.countOff.counts.filter((c) => !mine(c));
	if (number === null) {
		return others.length === room.countOff.counts.length
			? room
			: { ...room, countOff: { counts: others } };
	}
	if (!valid(room, number) || number === 1) return room;
	if (!room.countOff.counts.some((c) => c.number === 1)) return room;
	if (free === true && others.some((c) => c.number === number)) return room;
	const counts = others.filter((c) => c.number !== number);
	return { ...room, countOff: { counts: [...counts, { number, memberId }] } };
}

/**
 * The Storyteller sets who holds a number: a phone in the room by `memberId` (who then holds
 * that number only), or a typed name for a player without a phone. Neither clears it. This is
 * how 1 is locked.
 */
export function nameCount(
	room: RoomState,
	number: unknown,
	name: unknown,
	memberId?: unknown
): RoomState {
	if (!room.countOff || !valid(room, number)) return room;
	const member = room.members.find((m) => m.memberId === memberId && m.name);
	const counts = room.countOff.counts.filter(
		(c) => c.number !== number && !(member && 'memberId' in c && c.memberId === member.memberId)
	);
	if (member) {
		return {
			...room,
			countOff: { counts: [...counts, { number, memberId: member.memberId }] }
		};
	}
	const typed = cleanName(name);
	return { ...room, countOff: { counts: typed ? [...counts, { number, name: typed }] : counts } };
}

/** The count with names, as the Storyteller numbers shared names; `memberId` marks its own. */
export function countOffView(
	room: RoomState,
	present?: ReadonlySet<string>,
	memberId?: string
): CountOffView | undefined {
	if (!room.countOff) return undefined;
	const numbered = numberedNames(room, present);
	const tokens = room.countOff.counts.flatMap((c) => {
		if ('name' in c) return [{ number: c.number, name: c.name }];
		const member = room.members.find((m) => m.memberId === c.memberId);
		if (!member?.name) return [];
		const token = { number: c.number, name: numbered[c.memberId] ?? member.name };
		return [c.memberId === memberId ? { ...token, mine: true as const } : token];
	});
	return { size: countOffSize(room), tokens: tokens.sort((a, b) => a.number - b.number) };
}

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

/**
 * The board's seats in counted order (the CountOff command): seat N goes to whoever holds N.
 * A held number takes the seat with that player's name, else an open seat renamed, else a new
 * seat. Seats no one counted to fill the numbers no one holds, in their old order, and any
 * left over follow the last number.
 */
export function countOffSeats(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string }>>,
	view: CountOffView
): { seatId?: SeatId; playerName?: PlayerName }[] {
	const order: ({ seatId?: SeatId; playerName?: PlayerName } | undefined)[] = Array(view.size);
	const used = new Set<SeatId>();
	const named = new Map(view.tokens.map((t) => [t.number, t.name]));
	for (const [number, name] of named) {
		const seatId = seating.find(
			(id) => !used.has(id) && key(seats[id]?.playerName ?? '') === key(name)
		);
		if (seatId) {
			used.add(seatId);
			order[number - 1] = { seatId };
		}
	}
	for (const [number, name] of named) {
		if (order[number - 1]) continue;
		const seatId = seating.find((id) => !used.has(id) && isOpenSeat(seats[id]));
		if (seatId) used.add(seatId);
		order[number - 1] = { ...(seatId ? { seatId } : {}), playerName: name as PlayerName };
	}
	const rest = seating.filter((id) => !used.has(id));
	const filled = [...order].map((entry) => entry ?? (rest.length ? { seatId: rest.shift()! } : {}));
	return [...filled, ...rest.map((seatId) => ({ seatId }))];
}

/** Applies the Storyteller's count off messages: start, Done or Cancel, and naming a number. */
export function countOffMessage(
	room: RoomState,
	message: Extract<ClientMessage, { type: 'count-off' | 'end-count-off' | 'name-count' }>
): RoomState {
	if (message.type === 'count-off') return startCountOff(room, message.first ?? {});
	if (message.type === 'end-count-off') return endCountOff(room);
	return nameCount(room, message.number, message.name, message.memberId);
}

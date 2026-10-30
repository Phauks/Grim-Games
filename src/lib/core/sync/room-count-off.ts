/**
 * Count off (plan J40; Trevor, 2026-10-30: "a count off, ppl select, and call it a day if it
 * seems accurate"). The Storyteller names the player at the top of the clock, number 1, and
 * every phone taps the number it counts to going clockwise. Each number shows the name of who
 * holds it, phone or not: the Storyteller names numbers for players without a phone. Done, on
 * the Storyteller's device, puts that order and those names on the board (`countOffSeats`).
 */
import type { PlayerName } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { numberedNames } from './room-names.ts';
import { isOpenSeat } from './room-seating-open.ts';
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

/** Starts a count off with `first` (a phone, or a typed name) as number 1. */
export function startCountOff(
	room: RoomState,
	first: { memberId?: unknown; name?: unknown }
): RoomState {
	const member = room.members.find((m) => m.memberId === first.memberId && m.name);
	const name = cleanName(first.name);
	if (!member && !name) return room;
	const holder: CountHolder = member
		? { number: 1, memberId: member.memberId }
		: { number: 1, name };
	return { ...room, countOff: { counts: [holder] } };
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

/** A phone taps its number: it holds that one only, and whoever held it must tap again. */
export function takeCount(room: RoomState, memberId: string, number: unknown): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!room.countOff || !member?.name || !valid(room, number)) return room;
	const counts = room.countOff.counts.filter(
		(c) => c.number !== number && !('memberId' in c && c.memberId === memberId)
	);
	return { ...room, countOff: { counts: [...counts, { number, memberId }] } };
}

/** The Storyteller names a number for a player without a phone, or clears it with no name. */
export function nameCount(room: RoomState, number: unknown, name: unknown): RoomState {
	if (!room.countOff || !valid(room, number)) return room;
	const counts = room.countOff.counts.filter((c) => c.number !== number);
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

/** Someone who can be number 1, keyed by their seat or phone so two with one name both show. */
export interface CountOffFirst {
	key: string;
	name: string;
	first: { memberId: string } | { name: string };
}

/**
 * Who can be 1 (CountOffDialog): the board's named players in seat order, then the phones at
 * the game with no seat whose name is not already on the board. Names repeat (two seats, or
 * two phones, called the same), so each is keyed by its seat or phone, never its name.
 */
export function countOffFirsts(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string }>>,
	members: readonly { memberId: string; name?: string }[],
	unseated: readonly { memberId: string; name?: string }[]
): CountOffFirst[] {
	const memberFor = (name: string) => members.find((m) => m.name && key(m.name) === key(name));
	const board = seating.flatMap((id): CountOffFirst[] => {
		const name = seats[id]?.playerName;
		if (isOpenSeat(seats[id]) || !name) return [];
		const member = memberFor(name);
		return [{ key: `seat:${id}`, name, first: member ? { memberId: member.memberId } : { name } }];
	});
	const listed = new Set(board.map((c) => key(c.name)));
	const phones = unseated.flatMap((m): CountOffFirst[] =>
		m.name && !listed.has(key(m.name))
			? [{ key: `member:${m.memberId}`, name: m.name, first: { memberId: m.memberId } }]
			: []
	);
	return [...board, ...phones];
}

import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomMember } from './room.ts';

/**
 * Which seats have a phone in the room, connected now or away, and how many connected phones
 * have no seat yet, for the candles beside Setup on players' phones (Trevor, 2026-10-28). A
 * phone drops whenever it locks or leaves the app and comes back when it is looked at again,
 * so away is common and not a fault.
 */
export interface SeatPresence {
	here: SeatId[];
	away: SeatId[];
	/** Connected phones with no seat: more players in the room than seats on the board. */
	unseated: number;
}

export function seatPresence(
	members: readonly RoomMember[],
	isHere: (memberId: string) => boolean
): SeatPresence {
	const presence: SeatPresence = { here: [], away: [], unseated: 0 };
	for (const m of members) {
		const here = isHere(m.memberId);
		if (m.seatId === undefined) presence.unseated += here ? 1 : 0;
		else (here ? presence.here : presence.away).push(m.seatId);
	}
	return presence;
}

/** Presence from the room, or nothing when it isn't one. */
export function parseSeatPresence(value: unknown): SeatPresence | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const { here, away, unseated } = value as Record<string, unknown>;
	const ids = (list: unknown) =>
		Array.isArray(list) ? list.filter((id): id is SeatId => typeof id === 'string') : [];
	return {
		here: ids(here),
		away: ids(away),
		unseated:
			typeof unseated === 'number' && Number.isInteger(unseated) && unseated > 0 ? unseated : 0
	};
}

/** How a seat's candle burns: a phone connected, a phone away, or nobody yet. */
export type CandleState = 'lit' | 'away' | 'empty';

export interface Candle {
	state: CandleState;
	/** This phone's own seat, whose flame burns red (Trevor, 2026-10-28). */
	mine: boolean;
	/** The candle's height, from 0 to 1. */
	height: number;
}

/**
 * One candle per seat, in seat order. Without a room to say who is connected (the
 * Storyteller's own player view with no room open), a seat with a player's name burns.
 */
export function seatCandles(
	seats: readonly { seatId: SeatId; playerName?: string }[],
	presence: SeatPresence | undefined,
	mySeat?: SeatId
): Candle[] {
	const heights = candleHeights(seats.map((s) => s.seatId).join(' '), seats.length);
	return seats.map((seat, i) => ({
		state: !presence
			? seat.playerName
				? 'lit'
				: 'empty'
			: presence.here.includes(seat.seatId)
				? 'lit'
				: presence.away.includes(seat.seatId)
					? 'away'
					: 'empty',
		mine: seat.seatId === mySeat,
		height: heights[i]
	}));
}

/** The least two neighbouring candles' heights differ by. */
export const NEIGHBOUR_GAP = 0.2;

/**
 * Candle heights from 0 to 1: random, but never within `NEIGHBOUR_GAP` of a neighbour's, so no
 * two candles side by side look alike (Trevor, 2026-10-28). Seeded by the seats, so a game's
 * candles stay put and another game gets new ones.
 */
export function candleHeights(seed: string, count: number): number[] {
	let state = 2166136261;
	for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
	const random = () => {
		state = (state + 0x6d2b79f5) | 0;
		let r = Math.imul(state ^ (state >>> 15), 1 | state);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
	const heights: number[] = [];
	for (let i = 0; i < count; i++) {
		const before = heights[i - 1];
		let height = random();
		if (before !== undefined && Math.abs(height - before) < NEIGHBOUR_GAP) {
			// Away from the neighbour, on whichever side has room.
			const room = 1 - NEIGHBOUR_GAP;
			height =
				before < 0.5
					? before + NEIGHBOUR_GAP + random() * (room - before)
					: before - NEIGHBOUR_GAP - random() * (before - NEIGHBOUR_GAP);
		}
		heights.push(height);
	}
	return heights;
}

/**
 * A players-only game's town (plan M55, Trevor 2026-11-05): no Storyteller in the app, so
 * each phone keeps its own seats, names, deaths and ghost votes, marked by the player as the
 * real Storyteller announces them. Kept on the device only, beside the player's guesses.
 *
 * Saved with a version, since a newer build can open a town an older one saved (CLAUDE.md).
 */
import type { CharacterId, PlayerName } from '#lib/core/data/index.ts';
import { MAX_SEATS, MIN_PLAYERS } from '#lib/core/engine/decide/shared.ts';
import type { PublicSeat } from '#lib/core/sync/public-projection.ts';

export const LOCAL_TOWN_VERSION = 1;
/** The fewest seats a town starts with: the smallest game (https://wiki.bloodontheclocktower.com/Setup). */
export const LOCAL_TOWN_MIN_SEATS = MIN_PLAYERS;
/** The seats a new town opens with, before the player changes them (Trevor, 2026-11-06). */
export const LOCAL_TOWN_START_SEATS = 7;
/** The most seats, the same cap as the Storyteller's board. */
export const LOCAL_TOWN_MAX_SEATS = MAX_SEATS;
/** Longest name kept, as a room keeps. */
export const MAX_LOCAL_NAME_LENGTH = 40;

export interface LocalSeat {
	/** Stable across renames and count changes, so guesses and notes stay on the seat. */
	id: string;
	name?: string;
	dead?: true;
	/** Only while dead. */
	voteUsed?: true;
	/** A Traveller's character: Travellers say who they are, so the player can mark it. */
	traveller?: CharacterId;
}

/** A point in % of the ring's area (seat-layout.ts's SeatPoint). */
export interface LocalPlace {
	x: number;
	y: number;
}

export interface LocalTown {
	v: typeof LOCAL_TOWN_VERSION;
	seats: LocalSeat[];
	/**
	 * Seats the player dragged to where people really sit (Trevor, 2026-11-15: "arrange tokens
	 * as desired"), by seat id; the rest sit round the ring. Left out when none are.
	 */
	placed?: Record<string, LocalPlace>;
	/**
	 * The seat picker also lists characters not on the script (Trevor, 2026-11-16, option A:
	 * a switch on the seat's sheet, kept for this game).
	 */
	offScript?: true;
}

export const emptyTown = (): LocalTown => ({ v: LOCAL_TOWN_VERSION, seats: [] });

/** A stored town, or an empty one when missing or unreadable. */
export function parseLocalTown(raw: unknown): LocalTown {
	const stored = (typeof raw === 'object' && raw !== null ? raw : {}) as {
		seats?: unknown;
		placed?: unknown;
		offScript?: unknown;
	};
	if (!Array.isArray(stored.seats)) return emptyTown();
	const seen = new Set<string>();
	const seats: LocalSeat[] = [];
	for (const value of (stored.seats as unknown[]).slice(0, LOCAL_TOWN_MAX_SEATS)) {
		if (typeof value !== 'object' || value === null) continue;
		const { id, name, dead, voteUsed, traveller } = value as Record<string, unknown>;
		if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
		seen.add(id);
		const seat: LocalSeat = { id };
		const trimmed = typeof name === 'string' ? cleanName(name) : undefined;
		if (trimmed) seat.name = trimmed;
		if (dead === true) seat.dead = true;
		if (dead === true && voteUsed === true) seat.voteUsed = true;
		if (typeof traveller === 'string' && traveller !== '') seat.traveller = traveller;
		seats.push(seat);
	}
	const town: LocalTown = { v: LOCAL_TOWN_VERSION, seats };
	if (stored.offScript === true) town.offScript = true;
	return withPlaces(town, parsePlaces(stored));
}

/** Whether the seat picker lists characters off the script too. */
export function setOffScript(town: LocalTown, on: boolean): LocalTown {
	const out: LocalTown = { ...town };
	if (on) out.offScript = true;
	else delete out.offScript;
	return out;
}

const isPercent = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;

function parsePlaces(stored: { placed?: unknown }): Record<string, LocalPlace> {
	const raw = stored.placed;
	if (typeof raw !== 'object' || raw === null) return {};
	const places: Record<string, LocalPlace> = {};
	for (const [id, value] of Object.entries(raw)) {
		const { x, y } = (typeof value === 'object' && value !== null ? value : {}) as Record<
			string,
			unknown
		>;
		if (isPercent(x) && isPercent(y)) places[id] = { x, y };
	}
	return places;
}

/** The town with `places` for its own seats only, and none kept when there are none. */
function withPlaces(town: LocalTown, places: Record<string, LocalPlace> | undefined): LocalTown {
	const ids = new Set(town.seats.map((s) => s.id));
	const kept = Object.fromEntries(Object.entries(places ?? {}).filter(([id]) => ids.has(id)));
	const out: LocalTown = { ...town };
	delete out.placed;
	if (Object.keys(kept).length) out.placed = kept;
	return out;
}

/** The town with its seats drawn at `places` (by seat id) instead of round the ring. */
export const placeSeats = (town: LocalTown, places: Record<string, LocalPlace>): LocalTown =>
	withPlaces(town, places);

/**
 * Two players swap seats (as the board's SwapSeats): each keeps their name, marks, guesses
 * and notes, and takes the other's place in the seating order.
 */
export function swapSeats(town: LocalTown, a: string, b: string): LocalTown {
	const i = town.seats.findIndex((s) => s.id === a);
	const j = town.seats.findIndex((s) => s.id === b);
	if (i < 0 || j < 0 || i === j) return town;
	const seats = [...town.seats];
	[seats[i], seats[j]] = [seats[j], seats[i]];
	return { ...town, seats };
}

/** A seat moves to `position` in the seating order (as the board's MoveSeat). */
export function moveSeat(town: LocalTown, id: string, position: number): LocalTown {
	const from = town.seats.findIndex((s) => s.id === id);
	if (from < 0) return town;
	const seats = town.seats.filter((s) => s.id !== id);
	const to = Math.max(0, Math.min(seats.length, Math.round(position)));
	seats.splice(to, 0, town.seats[from]);
	return { ...town, seats };
}

const cleanName = (name: string) => name.trim().slice(0, MAX_LOCAL_NAME_LENGTH);

/** A seat id the town hasn't used. */
function nextId(seats: readonly LocalSeat[]): string {
	const used = new Set(seats.map((s) => s.id));
	let n = seats.length + 1;
	while (used.has(`s${n}`)) n++;
	return `s${n}`;
}

/**
 * The town with `count` seats: new ones go on the end, and fewer drops the last seats, as
 * a table that loses its last players.
 */
export function withSeatCount(town: LocalTown, count: number): LocalTown {
	const target = Math.max(0, Math.min(LOCAL_TOWN_MAX_SEATS, Math.round(count)));
	const seats = town.seats.slice(0, target);
	while (seats.length < target) seats.push({ id: nextId(seats) });
	return withPlaces({ ...town, seats }, town.placed);
}

/** A new town: seven empty seats, with no None, since every game has seats. */
export const startingTown = (): LocalTown => withSeatCount(emptyTown(), LOCAL_TOWN_START_SEATS);

/** The town with one seat changed; unknown seats change nothing. */
function changeSeat(town: LocalTown, id: string, change: (seat: LocalSeat) => LocalSeat) {
	return { ...town, seats: town.seats.map((s) => (s.id === id ? change(s) : s)) };
}

/** A seat with only the given fields set, so a field turned off is left out, not stored. */
function seatOf(id: string, fields: Omit<LocalSeat, 'id'>): LocalSeat {
	const seat: LocalSeat = { id };
	if (fields.name) seat.name = fields.name;
	if (fields.dead) seat.dead = true;
	if (fields.dead && fields.voteUsed) seat.voteUsed = true;
	if (fields.traveller) seat.traveller = fields.traveller;
	return seat;
}

export function renameSeat(town: LocalTown, id: string, name: string): LocalTown {
	// Kept as typed while typing (a space before the next word), trimmed when read back.
	const typed = name.trim() ? name.slice(0, MAX_LOCAL_NAME_LENGTH) : undefined;
	return changeSeat(town, id, (seat) => seatOf(id, { ...seat, name: typed }));
}

/** Alive again also gives the ghost vote back, since only the dead have one. */
export function setDead(town: LocalTown, id: string, dead: boolean): LocalTown {
	return changeSeat(town, id, (seat) =>
		seatOf(id, { ...seat, dead: dead || undefined, voteUsed: dead ? seat.voteUsed : undefined })
	);
}

/** Only a dead seat spends its ghost vote. */
export function setVoteUsed(town: LocalTown, id: string, used: boolean): LocalTown {
	return changeSeat(town, id, (seat) => seatOf(id, { ...seat, voteUsed: used || undefined }));
}

export function setTraveller(
	town: LocalTown,
	id: string,
	traveller: CharacterId | undefined
): LocalTown {
	return changeSeat(town, id, (seat) => seatOf(id, { ...seat, traveller }));
}

/** The town as the Grim tab draws a room's: seat numbers clockwise from 1. */
export function localPublicSeats(town: LocalTown): PublicSeat[] {
	return town.seats.map((seat, i) => ({
		seatId: seat.id,
		seatNumber: i + 1,
		...(seat.name?.trim() ? { playerName: seat.name.trim() as PlayerName } : {}),
		dead: !!seat.dead,
		...(seat.dead ? { ghostVote: seat.voteUsed ? ('used' as const) : ('unused' as const) } : {}),
		...(seat.traveller ? { traveller: seat.traveller } : {})
	}));
}

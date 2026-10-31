/**
 * Travellers choose on their phones (Trevor, 2026-10-31): the player picks their Traveller and
 * the Storyteller picks its alignment (https://wiki.bloodontheclocktower.com/Glossary,
 * "Traveller"). The Storyteller sends the choice to some seats with the Travellers allowed.
 * Every chooser sees the same list; a tap holds a Traveller so no one else can take it, a tap
 * on another lets the first go, and Confirm sends it. The room takes messages one at a time,
 * so when two phones tap the same Traveller at once the first to arrive holds it.
 *
 * The room only keeps who holds what. The Storyteller's device puts a confirmed Traveller on
 * its seat and chooses the alignment, and can still change anything (warn, never lock).
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { numberedNames } from './room-names.ts';
import type { ClientMessage } from './room-protocol.ts';
import type { RoomState } from './room.ts';

export interface TravellerPick {
	/** The game it belongs to; a new game closes it. */
	gameId: string;
	/** Changes when the Storyteller sends a new choice, so a stale tap is ignored. */
	pickId: string;
	/** The Travellers allowed, in the Storyteller's order. */
	options: CharacterId[];
	/** The seats choosing. */
	seats: SeatId[];
	/** What each seat holds now. */
	holds: Partial<Record<SeatId, CharacterId>>;
	/** Seats whose hold is sent and locked. */
	confirmed: Partial<Record<SeatId, true>>;
}

/** The choice as the Storyteller's device sees it. */
export interface TravellerPickHostView {
	pickId: string;
	options: CharacterId[];
	seats: { seatId: SeatId; characterId?: CharacterId; confirmed?: true }[];
}

/** The choice as a choosing phone sees it. */
export interface TravellerPickPlayerView {
	pickId: string;
	options: CharacterId[];
	/** What this phone holds, and whether it has sent it. */
	mine?: CharacterId;
	confirmed?: true;
	/** Travellers other seats hold, with who holds them. */
	held: Partial<Record<CharacterId, string>>;
}

/** Every Traveller there is fits, with room to spare. */
const MAX_OPTIONS = 100;
const MAX_SEATS = 40;
const MAX_ID = 100;

const ids = (raw: unknown, max: number): string[] =>
	Array.isArray(raw)
		? [
				...new Set(
					raw.filter(
						(v): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID
					)
				)
			].slice(0, max)
		: [];

function current(room: RoomState): TravellerPick | undefined {
	return room.travellerPick?.gameId === room.gameId ? room.travellerPick : undefined;
}

/**
 * The Storyteller sends the choice: the Travellers allowed and the seats choosing. Sending it
 * again (another seat, other Travellers) keeps every hold that still fits. Nothing with no
 * seat or no Traveller, or for another game, is opened.
 */
export function openTravellerPick(
	room: RoomState,
	gameId: unknown,
	pickId: unknown,
	options: unknown,
	seats: unknown
): RoomState {
	if (typeof gameId !== 'string' || gameId !== room.gameId) return room;
	if (typeof pickId !== 'string' || !pickId || pickId.length > MAX_ID) return room;
	const known = new Set(room.public?.seats.map((s) => s.seatId));
	const allowed = ids(options, MAX_OPTIONS) as CharacterId[];
	const choosing = (ids(seats, MAX_SEATS) as SeatId[]).filter((s) => known.has(s));
	if (allowed.length === 0 || choosing.length === 0) return room;
	const before = current(room);
	const holds: TravellerPick['holds'] = {};
	const confirmed: TravellerPick['confirmed'] = {};
	for (const seatId of choosing) {
		const held = before?.holds[seatId];
		if (held && allowed.includes(held)) {
			holds[seatId] = held;
			if (before?.confirmed[seatId]) confirmed[seatId] = true;
		}
	}
	return {
		...room,
		travellerPick: { gameId, pickId, options: allowed, seats: choosing, holds, confirmed }
	};
}

/** Stops the choice; what was confirmed is already on the board. A new game closes it too. */
export function closeTravellerPick(room: RoomState): RoomState {
	if (!room.travellerPick) return room;
	const { travellerPick: _pick, ...rest } = room;
	void _pick;
	return rest;
}

/** The seat holding `characterId`, if any. */
function holder(pick: TravellerPick, characterId: CharacterId): SeatId | undefined {
	return (Object.keys(pick.holds) as SeatId[]).find((s) => pick.holds[s] === characterId);
}

function setSeat(
	room: RoomState,
	pick: TravellerPick,
	seatId: SeatId,
	characterId: CharacterId | undefined,
	confirm: boolean
): RoomState {
	const holds = { ...pick.holds };
	const confirmed = { ...pick.confirmed };
	if (characterId) holds[seatId] = characterId;
	else delete holds[seatId];
	if (confirm && characterId) confirmed[seatId] = true;
	else delete confirmed[seatId];
	return { ...room, travellerPick: { ...pick, holds, confirmed } };
}

/**
 * A phone taps a Traveller (or `null` to let its own go). Taken only if this phone's seat is
 * choosing and hasn't confirmed, the tap is for the open choice, and no other seat holds it.
 */
export function holdTraveller(
	room: RoomState,
	memberId: string,
	pickId: unknown,
	characterId: unknown
): RoomState {
	const pick = current(room);
	const seatId = room.members.find((m) => m.memberId === memberId)?.seatId;
	if (!pick || !seatId || pickId !== pick.pickId || !pick.seats.includes(seatId)) return room;
	if (pick.confirmed[seatId]) return room;
	if (characterId === null)
		return pick.holds[seatId] ? setSeat(room, pick, seatId, undefined, false) : room;
	if (typeof characterId !== 'string' || !pick.options.includes(characterId as CharacterId))
		return room;
	const by = holder(pick, characterId as CharacterId);
	if (by) return room;
	return setSeat(room, pick, seatId, characterId as CharacterId, false);
}

/** A phone sends the Traveller it holds; after that only the Storyteller changes it. */
export function confirmTraveller(room: RoomState, memberId: string, pickId: unknown): RoomState {
	const pick = current(room);
	const seatId = room.members.find((m) => m.memberId === memberId)?.seatId;
	if (!pick || !seatId || pickId !== pick.pickId || !pick.seats.includes(seatId)) return room;
	const held = pick.holds[seatId];
	if (!held || pick.confirmed[seatId]) return room;
	return setSeat(room, pick, seatId, held, true);
}

/**
 * The Storyteller sets a choosing seat: a Traveller to confirm it for a player without a
 * phone, or `null` to let that seat's hold go so the player can choose again. A Traveller
 * another seat holds is not taken from it.
 */
export function setTravellerFor(room: RoomState, seatId: unknown, characterId: unknown): RoomState {
	const pick = current(room);
	if (!pick || typeof seatId !== 'string' || !pick.seats.includes(seatId as SeatId)) return room;
	const seat = seatId as SeatId;
	if (characterId === null) return setSeat(room, pick, seat, undefined, false);
	if (typeof characterId !== 'string' || !pick.options.includes(characterId as CharacterId))
		return room;
	const by = holder(pick, characterId as CharacterId);
	if (by && by !== seat) return room;
	return setSeat(room, pick, seat, characterId as CharacterId, true);
}

type PickMessage = Extract<
	ClientMessage,
	{
		type:
			| 'hold-traveller'
			| 'confirm-traveller'
			| 'open-traveller-pick'
			| 'close-traveller-pick'
			| 'traveller-for';
	}
>;

/**
 * Applies a Traveller choice message: a phone's tap or Confirm (with its `memberId`), or the
 * Storyteller's send, stop or pick. Returns the room unchanged when the message is refused.
 */
export function travellerPickMessage(
	room: RoomState,
	message: PickMessage,
	memberId?: string
): RoomState {
	switch (message.type) {
		case 'hold-traveller':
			return memberId ? holdTraveller(room, memberId, message.pickId, message.characterId) : room;
		case 'confirm-traveller':
			return memberId ? confirmTraveller(room, memberId, message.pickId) : room;
		case 'open-traveller-pick':
			return openTravellerPick(
				room,
				message.gameId,
				message.pickId,
				message.options,
				message.seats
			);
		case 'close-traveller-pick':
			return closeTravellerPick(room);
		case 'traveller-for':
			return setTravellerFor(room, message.seatId, message.characterId);
	}
}

export function travellerPickHostView(room: RoomState): TravellerPickHostView | undefined {
	const pick = current(room);
	if (!pick) return undefined;
	return {
		pickId: pick.pickId,
		options: pick.options,
		seats: pick.seats.map((seatId) => ({
			seatId,
			...(pick.holds[seatId] ? { characterId: pick.holds[seatId] } : {}),
			...(pick.confirmed[seatId] ? { confirmed: true as const } : {})
		}))
	};
}

/** The choice for this phone, only while its seat is one of those choosing. */
export function travellerPickPlayerView(
	room: RoomState,
	memberId: string,
	present?: ReadonlySet<string>
): TravellerPickPlayerView | undefined {
	const pick = current(room);
	const seatId = room.members.find((m) => m.memberId === memberId)?.seatId;
	if (!pick || !seatId || !pick.seats.includes(seatId)) return undefined;
	const numbered = numberedNames(room, present);
	const nameOf = (seat: SeatId) => {
		const member = room.members.find((m) => m.seatId === seat);
		if (member) return numbered[member.memberId] ?? member.name;
		return room.public?.seats.find((s) => s.seatId === seat)?.playerName;
	};
	const held: TravellerPickPlayerView['held'] = {};
	for (const seat of pick.seats) {
		const characterId = pick.holds[seat];
		if (seat === seatId || !characterId) continue;
		held[characterId] = nameOf(seat) ?? '';
	}
	const mine = pick.holds[seatId];
	return {
		pickId: pick.pickId,
		options: pick.options,
		...(mine ? { mine } : {}),
		...(pick.confirmed[seatId] ? { confirmed: true as const } : {}),
		held
	};
}

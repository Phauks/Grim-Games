/**
 * What a player thinks each seat is, on their own Grim tab (Trevor, 2026-10-19: "players can
 * tap a player and put what they think they are as a character"). Kept on this phone only,
 * per game (`gameKey`), so a new game starts with no guesses.
 */
import type { Alignment, Character, CharacterId, CharacterType } from '#lib/core/data/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

/**
 * Seat id to the characters this player thinks may sit there, main guess first (Trevor,
 * 2026-10-25: more than one role per seat). Each is a character id or a generic guess
 * (`GenericGuess`) by its key, such as `type:minion` or `team:evil`.
 */
export type Guesses = Record<string, CharacterId[]>;

/** A seat holds at most this many guesses: the main one on its face, the rest in a pill. */
export const MAX_SEAT_GUESSES = 3;

/**
 * A guess of a seat by its character type alone, or only its alignment (Trevor, 2026-10-24).
 * Keys hold a colon, which no character id does, so they never clash with one.
 */
export interface GenericGuess {
	key: string;
	type?: CharacterType;
	team: Alignment;
}

/** A guess after the main one, as its seat's pill draws it (GuessMarks). */
export type GuessMark = { character: Character } | { generic: GenericGuess; label: string };

export const GENERIC_GUESSES: readonly GenericGuess[] = [
	{ key: 'type:townsfolk', type: 'townsfolk', team: 'good' },
	{ key: 'type:outsider', type: 'outsider', team: 'good' },
	{ key: 'type:minion', type: 'minion', team: 'evil' },
	{ key: 'type:demon', type: 'demon', team: 'evil' },
	{ key: 'team:good', team: 'good' },
	{ key: 'team:evil', team: 'evil' }
];

/** The generic guess a stored guess is, if it is one. */
export function genericGuess(guess: string | undefined): GenericGuess | undefined {
	return GENERIC_GUESSES.find((g) => g.key === guess);
}

/** A room holds at most this many players, so older guesses beyond it are dropped. */
const MAX_GUESSES = 40;

const key = (room: string) => `grim-games:play:guesses:${room}`;

/**
 * Reads stored guesses. A seat used to hold one guess as a string; it reads as a list of one,
 * so a phone that saved guesses before keeps them.
 */
export function parseGuesses(raw: unknown): Guesses {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const entries: [string, CharacterId[]][] = [];
	for (const [seatId, value] of Object.entries(raw)) {
		const list = (Array.isArray(value) ? value : [value]).filter(
			(id): id is CharacterId => typeof id === 'string' && id !== ''
		);
		const unique = [...new Set(list)].slice(0, MAX_SEAT_GUESSES);
		if (unique.length) entries.push([seatId, unique]);
	}
	return Object.fromEntries(entries.slice(-MAX_GUESSES));
}

/** A seat's guesses, main first. */
export function guessesOf(guesses: Guesses, seatId: string): readonly CharacterId[] {
	return guesses[seatId] ?? [];
}

/** The guesses with `seatId` holding `list`, or none when it is empty. */
function withList(guesses: Guesses, seatId: string, list: readonly CharacterId[]): Guesses {
	const { [seatId]: _old, ...rest } = guesses;
	void _old;
	return parseGuesses(list.length ? { ...rest, [seatId]: list } : rest);
}

/**
 * Tapping a character in the guess sheet: a new guess becomes the main one (the oldest drops
 * once the seat holds `MAX_SEAT_GUESSES`); one already there is taken off.
 */
export function toggleGuess(guesses: Guesses, seatId: string, id: CharacterId): Guesses {
	const list = guessesOf(guesses, seatId);
	return withList(
		guesses,
		seatId,
		list.includes(id) ? list.filter((g) => g !== id) : [id, ...list].slice(0, MAX_SEAT_GUESSES)
	);
}

/** Makes one of a seat's guesses the main one. */
export function mainGuess(guesses: Guesses, seatId: string, id: CharacterId): Guesses {
	const list = guessesOf(guesses, seatId);
	if (!list.includes(id)) return guesses;
	return withList(guesses, seatId, [id, ...list.filter((g) => g !== id)]);
}

/** The arrow on the token: the next guess becomes the main one, the main one goes last. */
export function cycleGuess(guesses: Guesses, seatId: string): Guesses {
	const [first, ...rest] = guessesOf(guesses, seatId);
	return first === undefined ? guesses : withList(guesses, seatId, [...rest, first]);
}

/**
 * A Traveller's seat: the town knows the character, so a player marks only Good or Evil
 * (Trevor, 2026-10-26). Tapping the alignment it already has takes it off; the other replaces
 * it.
 */
export function travellerGuess(guesses: Guesses, seatId: string, key: string): Guesses {
	const team = travellerTeam(guesses, seatId);
	return withList(guesses, seatId, team?.key === key || !genericGuess(key) ? [] : [key]);
}

/** The alignment a player marked a Traveller's seat with, if any. */
export function travellerTeam(guesses: Guesses, seatId: string): GenericGuess | undefined {
	return guessesOf(guesses, seatId)
		.map(genericGuess)
		.find((g) => g && !g.type);
}

/** None: the seat has no guesses. */
export function clearGuesses(guesses: Guesses, seatId: string): Guesses {
	return withList(guesses, seatId, []);
}

export function readGuesses(room: string): Guesses {
	return parseGuesses(readStored(key(room)));
}

export function writeGuesses(room: string, guesses: Guesses): void {
	writeStored(key(room), guesses);
}

const selfKey = (room: string) => `grim-games:play:self:${room}`;

/**
 * The seat this player marked as their own on their Grim tab (Trevor, 2026-10-26: "allow
 * marking a person as self in own grim"), kept per game like the guesses. `''` when they
 * marked none, so the seat the Storyteller gave them can be unmarked too; undefined when they
 * never chose, and the room's seat counts.
 */
export function readSelf(room: string): string | undefined {
	const raw = readStored(selfKey(room));
	return typeof raw === 'string' ? raw : undefined;
}

export function writeSelf(room: string, seatId: string): void {
	writeStored(selfKey(room), seatId);
}

/** The player's own seat: the one they marked, else the one the room gave them. */
export function selfSeat(marked: string | undefined, roomSeat: string | undefined) {
	return marked === undefined ? roomSeat : marked || undefined;
}

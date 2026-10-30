/**
 * Derived facts about a game (04-architecture.md §3). The state stores only what the
 * Storyteller set; everything else is computed here so it can never go stale.
 *
 * Storyteller overrides win over every rule in this file.
 */
import type { Alignment, Character, CharacterId, CharacterType } from '#lib/core/data/index.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from './characters.ts';
import type {
	Game,
	OverrideField,
	Reminder,
	ReminderId,
	ReminderInstance,
	Seat,
	SeatId,
	SeatOverride
} from './types.ts';

/**
 * Reminders that make a living player register as dead: the token an official character's
 * `gameEnd.aliveWhileDead.untilToken` names. The Zombuul's first death: "you live but register
 * as dead" (https://wiki.bloodontheclocktower.com/Zombuul).
 */
export const REGISTERS_AS_DEAD_REMINDERS: readonly Reminder[] = [...OFFICIAL_RULES].flatMap(
	([characterId, rules]) => {
		const label = rules.gameEnd?.aliveWhileDead?.untilToken;
		return label ? [{ characterId, label }] : [];
	}
);

/** The reminders a Fabled or Loric in play holds, in the order they were placed. */
export function ruleReminders(game: Game, characterId: CharacterId): ReminderInstance[] {
	return game.ruleReminders?.[characterId] ?? [];
}

/** Reminders on the board that belong to no seat, in the order they were placed. */
export function looseReminders(game: Game): ReminderInstance[] {
	return game.looseReminders ?? [];
}

/** Where a reminder is: on a seat, on a Fabled or Loric, loose on the board, or nowhere. */
export function reminderHolder(
	game: Game,
	reminderId: ReminderId
): { seatId: SeatId } | { characterId: CharacterId } | { loose: true } | undefined {
	for (const seatId of game.seating) {
		if (game.seats[seatId].reminders.some((r) => r.reminderId === reminderId)) return { seatId };
	}
	for (const [characterId, held] of Object.entries(game.ruleReminders ?? {})) {
		if (held.some((r) => r.reminderId === reminderId)) return { characterId };
	}
	if (game.looseReminders?.some((r) => r.reminderId === reminderId)) return { loose: true };
	return undefined;
}

export function getSeat(game: Game, seatId: SeatId): Seat | undefined {
	return Object.hasOwn(game.seats, seatId) ? game.seats[seatId] : undefined;
}

/** The seats in clockwise seating order. */
export function seatsInOrder(game: Game): Seat[] {
	return game.seating.map((id) => game.seats[id]);
}

/** The Storyteller's override for one field of a seat, if any. */
export function overrideOf<F extends OverrideField>(
	seat: Seat,
	field: F
): Extract<SeatOverride, { field: F }> | undefined {
	return seat.overrides.find((o): o is Extract<SeatOverride, { field: F }> => o.field === field);
}

/** 1-based position in the clockwise seating order. */
export function seatNumber(game: Game, seatId: SeatId): number | undefined {
	const index = game.seating.indexOf(seatId);
	return index === -1 ? undefined : index + 1;
}

function hasReminder(seat: Seat, reminder: Reminder): boolean {
	return seat.reminders.some(
		(r) => r.characterId === reminder.characterId && r.label === reminder.label
	);
}

/**
 * The player's true character. The token on the seat is what the player was shown; an
 * "Is The …" reminder (TPI `special: reveal/replace-character` with that reminder in
 * `remindersGlobal`) records who they really are, as with the Drunk, Marionette and
 * Philosopher (https://wiki.bloodontheclocktower.com/Drunk).
 */
export function trueCharacter(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const seat = getSeat(game, seatId);
	if (!seat) return undefined;
	const override = overrideOf(seat, 'character');
	if (override) return override.value;
	for (const reminder of seat.reminders) {
		const source = replacedBy(reminder, characters);
		if (source) return source.id;
	}
	return seat.characterId;
}

/**
 * The character an "Is The …" reminder says the player really is:
 * - its character has TPI's `special: reveal/replace-character` and the reminder is one of
 *   its global reminders (Drunk, Marionette, Philosopher, Alchemist);
 * - or the reminder is the character's own "Is The <its name>" token, as with the Apprentice,
 *   whose token is swapped for the character whose ability they gained
 *   (https://wiki.bloodontheclocktower.com/Apprentice; Trevor, 2026-10-16). TPI gives the
 *   Apprentice no `replace-character` flag, so the label decides.
 */
export function replacedBy(reminder: Reminder, characters: CharacterLookup): Character | undefined {
	const source = characters.get(reminder.characterId);
	if (!source) return undefined;
	if (
		source.remindersGlobal.includes(reminder.label) &&
		source.special.some((s) => s.type === 'reveal' && s.name === 'replace-character')
	) {
		return source;
	}
	if (
		reminder.label === `Is The ${source.name}` &&
		(source.reminders.includes(reminder.label) || source.remindersGlobal.includes(reminder.label))
	) {
		return source;
	}
	return undefined;
}

/** The character type of the player's true character. */
export function typeOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterType | undefined {
	const id = trueCharacter(game, seatId, characters);
	return id === undefined ? undefined : characters.get(id)?.type;
}

/** Travellers are known from their character type; there is no separate flag. */
export function isTraveller(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return typeOf(game, seatId, characters) === 'traveller';
}

/** The alignment the rules use: the seat's alignment unless overridden. */
export function alignmentOf(game: Game, seatId: SeatId): Alignment | undefined {
	const seat = getSeat(game, seatId);
	if (!seat) return undefined;
	return overrideOf(seat, 'alignment')?.value ?? seat.alignment;
}

/**
 * Whether abilities treat the player as dead: they are dead, or they carry a reminder
 * that makes them register as dead (the Zombuul's "Dead"), unless overridden.
 */
export function registersAsDead(game: Game, seatId: SeatId): boolean {
	const seat = getSeat(game, seatId);
	if (!seat) return false;
	const override = overrideOf(seat, 'registersAsDead');
	if (override) return override.value;
	return seat.dead || REGISTERS_AS_DEAD_REMINDERS.some((r) => hasReminder(seat, r));
}

/**
 * Whether the player counts as alive for the win conditions: only the `dead` flag
 * matters, so a Zombuul with its "Dead" reminder is still alive and the game goes on
 * (https://wiki.bloodontheclocktower.com/Zombuul).
 */
export function isAliveForWin(game: Game, seatId: SeatId): boolean {
	const seat = getSeat(game, seatId);
	return seat !== undefined && !seat.dead;
}

/**
 * The nearest alive players either side of a seat, anticlockwise first, skipping players
 * who are dead for this purpose (`isDead`, by default `registersAsDead`). "Neighbours"
 * skip dead players (https://wiki.bloodontheclocktower.com/Tea_Lady). Returns one id
 * when the same player is the neighbour both ways, and none when nobody else is alive.
 */
export function aliveNeighbours(
	game: Game,
	seatId: SeatId,
	isDead: (seatId: SeatId) => boolean = (id) => registersAsDead(game, id)
): SeatId[] {
	const { seating } = game;
	const n = seating.length;
	const start = seating.indexOf(seatId);
	if (start === -1) return [];
	const walk = (step: 1 | -1): SeatId | undefined => {
		for (let i = 1; i < n; i++) {
			const id = seating[(((start + step * i) % n) + n) % n];
			if (!isDead(id)) return id;
		}
		return undefined;
	};
	const anticlockwise = walk(-1);
	const clockwise = walk(1);
	const result: SeatId[] = [];
	if (anticlockwise !== undefined) result.push(anticlockwise);
	if (clockwise !== undefined && clockwise !== anticlockwise) result.push(clockwise);
	return result;
}

/**
 * The nearest player each way round from a seat whose true character has this type,
 * skipping everyone else, alive or dead: the No Dashii poisons its nearest Townsfolk
 * (https://wiki.bloodontheclocktower.com/No_Dashii). Anticlockwise first; one id when the
 * same player is nearest both ways, none when there is nobody of that type.
 */
export function nearestOfType(
	game: Game,
	seatId: SeatId,
	type: CharacterType,
	characters: CharacterLookup
): { anticlockwise?: SeatId; clockwise?: SeatId } {
	const [a, c] = [-1, 1].map((step) => {
		const n = game.seating.length;
		const start = game.seating.indexOf(seatId);
		if (start === -1) return undefined;
		for (let i = 1; i < n; i++) {
			const id = game.seating[(((start + step * i) % n) + n) % n];
			if (typeOf(game, id, characters) === type) return id;
		}
		return undefined;
	});
	return {
		...(a !== undefined ? { anticlockwise: a } : {}),
		...(c !== undefined ? { clockwise: c } : {})
	};
}

/** Ids of every character token on a seat, in seating order. */
export function charactersInPlay(game: Game): CharacterId[] {
	return seatsInOrder(game).flatMap((s) => (s.characterId === undefined ? [] : [s.characterId]));
}

/**
 * How many tokens sit with the Fabled and Loric: those in play and the abilities the
 * Storyteller holds (the Plague Doctor's Minion).
 */
export function boardRuleCount(game: Game): number {
	return game.ruleCharacters.length + (game.storytellerAbilities?.length ?? 0);
}

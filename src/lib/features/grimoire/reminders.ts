/**
 * What the reminders picker offers: reminders of characters in play, several at a time,
 * with recent reminders first. Reminder tokens come from TPI's data: a character's
 * `reminders` while it is in play, and its `remindersGlobal` whenever it is on the script.
 */
import type { Character, CharacterId } from '#lib/core/data/index.ts';
import { gainedAbilities } from '#lib/core/rules/index.ts';
import {
	charactersInPlay,
	scriptCharacterIds,
	trueCharacter,
	type CharacterLookup,
	type Game,
	type Reminder
} from '#lib/core/model/index.ts';

export interface ReminderGroup {
	character: Character;
	/** Distinct labels, in TPI's order. */
	labels: string[];
}

function unique(labels: readonly string[]): string[] {
	return [...new Set(labels)];
}

/**
 * Reminder groups for a game: only characters in play offer reminders. In play means a
 * token on a seat, a seat's true character (the Drunk, Marionette, Philosopher or Alchemist
 * marked by its "Is The …" reminder), the Fabled and Loric, and an ability a seat has
 * gained (the Pixie's Townsfolk). One exception: a script character's global reminders are
 * always offered, because "Is The Drunk" and the like are how the Storyteller marks a
 * character that is in play but hidden under another token.
 */
export function reminderGroups(game: Game, characters: CharacterLookup): ReminderGroup[] {
	const inPlay = [
		...new Set([
			...charactersInPlay(game),
			...game.seating.flatMap((seatId) => trueCharacter(game, seatId, characters) ?? []),
			...game.ruleCharacters,
			...gainedAbilities(game).map((gained) => gained.characterId)
		])
	];
	const onScript = scriptCharacterIds(game.script).filter((id) => !inPlay.includes(id));
	const groups: ReminderGroup[] = [];
	for (const id of [...inPlay, ...onScript]) {
		const character = characters.get(id);
		if (!character) continue;
		const labels = inPlay.includes(id)
			? unique([...character.reminders, ...character.remindersGlobal])
			: unique(character.remindersGlobal);
		if (labels.length > 0) groups.push({ character, labels });
	}
	return groups;
}

/**
 * How many of each reminder token the game has. A token can be on the board once, unless
 * the game gives more: a label listed more than once in TPI's data, or its character in
 * play more than once (two seats, or a seat and its true character). Keyed by
 * `reminderKey`; a reminder not in the map has one copy.
 */
export function reminderCopies(game: Game, characters: CharacterLookup): Map<string, number> {
	const inPlay = new Map<string, number>();
	const count = (id: string | undefined) => {
		if (id !== undefined) inPlay.set(id, (inPlay.get(id) ?? 0) + 1);
	};
	for (const seatId of game.seating) {
		const shown = game.seats[seatId].characterId;
		const real = trueCharacter(game, seatId, characters);
		count(shown);
		if (real !== shown) count(real);
	}
	for (const id of game.ruleCharacters) count(id);

	const total = new Map<string, number>();
	for (const group of reminderGroups(game, characters)) {
		const { character } = group;
		const listed = [...character.reminders, ...character.remindersGlobal];
		for (const label of group.labels) {
			const perCharacter = listed.filter((l) => l === label).length;
			total.set(
				reminderKey({ characterId: character.id, label }),
				perCharacter * Math.max(1, inPlay.get(character.id) ?? 0)
			);
		}
	}
	return total;
}

/** How many of each reminder token are left to place (`reminderCopies` less those placed). */
export function reminderCopiesLeft(game: Game, characters: CharacterLookup): Map<string, number> {
	const left = reminderCopies(game, characters);
	for (const seatId of game.seating) {
		for (const r of game.seats[seatId].reminders) {
			const key = reminderKey(r);
			left.set(key, (left.get(key) ?? 1) - 1);
		}
	}
	return left;
}

/** A reminder as a stable key, for the recent list. */
export function reminderKey(reminder: Reminder): string {
	return JSON.stringify([reminder.characterId, reminder.label]);
}

export function parseReminderKey(key: string): Reminder | undefined {
	try {
		const raw: unknown = JSON.parse(key);
		if (Array.isArray(raw) && typeof raw[0] === 'string' && typeof raw[1] === 'string')
			return { characterId: raw[0], label: raw[1] };
	} catch {
		// An unreadable entry is skipped.
	}
	return undefined;
}

export interface BankReminder {
	characterId: CharacterId;
	label: string;
	/** Copies not yet on the board. */
	left: number;
}

/**
 * The reminder bank once setup is over (Trevor, 2026-10-16): every reminder of a character
 * in play that still has a copy off the board, in the picker's order, with `focus` (the
 * character whose night step is being walked through) first.
 */
export function bankReminders(
	game: Game,
	characters: CharacterLookup,
	focus?: CharacterId
): BankReminder[] {
	const left = reminderCopiesLeft(game, characters);
	const groups = reminderGroups(game, characters);
	const first = groups.filter((g) => g.character.id === focus);
	const out: BankReminder[] = [];
	for (const { character, labels } of [
		...first,
		...groups.filter((g) => g.character.id !== focus)
	]) {
		for (const label of labels) {
			const n = left.get(reminderKey({ characterId: character.id, label })) ?? 1;
			if (n > 0) out.push({ characterId: character.id, label, left: n });
		}
	}
	return out;
}

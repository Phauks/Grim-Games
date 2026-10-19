/**
 * What the reminders picker offers: reminders of characters in play, several at a time,
 * with recent reminders first. Reminder tokens come from TPI's data: a character's
 * `reminders` and `remindersGlobal` while it is in play (`reminderGroups` has the exceptions).
 */
import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import { gainedAbilities, type Night } from '#lib/core/rules/index.ts';
import { isBagDisabled, isNotDealt } from '#lib/core/rules/bag-characters.ts';
import { REMINDER_PLACEHOLDERS } from '#lib/core/rules/reminder-placeholders.data.ts';
import {
	GENERIC_REMINDER_ID,
	charactersInPlay,
	scriptCharacterIds,
	trueCharacter,
	type CharacterLookup,
	type Game,
	type Reminder,
	type ReminderId,
	type ReminderInstance
} from '#lib/core/model/index.ts';

export interface ReminderGroup {
	character: Character;
	/** Distinct labels, alphabetically with numbers in order (`byLabel`). */
	labels: string[];
}

function unique(labels: readonly string[]): string[] {
	return [...new Set(labels)];
}

/**
 * Reminder groups for a game: only characters in play offer reminders. In play means a
 * token on a seat, a seat's true character (the Drunk, Marionette, Philosopher or Alchemist
 * marked by its "Is The …" reminder), the Fabled and Loric, and an ability a seat has
 * gained (the Pixie's Townsfolk). A character never dealt to anyone (Lil' Monsta) is in play
 * with no token of its own, so its global reminders are offered whenever it is on the script.
 * Others only on the script offer nothing (Trevor, 2026-10-16: Catfishing offered "Is The
 * Philosopher" with no Philosopher in play). The Drunk and Marionette are in play once the
 * bag holds them, or a seat is one; with tokens given out by hand and no bag, once a seat
 * has a token. Never on an empty board (Trevor, 2026-10-18: "Is The Drunk" was offered
 * before the bag was set up).
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
	const script = scriptCharacterIds(game.script);
	const bag = game.bag;
	const inBag = new Set(
		bag
			? [
					...Object.values(bag.tiles).flatMap((t) => t.reminders.map((r) => r.characterId)),
					...(bag.unseated ?? []).map((r) => r.characterId)
				]
			: []
	);
	const byHand = !bag && charactersInPlay(game).length > 0;
	const onScript = script.filter((id) => {
		const character = characters.get(id);
		if (inPlay.includes(id) || character === undefined || !isBagDisabled(character)) return false;
		return isNotDealt(character) || inBag.has(id) || byHand;
	});
	const groups: ReminderGroup[] = [];
	for (const id of [...inPlay, ...onScript]) {
		const character = characters.get(id);
		if (!character) continue;
		const labels = inPlay.includes(id)
			? unique([...character.reminders, ...character.remindersGlobal])
			: unique(character.remindersGlobal);
		if (labels.length > 0) groups.push({ character, labels: labels.sort(byLabel) });
	}
	// In script order, then characters off the script by name (Trevor, 2026-10-16).
	const at = (id: CharacterId) => {
		const i = script.indexOf(id);
		return i < 0 ? script.length : i;
	};
	return groups.sort(
		(a, b) => at(a.character.id) - at(b.character.id) || byLabel(a.character.name, b.character.name)
	);
}

/** Reminder names alphabetically, with numbers in order: "Drunk 2" before "Drunk 10". */
export const byLabel = (a: string, b: string): number =>
	a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * How many of each reminder token the game has. A token can be on the board once, unless
 * the game gives more: a label listed more than once in TPI's data, or its character in
 * play more than once (two seats, or a seat and its true character). An extra copy the
 * Storyteller added (`canAddCopy`) counts while it is on the board. Keyed by `reminderKey`;
 * a reminder not in the map has one copy.
 */
export function reminderCopies(
	game: Game,
	characters: CharacterLookup,
	copies: ReadonlySet<ReminderId> = NO_COPIES
): Map<string, number> {
	const total = listedCopies(game, characters);
	const placed = new Map<string, number>();
	for (const r of counted(game, copies))
		placed.set(reminderKey(r), (placed.get(reminderKey(r)) ?? 0) + 1);
	for (const [key, n] of placed) if (n > (total.get(key) ?? 1)) total.set(key, n);
	return total;
}

/** The copies the game gives, before any extra the Storyteller added (`reminderCopies`). */
function listedCopies(game: Game, characters: CharacterLookup): Map<string, number> {
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

/**
 * The reminders on the board beyond the copies the game gives (a Duplicate, or Add another
 * for a script's own character): the latest placed of each token. The board marks them as
 * unusual (Trevor, 2026-10-18), never blocks them.
 */
export function extraReminders(
	game: Game,
	characters: CharacterLookup,
	copies: ReadonlySet<ReminderId> = NO_COPIES
): Set<ReminderId> {
	const listed = listedCopies(game, characters);
	const seen = new Map<string, number>();
	const out = new Set<ReminderId>();
	for (const r of onBoard(game)) {
		// The generic reminder has no limit, so no copy of it is ever unusual.
		if (isGeneric(r)) continue;
		if (copies.has(r.reminderId)) {
			out.add(r.reminderId);
			continue;
		}
		const key = reminderKey(r);
		const n = (seen.get(key) ?? 0) + 1;
		seen.set(key, n);
		if (n > (listed.get(key) ?? 1)) out.add(r.reminderId);
	}
	return out;
}

/**
 * Whether the Storyteller may add another copy of a reminder once every listed copy is
 * placed (Trevor, 2026-10-17): a script's own character may need more than its JSON lists,
 * like Fall of Rome's Cleopatra, whose ability chooses two players but lists one "Chosen".
 */
export function canAddCopy(character: Character | undefined): boolean {
	return character !== undefined && character.edition === undefined;
}

/** How many of each reminder token are left to place (`reminderCopies` less those placed). */
export function reminderCopiesLeft(
	game: Game,
	characters: CharacterLookup,
	copies: ReadonlySet<ReminderId> = NO_COPIES
): Map<string, number> {
	const left = reminderCopies(game, characters, copies);
	for (const r of counted(game, copies)) {
		const key = reminderKey(r);
		left.set(key, (left.get(key) ?? 1) - 1);
	}
	return left;
}

const NO_COPIES: ReadonlySet<ReminderId> = new Set();

/** The generic ∞ reminder (core's GENERIC_REMINDER_ID): any number, belonging to no one. */
export const isGeneric = (reminder: Pick<Reminder, 'characterId'>): boolean =>
	reminder.characterId === GENERIC_REMINDER_ID;

/** A reminder token's words in a sentence or heading: a generic one with no text shows ∞. */
export const tokenLabel = (reminder: ReminderInstance | Reminder): ReminderLabel =>
	reminderWords(reminder) || ((isGeneric(reminder) ? '∞' : '') as ReminderLabel);

/** The words on a reminder token: its label, or a generic reminder's own text. */
export const reminderWords = (reminder: ReminderInstance | Reminder): ReminderLabel =>
	isGeneric(reminder)
		? ((('note' in reminder && reminder.note) || '') as ReminderLabel)
		: reminder.label;

/**
 * The reminders on the board that come from the game's tokens: a duplicate made with ⋯ >
 * Duplicate reminder is a new token (Trevor, 2026-10-18), so it never uses up a copy the
 * bank still holds.
 */
function counted(game: Game, copies: ReadonlySet<ReminderId>): ReminderInstance[] {
	return onBoard(game).filter((r) => !copies.has(r.reminderId) && !isGeneric(r));
}

/** Every reminder on the board: on seats, on Fabled and Loric, and loose. */
export function onBoard(game: Game): ReminderInstance[] {
	return [
		...game.seating.flatMap((seatId) => game.seats[seatId].reminders),
		...Object.values(game.ruleReminders ?? {}).flat(),
		...(game.looseReminders ?? [])
	];
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
	/** Used by the night step being walked through: first in the bank, and marked. */
	now: boolean;
}

/** The reminders a character's night step puts on players that night. */
export interface StepReminders {
	characterId: CharacterId;
	labels: readonly string[];
}

/**
 * The reminders a character places at its step on `night` (Trevor, 2026-10-16: "only
 * highlight a token if it could be used that night"), from what each `:reminder:` in TPI's
 * night text means (`REMINDER_PLACEHOLDERS`). A step whose text handles no token places none:
 * the Grandmother's Dead token is never used on the first night. A script's own character
 * has no such data, so all of its reminders count (`character`; Trevor, 2026-10-17, Fall of
 * Rome's Merchant).
 */
export function stepReminders(
	characterId: CharacterId,
	night: Night,
	character?: Character
): StepReminders {
	const known =
		`${characterId}:first` in REMINDER_PLACEHOLDERS ||
		`${characterId}:other` in REMINDER_PLACEHOLDERS;
	if (!known && character)
		return {
			characterId,
			labels: [...new Set([...character.reminders, ...character.remindersGlobal])]
		};
	const entries = REMINDER_PLACEHOLDERS[`${characterId}:${night}`] ?? [];
	const labels = entries.flatMap((e) =>
		e.tokens.filter((t) => t.action === 'place').map((t) => t.label)
	);
	return { characterId, labels: [...new Set(labels)] };
}

/**
 * The reminder bank once setup is over (Trevor, 2026-10-16): every reminder of a character
 * in play that still has a copy off the board, in the picker's order, with the reminders the
 * walked-through step uses tonight (`focus`) first, unless `front` is false.
 */
export function bankReminders(
	game: Game,
	characters: CharacterLookup,
	focus?: StepReminders,
	front = true,
	copies: ReadonlySet<ReminderId> = NO_COPIES
): BankReminder[] {
	const left = reminderCopiesLeft(game, characters, copies);
	const out: BankReminder[] = [];
	for (const { character, labels } of reminderGroups(game, characters)) {
		for (const label of labels) {
			const n = left.get(reminderKey({ characterId: character.id, label })) ?? 1;
			const now = focus?.characterId === character.id && focus.labels.includes(label);
			if (n > 0) out.push({ characterId: character.id, label, left: n, now });
		}
	}
	return front ? [...out.filter((r) => r.now), ...out.filter((r) => !r.now)] : out;
}

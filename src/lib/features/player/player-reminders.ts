/**
 * Reminder tokens a player puts on seats in their own grim (Trevor, 2026-10-26: "Reminder
 * tokens for players to use"), as the Storyteller does on the board. Kept on this phone only,
 * per game (`gameKey`), like the player's guesses; nothing here reaches the room.
 */
import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import { GENERIC_REMINDER_ID, SYMBOL_COLOURS, type GenericLook } from '#lib/core/model/index.ts';
import { byLabel } from '#lib/features/grimoire/reminders.ts';
import { reminderTokenSize } from '#lib/ui/seating/seat-layout.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

/**
 * A script character's token, or a generic one (Trevor, 2026-10-26: "the generic token
 * reminders for those 1/2/3 custom note ones"): `GENERIC_REMINDER_ID` with its own `id`, no
 * label and the Storyteller's generic look (text, symbol, colour).
 */
export interface PlayerReminder extends GenericLook {
	characterId: CharacterId;
	label: ReminderLabel;
	/** A generic token's own id, since a seat may hold several. */
	id?: string;
}

export const isGenericReminder = (r: PlayerReminder): boolean =>
	r.characterId === GENERIC_REMINDER_ID;

/** Seat id to its reminders, in the order placed. */
export type PlayerReminders = Record<string, PlayerReminder[]>;

/** A seat holds at most this many, which is more than a real grimoire's seat fits. */
export const MAX_SEAT_REMINDERS = 8;
/** A room holds at most this many players, so seats beyond it are dropped. */
const MAX_SEATS = 40;

const key = (room: string) => `grim-games:play:reminders:${room}`;

const same = (a: PlayerReminder, b: PlayerReminder) =>
	a.id || b.id ? a.id === b.id : a.characterId === b.characterId && a.label === b.label;

/** The text a generic token may hold, as on the board. */
const MAX_NOTE = 200;

/** A generic token's look, field by field; anything else is dropped. */
function genericLook(r: Record<string, unknown>): GenericLook {
	const look: GenericLook = {};
	if (typeof r.note === 'string' && r.note.trim()) look.note = r.note.slice(0, MAX_NOTE);
	if (typeof r.symbol === 'string' && r.symbol) look.symbol = r.symbol;
	if (SYMBOL_COLOURS.includes(r.symbolColour as never))
		look.symbolColour = r.symbolColour as GenericLook['symbolColour'];
	if (r.symbolFill === true) look.symbolFill = true;
	return look;
}

/** Reads stored reminders, dropping anything malformed. */
export function parsePlayerReminders(raw: unknown): PlayerReminders {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const entries: [string, PlayerReminder[]][] = [];
	for (const [seatId, value] of Object.entries(raw)) {
		if (!Array.isArray(value)) continue;
		const list: PlayerReminder[] = [];
		for (const r of value) {
			if (typeof r !== 'object' || r === null) continue;
			const fields = r as Record<string, unknown>;
			const { characterId, label, id } = fields;
			if (typeof characterId !== 'string' || typeof label !== 'string' || !characterId) continue;
			let reminder: PlayerReminder = {
				characterId: characterId as CharacterId,
				label: label as ReminderLabel
			};
			if (characterId === GENERIC_REMINDER_ID) {
				// Saved before generic tokens had ids (never), or damaged: not one to keep.
				if (typeof id !== 'string' || !id) continue;
				reminder = { ...reminder, label: '' as ReminderLabel, id, ...genericLook(fields) };
			}
			if (!list.some((o) => same(o, reminder))) list.push(reminder);
		}
		if (list.length) entries.push([seatId, list.slice(0, MAX_SEAT_REMINDERS)]);
	}
	return Object.fromEntries(entries.slice(-MAX_SEATS));
}

export function readPlayerReminders(room: string): PlayerReminders {
	return parsePlayerReminders(readStored(key(room)));
}

export function writePlayerReminders(room: string, reminders: PlayerReminders): void {
	writeStored(key(room), reminders);
}

export function remindersOn(reminders: PlayerReminders, seatId: string): readonly PlayerReminder[] {
	return reminders[seatId] ?? [];
}

export function hasReminder(
	reminders: PlayerReminders,
	seatId: string,
	reminder: PlayerReminder
): boolean {
	return remindersOn(reminders, seatId).some((r) => same(r, reminder));
}

/**
 * Tapping a reminder in the picker: puts it on the seat, or takes it off when it is there.
 * Each token goes on a seat once; the same one may sit on several seats, since a player
 * can't know which seat really has it.
 */
export function toggleReminder(
	reminders: PlayerReminders,
	seatId: string,
	reminder: PlayerReminder
): PlayerReminders {
	const list = remindersOn(reminders, seatId);
	const next = hasReminder(reminders, seatId, reminder)
		? list.filter((r) => !same(r, reminder))
		: [...list, reminder].slice(0, MAX_SEAT_REMINDERS);
	const { [seatId]: _old, ...rest } = reminders;
	void _old;
	return parsePlayerReminders(next.length ? { ...rest, [seatId]: next } : rest);
}

export interface PlayerReminderGroup {
	character: Character;
	labels: ReminderLabel[];
}

/**
 * What the picker offers: every reminder of the script's characters, in script order. A
 * player can't see which characters are in play, so it is the whole script, not only those in
 * play as on the Storyteller's board (`reminderGroups`).
 */
export function scriptReminderGroups(characters: readonly Character[]): PlayerReminderGroup[] {
	return characters.flatMap((character) => {
		const labels = [...new Set([...character.reminders, ...character.remindersGlobal])];
		return labels.length ? [{ character, labels: labels.sort(byLabel) }] : [];
	});
}

/**
 * A reminder's diameter on a player's grim, as on the board: half the token, kept between 30
 * and 48px and scaled by the Tokens setting, never under a finger's 44px tap target.
 */
export const reminderChip = (size: number, scale: number): number =>
	Math.max(44, reminderTokenSize(size, scale));

/** A placed reminder's key in a list: one of each token per seat, or a generic one's id. */
export const placedKey = (r: PlayerReminder): string => r.id ?? [r.characterId, r.label].join(':');

/** The words a token shows: its label, or a generic one's text (∞ without). */
export const reminderWords = (r: PlayerReminder): ReminderLabel =>
	(isGenericReminder(r) ? r.note || '∞' : r.label) as ReminderLabel;

/** Puts a new, blank generic token on a seat, last; `id` names it. */
export function addGenericReminder(
	reminders: PlayerReminders,
	seatId: string,
	id: string
): PlayerReminders {
	return toggleReminder(reminders, seatId, {
		characterId: GENERIC_REMINDER_ID as CharacterId,
		label: '' as ReminderLabel,
		id
	});
}

/** Changes a generic token's look; empty fields go back to none. */
export function setGenericLook(
	reminders: PlayerReminders,
	seatId: string,
	id: string,
	look: GenericLook
): PlayerReminders {
	const list = remindersOn(reminders, seatId).map((r) => (r.id === id ? { ...r, ...look } : r));
	return parsePlayerReminders({ ...reminders, [seatId]: list });
}

/**
 * The picker's two parts (Trevor, 2026-10-26: "search and guess"): the characters this player
 * guessed on any seat, or knows (a Traveller), first; then the rest, in script order.
 */
export function guessesFirst<T extends { character: Character }>(
	groups: readonly T[],
	first: readonly CharacterId[]
): { first: T[]; rest: T[] } {
	return {
		first: groups.filter((g) => first.includes(g.character.id)),
		rest: groups.filter((g) => !first.includes(g.character.id))
	};
}

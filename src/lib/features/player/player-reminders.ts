/**
 * Reminder tokens a player puts on seats in their own grim (Trevor, 2026-10-26: "Reminder
 * tokens for players to use"), as the Storyteller does on the board. Kept on this phone only,
 * per game (`gameKey`), like the player's guesses; nothing here reaches the room.
 */
import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import { byLabel } from '#lib/features/grimoire/reminders.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

export interface PlayerReminder {
	characterId: CharacterId;
	label: ReminderLabel;
}

/** Seat id to its reminders, in the order placed. */
export type PlayerReminders = Record<string, PlayerReminder[]>;

/** A seat holds at most this many, which is more than a real grimoire's seat fits. */
export const MAX_SEAT_REMINDERS = 8;
/** A room holds at most this many players, so seats beyond it are dropped. */
const MAX_SEATS = 40;

const key = (room: string) => `grim-games:play:reminders:${room}`;

const same = (a: PlayerReminder, b: PlayerReminder) =>
	a.characterId === b.characterId && a.label === b.label;

/** Reads stored reminders, dropping anything malformed. */
export function parsePlayerReminders(raw: unknown): PlayerReminders {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const entries: [string, PlayerReminder[]][] = [];
	for (const [seatId, value] of Object.entries(raw)) {
		if (!Array.isArray(value)) continue;
		const list: PlayerReminder[] = [];
		for (const r of value) {
			if (typeof r !== 'object' || r === null) continue;
			const { characterId, label } = r as Record<string, unknown>;
			if (typeof characterId !== 'string' || typeof label !== 'string' || !characterId) continue;
			const reminder = { characterId: characterId as CharacterId, label: label as ReminderLabel };
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

/** A placed reminder's key in a list: one of each token per seat. */
export const placedKey = (r: PlayerReminder): string => [r.characterId, r.label].join(':');

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

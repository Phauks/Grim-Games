/**
 * Reminder tokens a player puts on seats in their own grim (Trevor, 2026-10-26: "Reminder
 * tokens for players to use"), as the Storyteller does on the board. Kept on this phone only,
 * per game (`gameKey`), like the player's guesses; nothing here reaches the room.
 */
import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import { COUNTER_TIMES, type CounterTime } from '#lib/core/data/parts/counter.ts';
import {
	GENERIC_REMINDER_ID,
	REMINDER_NUMBER_MAX,
	isSymbolColour,
	numberSymbol,
	symbolNumber,
	type GenericLook,
	type GenericToken
} from '#lib/core/model/index.ts';
import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
import { reminderTokenSize } from '#lib/ui/seating/seat-layout.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { looksLike } from '#lib/features/board/reminders.ts';

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
	if (isSymbolColour(r.symbolColour))
		look.symbolColour = r.symbolColour as GenericLook['symbolColour'];
	if (r.symbolFill === true) look.symbolFill = true;
	// A copy of a character's reminder, with its art (dragged onto "+ New token").
	const like = r.like as Record<string, unknown> | undefined;
	if (typeof like?.characterId === 'string' && like.characterId && typeof like.label === 'string')
		look.like = {
			characterId: like.characterId as CharacterId,
			label: like.label as ReminderLabel
		};
	if (COUNTER_TIMES.includes(r.countsUp as CounterTime)) look.countsUp = r.countsUp as CounterTime;
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

/**
 * Takes every reminder off a game's seats, as a new game on the same board. The tray's own
 * ∞ tokens stay: they are the player's, not the board's.
 */
export function forgetPlayerReminders(room: string): void {
	writeStored(key(room), undefined);
	writeStored(`grim-games:play:counted:${room}`, undefined);
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

/**
 * A token picked up off a seat (Trevor, 2026-10-31: as on the board): onto another seat,
 * keeping its look, or back to the tray when `to` is none.
 */
export function moveReminder(
	reminders: PlayerReminders,
	from: string,
	reminder: PlayerReminder,
	to?: string
): PlayerReminders {
	let next = hasReminder(reminders, from, reminder)
		? toggleReminder(reminders, from, reminder)
		: reminders;
	if (to && !hasReminder(next, to, reminder)) next = toggleReminder(next, to, reminder);
	return next;
}

/**
 * A reminder's diameter on a player's grim, as on the board: half the token, kept between 30
 * and 48px and scaled by the Tokens setting, never under a finger's 44px tap target.
 */
export const reminderChip = (size: number, scale: number): number =>
	Math.max(44, reminderTokenSize(size, scale));

/** A placed reminder's key in a list: one of each token per seat, or a generic one's id. */
export const placedKey = (r: PlayerReminder): string => r.id ?? [r.characterId, r.label].join(':');

/**
 * The words a token shows: its label, or a generic one's text (∞ without), after a # token's
 * number as the board names it (BoardReminder).
 */
export function reminderWords(r: PlayerReminder): ReminderLabel {
	if (!isGenericReminder(r)) return r.label;
	const n = symbolNumber(r.symbol);
	if (n === undefined) return (r.note || '∞') as ReminderLabel;
	return (r.note ? `${n}: ${r.note}` : String(n)) as ReminderLabel;
}

/**
 * A token's look for a `BoardReminder`, as on the player's grim: its words and, for a generic
 * one, its own text and symbol.
 */
export const playerLook = (
	r: PlayerReminder,
	characterOf: (id: CharacterId) => Character | undefined
) => ({
	label: (isGenericReminder(r) ? (r.note ?? '') : r.label) as ReminderLabel,
	infinite: isGenericReminder(r),
	symbol: r.symbol,
	symbolColour: r.symbolColour,
	symbolFill: r.symbolFill,
	character: characterOf(r.characterId),
	art: r.like ? characterOf(r.like.characterId) : undefined
});

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

/**
 * A player's own reusable ∞ tokens in their tray (plan B9 on the player's side, Trevor
 * 2026-11-06: "the same components for parity"), made with "+ New token" as on the board,
 * kept on this phone per game beside the player's reminders.
 */
export type PlayerTokens = GenericToken[];

/** The most ∞ tokens a player's tray keeps. */
const MAX_TOKENS = 20;
const tokensKey = (room: string) => `grim-games:play:tokens:${room}`;

/** Reads stored tokens, dropping anything malformed. */
export function parsePlayerTokens(raw: unknown): PlayerTokens {
	if (!Array.isArray(raw)) return [];
	const tokens: PlayerTokens = [];
	for (const t of raw) {
		if (typeof t !== 'object' || t === null) continue;
		const fields = t as Record<string, unknown>;
		const { tokenId } = fields;
		if (typeof tokenId !== 'string' || !tokenId || tokens.some((o) => o.tokenId === tokenId))
			continue;
		tokens.push({ tokenId, ...genericLook(fields) });
	}
	return tokens.slice(0, MAX_TOKENS);
}

export const readPlayerTokens = (room: string): PlayerTokens =>
	parsePlayerTokens(readStored(tokensKey(room)));

export function writePlayerTokens(room: string, tokens: PlayerTokens): void {
	writeStored(tokensKey(room), tokens);
}

/** How many nights and days have begun by a phase: each is a dusk or a dawn passed. */
export function phaseCount(now: PlayersPhase | undefined): { dusk: number; dawn: number } {
	if (!now || now.kind === 'setup') return { dusk: 0, dawn: 0 };
	return { dusk: now.number, dawn: now.kind === 'night' ? now.number - 1 : now.number };
}

/**
 * Each # token set to count up (plan M53, `countsUp`) goes up by one for each dusk or dawn
 * passed, as the board's do, stopping at the highest number.
 */
export function countUp(
	reminders: PlayerReminders,
	passed: { dusk: number; dawn: number }
): PlayerReminders {
	const up = (r: PlayerReminder): PlayerReminder => {
		const n = symbolNumber(r.symbol);
		const by = r.countsUp ? passed[r.countsUp] : 0;
		if (n === undefined || by <= 0) return r;
		return { ...r, symbol: numberSymbol(Math.min(REMINDER_NUMBER_MAX, n + by)) };
	};
	return Object.fromEntries(Object.entries(reminders).map(([seat, list]) => [seat, list.map(up)]));
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
 * The ∞ copies on the seats that still look like a tray token (`looksLike`), each with its
 * seat: what Delete token can take off too (Trevor, 2026-11-10, option B).
 */
export function copiesOf(
	reminders: PlayerReminders,
	token: GenericLook
): { seatId: string; reminder: PlayerReminder }[] {
	return Object.entries(reminders).flatMap(([seatId, placed]) =>
		placed
			.filter((r) => isGenericReminder(r) && looksLike(r, token))
			.map((reminder) => ({ seatId, reminder }))
	);
}

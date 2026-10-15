/**
 * Setup reminders: once the characters are in the grimoire, the reminder tokens the
 * Storyteller will need before the first night (and at the start of the first day),
 * suggested so they can be placed in one go (Trevor, 2026-10-15).
 *
 * The curated list is `setup-reminders.data.ts`. A suggestion names the token and, when
 * the grimoire settles it, the seat it goes on (the Drunk's "Is The Drunk" on the Drunk;
 * the Washerwoman's TOWNSFOLK on the only Townsfolk). Otherwise `choice` says what the
 * Storyteller picks, and `candidates` lists the players who fit.
 *
 * Tokens already in the grimoire are not suggested again. Placed suggestions are normal
 * reminders (`ApplySetupReminders`), so the Storyteller can move or remove any of them.
 */
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, seatsInOrder, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, Reminder, Seat, SeatId } from '#lib/core/model/types.ts';
import { NO_CHARACTER_NAMES, type CharacterNames } from './character-names.ts';
import {
	NO_SETUP_REMINDERS,
	SETUP_NOTES,
	SETUP_REMINDER_ENTRIES,
	type SeatFilter,
	type SetupCondition,
	type SetupNote,
	type SetupReminderEntry,
	type SetupReminderSpec,
	type SetupTarget,
	type SetupTiming
} from './setup-reminders.data.ts';

export { NO_SETUP_REMINDERS, SETUP_NOTES, SETUP_REMINDER_ENTRIES };
export type {
	SeatFilter,
	SetupCondition,
	SetupNote,
	SetupReminderEntry,
	SetupReminderSpec,
	SetupTarget,
	SetupTiming
};

/** One suggested reminder token. */
export interface SetupReminder extends Reminder {
	/** What to do, one short line with the token in [brackets]. */
	text: string;
	/** Pre-filled when the grimoire settles who gets it. */
	seatId?: SeatId;
	/** Why the token is needed, in our words. */
	reason: string;
	/** What the Storyteller must pick, when `seatId` is not pre-filled. */
	choice?: string;
	/** Players who fit, in seating order (empty for a token on the character's own seat). */
	candidates: SeatId[];
	timing: SetupTiming;
	wiki: string;
}

export interface SetupReminderOptions {
	/** Only these timings (default: all). */
	timings?: readonly SetupTiming[];
}

const ENTRIES = new Map(SETUP_REMINDER_ENTRIES.map((e) => [e.id, e]));

interface SeatFacts {
	seat: Seat;
	/** The true character (`trueCharacter`): "Is The …" reminders and overrides count. */
	truly?: CharacterId;
	type?: CharacterType;
	/** The alignment the rules use (`alignmentOf`). */
	alignment?: Alignment;
}

function facts(game: Game, lookup: CharacterLookup): SeatFacts[] {
	return seatsInOrder(game).map((seat) => {
		const truly = trueCharacter(game, seat.seatId, lookup);
		return {
			seat,
			truly,
			type: truly === undefined ? undefined : lookup.get(truly)?.type,
			alignment: alignmentOf(game, seat.seatId)
		};
	});
}

function fits(filter: SeatFilter, f: SeatFacts, selfSeats: readonly SeatFacts[]): boolean {
	switch (filter) {
		case 'any':
			return true;
		case 'good':
		case 'evil':
			return f.alignment === filter;
		case 'townsfolk':
		case 'outsider':
		case 'minion':
			return f.type === filter;
		case 'not-demon':
			return f.type !== 'demon';
		case 'same-alignment':
			return selfSeats.some((s) => s.alignment !== undefined && s.alignment === f.alignment);
		case 'copies':
			return selfSeats.includes(f);
	}
}

function holds(when: SetupCondition | undefined, seats: SeatFacts[], copies: number): boolean {
	if (!when) return true;
	const outsiders = seats.filter((s) => s.type === 'outsider').length;
	if (when.minOutsiders !== undefined && outsiders < when.minOutsiders) return false;
	if (when.exactOutsiders !== undefined && outsiders !== when.exactOutsiders) return false;
	if (when.minCopies !== undefined && copies < when.minCopies) return false;
	return true;
}

const has = (seat: Seat, characterId: CharacterId, label: string) =>
	seat.reminders.some((r) => r.characterId === characterId && r.label === label);

function suggest(
	entry: SetupReminderEntry,
	seats: SeatFacts[],
	selfSeats: SeatFacts[],
	timings: ReadonlySet<SetupTiming>
): SetupReminder[] {
	const out: SetupReminder[] = [];
	// Tokens of this character already in the grimoire, by label: each covers one spec.
	const placed = new Map<string, number>();
	for (const { seat } of seats) {
		for (const r of seat.reminders) {
			if (r.characterId === entry.id) placed.set(r.label, (placed.get(r.label) ?? 0) + 1);
		}
	}
	const taken = new Set<SeatId>();
	for (const spec of entry.reminders) {
		const timing = spec.timing ?? 'setup';
		if (!timings.has(timing)) continue;
		if (!holds(spec.when, seats, selfSeats.length)) continue;
		const base = {
			characterId: entry.id,
			label: spec.label,
			text: spec.text,
			reason: spec.reason,
			timing,
			wiki: entry.wiki
		};
		const target = spec.target;
		if ('self' in target) {
			for (const f of selfSeats) {
				if (has(f.seat, entry.id, spec.label)) continue;
				out.push({ ...base, seatId: f.seat.seatId, candidates: [] });
			}
			continue;
		}
		const already = placed.get(spec.label) ?? 0;
		if (already > 0) {
			placed.set(spec.label, already - 1);
			continue;
		}
		const candidates = seats
			.filter((f) => !(target.notSelf && selfSeats.includes(f)))
			.filter((f) => !taken.has(f.seat.seatId))
			.filter((f) => fits(target.choose, f, selfSeats))
			.map((f) => f.seat.seatId);
		const only = candidates.length === 1 ? candidates[0] : undefined;
		if (only !== undefined) taken.add(only);
		out.push({
			...base,
			...(only !== undefined ? { seatId: only } : { choice: target.choice }),
			candidates
		});
	}
	return out;
}

/**
 * The reminder tokens to place for the characters in play, in seating order of the
 * characters, then Fabled and Loric. Characters are in play by their token or their true
 * character; homebrew characters are not covered.
 */
export function setupReminders(
	game: Game,
	lookup: CharacterLookup,
	options: SetupReminderOptions = {}
): SetupReminder[] {
	const timings = new Set<SetupTiming>(options.timings ?? ['setup', 'first-day']);
	const seats = facts(game, lookup);
	const order: CharacterId[] = [];
	for (const f of seats) {
		for (const id of [f.seat.characterId, f.truly]) {
			if (id !== undefined && !order.includes(id)) order.push(id);
		}
	}
	for (const id of game.ruleCharacters) if (!order.includes(id)) order.push(id);
	const out: SetupReminder[] = [];
	for (const id of order) {
		const entry = ENTRIES.get(id);
		const character = lookup.get(id);
		// Homebrew characters share no rules with an official id.
		if (!entry || (character && character.edition === undefined)) continue;
		const selfSeats = seats.filter((f) => f.truly === id || f.seat.characterId === id);
		out.push(...suggest(entry, seats, selfSeats, timings));
	}
	return out;
}

/** The suggestions that have a seat, as placements for `ApplySetupReminders`. */
export function placeableSetupReminders(
	suggestions: readonly SetupReminder[]
): { seatId: SeatId; reminder: Reminder }[] {
	return suggestions.flatMap((s) =>
		s.seatId === undefined
			? []
			: [{ seatId: s.seatId, reminder: { characterId: s.characterId, label: s.label } }]
	);
}

/** One step of a character's pre-game preparation, for review lists and the setup screen. */
export interface SetupPrepStep {
	text: string;
	tokens: string[];
	/** Who gets the tokens: the character itself ("the Drunk") or what to choose. */
	target?: string;
	/** A value to type in (`SetupNote.value`). */
	value?: { key: string; label: string };
	/** Why our step departs from TPI's wording (`SetupNote.differs`). */
	differs?: string;
}

/**
 * Everything the Storyteller prepares for one character between the draw and the first
 * night (first-day tokens included), whatever is in play: the token steps of
 * `SETUP_REMINDER_ENTRIES` (tokens with the same text are one step), then `SETUP_NOTES`.
 * `name` is the character's name, used for a token on its own seat.
 */
export function setupPrep(characterId: CharacterId, name: string): SetupPrepStep[] {
	const steps: SetupPrepStep[] = [];
	for (const spec of ENTRIES.get(characterId)?.reminders ?? []) {
		const target = 'self' in spec.target ? `the ${name}` : spec.target.choice;
		const same = steps.find((s) => s.text === spec.text);
		if (same) {
			same.tokens.push(spec.label);
			// Different targets (the Noble's 1 evil and 2 good): the text says it.
			if (same.target !== target) delete same.target;
		} else steps.push({ text: spec.text, tokens: [spec.label], target });
	}
	for (const note of SETUP_NOTES[characterId] ?? []) {
		steps.push({
			text: note.text,
			tokens: [...(note.tokens ?? [])],
			...(note.value ? { value: note.value } : {}),
			...(note.differs ? { differs: note.differs } : {})
		});
	}
	return steps;
}

/**
 * The reminder tokens a character's pre-game prep places (`timing: 'setup'`), so the
 * first night can show them as already done. Tokens placed at the start of the first
 * day are not included.
 */
export function prepTokens(characterId: CharacterId): string[] {
	const out = new Set<string>();
	for (const spec of ENTRIES.get(characterId)?.reminders ?? []) {
		if ((spec.timing ?? 'setup') === 'setup') out.add(spec.label);
	}
	for (const note of SETUP_NOTES[characterId] ?? []) for (const t of note.tokens ?? []) out.add(t);
	return [...out];
}

export type PrepSegment =
	| { kind: 'text'; text: string }
	| { kind: 'character'; id: CharacterId }
	| { kind: 'reminder'; label: string };

/**
 * A prep step's text as segments: `[Token]` as the character's reminder token, character
 * names (`names`) as badges.
 */
export function prepTextSegments(
	text: string,
	names: CharacterNames = NO_CHARACTER_NAMES
): PrepSegment[] {
	const out: PrepSegment[] = [];
	let at = 0;
	for (const match of text.matchAll(/\[([^\]]+)\]/g)) {
		out.push(...names.split(text.slice(at, match.index)));
		out.push({ kind: 'reminder', label: match[1] });
		at = match.index + match[0].length;
	}
	out.push(...names.split(text.slice(at)));
	return out;
}

/**
 * Setup reminders: once the characters are in the grimoire, the reminder tokens the
 * Storyteller will need before the first night (and at the start of the first day),
 * suggested so they can be placed in one go (Trevor, 2026-10-15).
 *
 * Each character's tokens are the `setupPrep` key of its rules block (`data/setup-prep-rules.ts`;
 * Trevor reviews and edits the official ones). A suggestion names the token and, when
 * the grimoire settles it, the seat it goes on (the Drunk's "Is The Drunk" on the Drunk;
 * the Washerwoman's TOWNSFOLK on the only Townsfolk). Otherwise `choice` says what the
 * Storyteller picks, and `candidates` lists the players who fit.
 *
 * Tokens already in the grimoire are not suggested again. Placed suggestions are normal
 * reminders (`ApplySetupReminders`), so the Storyteller can move or remove any of them.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type {
	SeatFilter,
	SetupCondition,
	SetupNote,
	SetupPrepRules,
	SetupReminderSpec,
	SetupTarget,
	SetupTiming
} from '#lib/core/data/setup-prep-rules.ts';
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	nearestOfType,
	seatsInOrder,
	trueCharacter
} from '#lib/core/model/selectors.ts';
import type { Game, Reminder, Seat, SeatId } from '#lib/core/model/types.ts';
import { NO_CHARACTER_NAMES, type CharacterNames } from './character-names.ts';

export type {
	SeatFilter,
	SetupCondition,
	SetupNote,
	SetupPrepRules,
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
	/** Listed before every other setup reminder, as too important to miss (the Drunk's). */
	first?: true;
}

export interface SetupReminderOptions {
	/** Only these timings (default: all). */
	timings?: readonly SetupTiming[];
}

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * A character's `setupPrep` rules. Homebrew characters share no rules with an official id:
 * one that reuses it has only its own `rules`.
 */
export function setupPrepOf(
	characterId: CharacterId,
	lookup?: CharacterLookup
): SetupPrepRules | undefined {
	const character = lookup?.get(characterId);
	if (character && character.edition === undefined) return character.rules?.setupPrep;
	return rulesOf(characterId, lookup)?.setupPrep;
}

/** One character's setup tokens, with the wiki page to link. */
interface SetupReminderEntry {
	id: CharacterId;
	wiki: string;
	reminders: readonly SetupReminderSpec[];
}

function entryOf(
	characterId: CharacterId,
	lookup: CharacterLookup
): SetupReminderEntry | undefined {
	const reminders = setupPrepOf(characterId, lookup)?.reminders;
	if (!reminders) return undefined;
	const character = lookup.get(characterId);
	return {
		id: characterId,
		wiki: (character && wikiUrl(character)) ?? `${W}Setup`,
		reminders
	};
}

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

function fits(
	filter: SeatFilter,
	f: SeatFacts,
	selfSeats: readonly SeatFacts[],
	nearest: (way: 'anticlockwise' | 'clockwise') => SeatId[]
): boolean {
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
		case 'nearest-townsfolk-anticlockwise':
			return nearest('anticlockwise').includes(f.seat.seatId);
		case 'nearest-townsfolk-clockwise':
			return nearest('clockwise').includes(f.seat.seatId);
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
	game: Game,
	lookup: CharacterLookup,
	entry: SetupReminderEntry,
	seats: SeatFacts[],
	selfSeats: SeatFacts[],
	timings: ReadonlySet<SetupTiming>
): SetupReminder[] {
	const out: SetupReminder[] = [];
	const nearest = (way: 'anticlockwise' | 'clockwise') =>
		selfSeats.flatMap((s) => {
			const id = nearestOfType(game, s.seat.seatId, 'townsfolk', lookup)[way];
			return id === undefined ? [] : [id];
		});
	const fitting = (target: Exclude<SetupTarget, { self: true }>) =>
		seats
			.filter((f) => !(target.notSelf && selfSeats.includes(f)))
			.filter((f) => fits(target.choose, f, selfSeats, nearest))
			.map((f) => f.seat.seatId);
	const specs = entry.reminders.filter(
		(spec) => timings.has(spec.timing ?? 'setup') && holds(spec.when, seats, selfSeats.length)
	);
	// Tokens of this character already in the grimoire each cover one spec with their label:
	// the one whose players include the token's seat (the No Dashii's clockwise Poisoned),
	// else the first one left.
	const placed = seats.flatMap(({ seat }) =>
		seat.reminders
			.filter((r) => r.characterId === entry.id)
			.map((r) => ({ label: r.label, seatId: seat.seatId }))
	);
	const covered = new Set<SetupReminderSpec>();
	const taken = new Set<SeatId>();
	const open = (spec: SetupReminderSpec, label: string) =>
		!('self' in spec.target) && spec.label === label && !covered.has(spec);
	const left = placed.filter((token) => {
		const spec = specs.find(
			(s) =>
				open(s, token.label) &&
				fitting(s.target as Exclude<SetupTarget, { self: true }>).includes(token.seatId)
		);
		if (!spec) return true;
		covered.add(spec);
		taken.add(token.seatId);
		return false;
	});
	for (const token of left) {
		const spec = specs.find((s) => open(s, token.label));
		if (!spec) continue;
		covered.add(spec);
		taken.add(token.seatId);
	}
	for (const spec of specs) {
		const timing = spec.timing ?? 'setup';
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
		if (covered.has(spec)) continue;
		const candidates = fitting(target).filter((s) => !taken.has(s));
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
 * characters, then Fabled and Loric. Tokens marked `first` (the Drunk's "Is The Drunk") come
 * before all others, as too important to miss (Trevor, 2026-10-27). Characters are in play by their token or their true
 * character; a homebrew character is covered by its own `setupPrep` rules.
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
	if (timings.has('setup'))
		out.push(...drawnTileReminders(game, lookup), ...unseatedReminders(game, seats, lookup));
	for (const id of order) {
		const entry = entryOf(id, lookup);
		if (!entry) continue;
		const selfSeats = seats.filter((f) => f.truly === id || f.seat.characterId === id);
		out.push(...suggest(game, lookup, entry, seats, selfSeats, timings));
	}
	const first = (r: SetupReminder) =>
		entryOf(r.characterId, lookup)?.reminders.some((s) => s.label === r.label && s.first) === true;
	const marked = out.map((r) => (first(r) ? { ...r, first: true as const } : r));
	return [...marked.filter((r) => r.first), ...marked.filter((r) => !r.first)];
}

/**
 * The "Is The Drunk" style tokens a confirmed bag tile carries (Drunk, Marionette,
 * Lunatic...), suggested on the seat that drew it rather than placed automatically (Trevor,
 * 2026-10-16: the Drunk token goes in the setup reminders). Until it is placed the grimoire
 * shows only the token the player saw, so the seat is pre-filled. Skipped once a matching
 * reminder is on that seat.
 */
function drawnTileReminders(game: Game, lookup: CharacterLookup): SetupReminder[] {
	const out: SetupReminder[] = [];
	const tiles = game.bag ? Object.values(game.bag.tiles) : [];
	for (const tile of tiles) {
		const seatId = tile.drawnBySeat;
		if (!tile.confirmed || seatId === undefined) continue;
		const seat = game.seats[seatId];
		if (!seat) continue;
		for (const r of tile.reminders) {
			const placed = seat.reminders.some(
				(p) => p.characterId === r.characterId && p.label === r.label
			);
			if (placed) continue;
			const entry = entryOf(r.characterId, lookup);
			const spec = entry?.reminders.find((s) => s.label === r.label);
			out.push({
				characterId: r.characterId,
				label: r.label,
				text: spec?.text ?? `Put [${r.label}] on this player`,
				seatId,
				reason: spec?.reason ?? 'This player drew a token that is not their true character',
				candidates: [],
				timing: 'setup',
				wiki: entry?.wiki ?? `${W}Setup`
			});
		}
	}
	return out;
}

/**
 * The Drunk's and Marionette's "Is The …" tokens: they had no tile, so the Storyteller
 * decides who is secretly the Drunk or Marionette once the tokens come back (Trevor,
 * 2026-10-16). Who may carry one is the token's `reminderTargets` rule: a Drunk is a player
 * shown a Townsfolk (https://wiki.bloodontheclocktower.com/Drunk); a Marionette a good player
 * next to the Demon (https://wiki.bloodontheclocktower.com/Marionette). One suggestion per
 * copy not yet on a seat.
 */
function unseatedReminders(
	game: Game,
	seats: readonly SeatFacts[],
	lookup: CharacterLookup
): SetupReminder[] {
	const out: SetupReminder[] = [];
	const unseated = game.bag?.unseated ?? [];
	const placed = (r: Reminder) =>
		seats.filter((f) =>
			f.seat.reminders.some((p) => p.characterId === r.characterId && p.label === r.label)
		).length;
	const n = seats.length;
	const nextToDemon = (i: number) =>
		n > 1 && [seats[(i + n - 1) % n], seats[(i + 1) % n]].some((f) => f.type === 'demon');
	const marked = new Set(
		unseated.flatMap((r) =>
			seats
				.filter((f) =>
					f.seat.reminders.some((p) => p.characterId === r.characterId && p.label === r.label)
				)
				.map((f) => f.seat.seatId)
		)
	);
	const seen = new Map<string, number>();
	for (const r of unseated) {
		const key = `${r.characterId}\u0000${r.label}`;
		const copy = (seen.get(key) ?? 0) + 1;
		seen.set(key, copy);
		if (copy <= placed(r)) continue;
		const target = rulesOf(r.characterId, lookup)?.reminderTargets?.[r.label];
		const byDemon = target?.neighbour?.ofType === 'demon';
		const shown: readonly CharacterType[] =
			target?.shown ?? (target?.alignment === 'good' ? ['townsfolk', 'outsider'] : ['townsfolk']);
		const candidates = seats
			.filter(
				(f, i) => f.type !== undefined && shown.includes(f.type) && (!byDemon || nextToDemon(i))
			)
			.filter((f) => !marked.has(f.seat.seatId))
			.map((f) => f.seat.seatId);
		const entry = entryOf(r.characterId, lookup);
		const name = lookup.get(r.characterId)?.name ?? r.label.replace(/^is the /i, '');
		out.push({
			characterId: r.characterId,
			label: r.label,
			text: `Put [${r.label}] on the player who is secretly the ${name}`,
			reason: byDemon
				? `The ${name} had no token in the bag: it is a good player next to the Demon`
				: `The ${name} had no token in the bag: it is one of the players holding a Townsfolk`,
			choice: `Who is the ${name}`,
			candidates,
			timing: 'setup',
			wiki: entry?.wiki ?? `${W}Setup`
		});
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
}

/**
 * Everything the Storyteller prepares for one character between the draw and the first
 * night (first-day tokens included), whatever is in play: the token steps of
 * `setupPrep.reminders` (tokens with the same text are one step), then `setupPrep.notes`.
 * `name` is the character's name, used for a token on its own seat; `lookup` finds a custom
 * character's own rules.
 */
export function setupPrep(
	characterId: CharacterId,
	name: string,
	lookup?: CharacterLookup
): SetupPrepStep[] {
	const prep = setupPrepOf(characterId, lookup);
	const steps: SetupPrepStep[] = [];
	for (const spec of prep?.reminders ?? []) {
		const target = 'self' in spec.target ? `the ${name}` : spec.target.choice;
		const same = steps.find((s) => s.text === spec.text);
		if (same) {
			same.tokens.push(spec.label);
			// Different targets (the Noble's 1 evil and 2 good): the text says it.
			if (same.target !== target) delete same.target;
		} else steps.push({ text: spec.text, tokens: [spec.label], target });
	}
	for (const note of prep?.notes ?? []) {
		steps.push({
			text: note.text,
			tokens: [...(note.tokens ?? [])],
			...(note.value ? { value: note.value } : {})
		});
	}
	return steps;
}

/**
 * The reminder tokens a character's pre-game prep places (`timing: 'setup'`), so the
 * first night can show them as already done. Tokens placed at the start of the first
 * day are not included.
 */
export function prepTokens(characterId: CharacterId, lookup?: CharacterLookup): string[] {
	const prep = setupPrepOf(characterId, lookup);
	const out = new Set<string>();
	for (const spec of prep?.reminders ?? []) {
		if ((spec.timing ?? 'setup') === 'setup') out.add(spec.label);
	}
	for (const note of prep?.notes ?? []) for (const t of note.tokens ?? []) out.add(t);
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

/** What the engine's deciders share: limits, refusing a command, and the checks they use. */
import {
	defaultAlignment,
	isSeatable,
	type Alignment,
	type Character,
	type CharacterId,
	type Script
} from '#lib/core/data/index.ts';
import {
	GENERAL_DEATH_CAUSES,
	GENERIC_REMINDER_ID,
	SYMBOL_COLOURS,
	getSeat,
	isKnownReminder,
	isOnScript,
	looseReminders,
	reminderHolder,
	replacedBy,
	ruleReminders,
	trueCharacter,
	type CharacterGuess,
	type CharacterLookup,
	type DayEntry,
	type DeathCause,
	type Game,
	type GenericLook,
	type Reminder,
	type ReminderInstance,
	type Seat,
	type Tile
} from '#lib/core/model/index.ts';
import {
	DAY_GROUPS,
	guessLimit,
	nominationsPerDay,
	type DayReminderOverride,
	type Night,
	type NightStepOverride
} from '#lib/core/rules/index.ts';
import type { CommandOf, CommandType } from '../commands.ts';
import type { EngineContext } from '../context.ts';
import type { GameEvent } from '../events.ts';
import type { ErrorCode, WarningCode, EngineError } from '../decide.ts';

/** Turns one kind of command into its events, checking it against the game. */
export type Decider<T extends CommandType> = (
	game: Game,
	command: CommandOf<T>,
	ctx: EngineContext,
	warn: Warn
) => GameEvent[];
/** The deciders for some kinds of command, one each. */
export type Deciders<K extends CommandType> = { [T in K]: Decider<T> };

/** Bluffs are 3 good characters (https://wiki.bloodontheclocktower.com/Glossary). */
export const BLUFFS_PER_SET = 3;
/** Longest name a bluff set can have. */
export const MAX_BLUFF_SET_NAME = 40;
/** Longest generic reminder symbol, in UTF-16 units: one emoji, flags and joined ones too. */
export const MAX_REMINDER_SYMBOL = 16;

/** Base setup covers 5 to 15 players; more join as Travellers (https://wiki.bloodontheclocktower.com/Setup). */
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;
/** A sanity cap on seats, far beyond any real table. */
export const MAX_SEATS = 40;

export class Refusal {
	constructor(readonly error: EngineError) {}
}

export function refuse(code: ErrorCode, message: string): never {
	throw new Refusal({ code, message });
}

export type Warn = (code: WarningCode, message: string, characters?: CharacterId[]) => void;

export function seatOf(game: Game, seatId: string): Seat {
	return getSeat(game, seatId) ?? refuse('unknown-seat', `no seat ${seatId}`);
}

export function characterOf(ctx: EngineContext, id: CharacterId): Character {
	return ctx.characters.get(id) ?? refuse('unknown-character', `no character ${id}`);
}

export function seatableCharacter(ctx: EngineContext, id: CharacterId): Character {
	const character = characterOf(ctx, id);
	if (!isSeatable(character.type)) {
		refuse('not-seatable', `${character.name} is a rule character and never goes on a seat`);
	}
	return character;
}

/** Characters in play: tokens, true characters and rule characters. */
/** True characters on seats, and the Fabled and Loric in play. */
export function trulyInPlay(game: Game, ctx: EngineContext): Set<CharacterId> {
	const ids = new Set<CharacterId>(game.ruleCharacters);
	for (const seatId of game.seating) {
		const truly = trueCharacter(game, seatId, ctx.characters);
		if (truly !== undefined) ids.add(truly);
	}
	return ids;
}

export function inPlay(game: Game, ctx: EngineContext): Set<CharacterId> {
	const ids = new Set<CharacterId>(game.ruleCharacters);
	for (const seatId of game.seating) {
		const token = game.seats[seatId].characterId;
		if (token !== undefined) ids.add(token);
		const truly = trueCharacter(game, seatId, ctx.characters);
		if (truly !== undefined) ids.add(truly);
	}
	return ids;
}

/**
 * Characters the game holds that `script` lacks: seat tokens and true characters, reminder
 * tokens, bluffs and bag tiles. Travellers, Fabled and Loric need not be on a script.
 */
export function offScript(game: Game, script: Script, ctx: EngineContext): CharacterId[] {
	const ids = inPlay(game, ctx);
	for (const seatId of game.seating) {
		for (const r of game.seats[seatId].reminders) ids.add(r.characterId);
	}
	for (const set of game.bluffs) for (const id of set) ids.add(id);
	for (const tile of Object.values(game.bag?.tiles ?? {})) {
		ids.add(tile.shows);
		ids.add(tile.grimoire);
		for (const r of tile.reminders) ids.add(r.characterId);
	}
	return [...ids].filter((id) => {
		// A generic reminder belongs to no character, so no script lists it (Trevor,
		// 2026-10-24: "generic is not on the script").
		if (id === GENERIC_REMINDER_ID) return false;
		const type = ctx.characters.get(id)?.type;
		const exempt = type === 'traveller' || type === 'fabled' || type === 'loric';
		return !exempt && !isOnScript(script, id);
	});
}

export function allowsDuplicates(character: Character): boolean {
	return character.special.some(
		(s) =>
			s.type === 'selection' &&
			(s.name === 'bag-duplicate' || s.name === 'good-duplicate' || s.name === 'evil-duplicate')
	);
}

/** The default alignment for a seat given its token and the reminders it carries. */
export function alignmentFromCharacters(
	token: Character,
	reminders: readonly Reminder[],
	ctx: EngineContext
): Alignment | undefined {
	for (const reminder of reminders) {
		const source = replacedBy(reminder, ctx.characters);
		if (source) return defaultAlignment(source.type);
	}
	return defaultAlignment(token.type);
}

/**
 * The reminder a command asks for: its character and words, and whose copy it is when that
 * seat is still in the game (an unknown seat is dropped, not refused).
 */
export function reminderFrom(game: Game, reminder: Reminder): Reminder {
	const { characterId, label, ownerSeatId } = reminder;
	return ownerSeatId !== undefined && Object.hasOwn(game.seats, ownerSeatId)
		? { characterId, label, ownerSeatId }
		: { characterId, label };
}

/**
 * A bank ∞ token's look, tidied: trimmed text and symbol, nothing empty kept. Refuses a
 * symbol that is too long or a colour that isn't one of the theme's.
 */
export function genericLook(look: GenericLook | undefined): GenericLook {
	const out: GenericLook = {};
	const note = look?.note?.trim();
	const symbol = look?.symbol?.trim();
	if (note) out.note = note;
	if (symbol) {
		if (symbol.length > MAX_REMINDER_SYMBOL)
			refuse('invalid-symbol', `a symbol is at most ${MAX_REMINDER_SYMBOL} characters`);
		out.symbol = symbol;
	}
	if (look?.symbolColour !== undefined) {
		if (!SYMBOL_COLOURS.includes(look.symbolColour))
			refuse('invalid-colour', `no symbol colour ${look.symbolColour}`);
		out.symbolColour = look.symbolColour;
	}
	if (look?.symbolFill === true) out.symbolFill = true;
	return out;
}

/** The look a copy of a bank ∞ token starts with (plan B9); none without a token. */
export function tokenLook(game: Game, tokenId: string | undefined): GenericLook {
	if (tokenId === undefined) return {};
	const token = game.genericTokens?.find((t) => t.tokenId === tokenId);
	if (!token) refuse('unknown-token', `no ∞ token ${tokenId}`);
	const look: GenericLook = {};
	if (token.note !== undefined) look.note = token.note;
	if (token.symbol !== undefined) look.symbol = token.symbol;
	if (token.symbolColour !== undefined) look.symbolColour = token.symbolColour;
	if (token.symbolFill) look.symbolFill = true;
	return look;
}

export function checkReminder(
	game: Game,
	reminder: Reminder,
	ctx: EngineContext,
	warn: Warn
): void {
	// The generic ∞ reminder belongs to no character and may be placed anywhere.
	if (reminder.characterId === GENERIC_REMINDER_ID) return;
	const character = characterOf(ctx, reminder.characterId);
	if (!isKnownReminder(character, reminder.label)) {
		warn('reminder-not-for-character', `${character.name} has no "${reminder.label}" reminder`);
		return;
	}
	const global = character.remindersGlobal.includes(reminder.label);
	const available =
		inPlay(game, ctx).has(character.id) || (global && isOnScript(game.script, character.id));
	if (!available) {
		warn('reminder-character-not-in-play', `${character.name} is not in play`);
	}
}

/** The reminder itself, from where `reminderHolder` found it. */
export function heldReminder(
	game: Game,
	from: NonNullable<ReturnType<typeof reminderHolder>>,
	reminderId: string
): ReminderInstance {
	const held =
		'seatId' in from
			? game.seats[from.seatId].reminders
			: 'characterId' in from
				? ruleReminders(game, from.characterId)
				: looseReminders(game);
	return held.find((r) => r.reminderId === reminderId)!;
}

/** A Fabled or Loric in play, to hold reminders; refused for anything else. */
export function ruleHolderOf(
	game: Game,
	ctx: EngineContext,
	characterId: CharacterId
): CharacterId {
	const character = characterOf(ctx, characterId);
	if (!game.ruleCharacters.includes(character.id)) {
		refuse('rule-character-not-in-play', `${character.name} is not in play as a Fabled or Loric`);
	}
	return character.id;
}

/**
 * Fabled and Loric hold their own reminders; anything else is allowed, with a caution
 * (Trevor, 2026-10-17).
 */
export function warnIfNotRuleReminder(reminder: Reminder, ctx: EngineContext, warn: Warn): void {
	if (reminder.characterId === GENERIC_REMINDER_ID) return;
	const type = ctx.characters.get(reminder.characterId)?.type;
	if (type !== 'fabled' && type !== 'loric') {
		warn('reminder-not-from-rule-character', `${reminder.label} is not a Fabled or Loric reminder`);
	}
}

export function nextPosition(length: number, ctx: EngineContext): number {
	return Math.floor(ctx.random() * (length + 1));
}

export function shuffled<T>(items: readonly T[], ctx: EngineContext): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(ctx.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function tileOf(game: Game, tileId: string): Tile {
	if (!game.bag) refuse('no-bag', 'there is no bag');
	return Object.hasOwn(game.bag.tiles, tileId)
		? game.bag.tiles[tileId]
		: refuse('unknown-tile', `no tile ${tileId}`);
}

/** A recorded death cause, checked: a general cause or a character that exists. */
export function deathCause(ctx: EngineContext, cause: DeathCause): DeathCause {
	if ((GENERAL_DEATH_CAUSES as readonly string[]).includes(cause)) return cause;
	return characterOf(ctx, cause).id;
}

export function badOverride(message: string): never {
	return refuse('invalid-override', message);
}

export function nonEmpty(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.trim() === '') badOverride(`${name} must be text`);
	return value;
}

export function textOf(value: unknown): string {
	if (typeof value !== 'string') badOverride('text must be a string');
	return value;
}

export function nightOf(value: unknown): { night?: Night } {
	if (value === undefined) return {};
	if (value !== 'first' && value !== 'other') badOverride('night must be first or other');
	return { night: value };
}

export function anchorOf(value: unknown): string | null {
	if (value === null) return null;
	return nonEmpty(value, 'after');
}

/** A night-order override, checked and copied field by field. */
export function nightOverride(o: NightStepOverride, ctx: EngineContext): NightStepOverride {
	const id = nonEmpty(o?.id, 'id');
	switch (o.kind) {
		case 'hide':
			return { kind: 'hide', id, ...nightOf(o.night) };
		case 'edit':
			return { kind: 'edit', id, text: textOf(o.text), ...nightOf(o.night) };
		case 'move':
			return { kind: 'move', id, after: anchorOf(o.after), ...nightOf(o.night) };
		case 'add': {
			const copy: NightStepOverride = {
				kind: 'add',
				id,
				text: textOf(o.text),
				after: anchorOf(o.after),
				...nightOf(o.night)
			};
			const title = o.title?.trim();
			if (title) copy.title = title;
			if (o.characterId !== undefined) copy.characterId = characterOf(ctx, o.characterId).id;
			return copy;
		}
		default:
			return badOverride(`no night override kind ${String((o as { kind?: unknown })?.kind)}`);
	}
}

/** A day-reminder override, checked and copied field by field. */
export function dayOverride(
	game: Game,
	o: DayReminderOverride,
	ctx: EngineContext
): DayReminderOverride {
	const key = nonEmpty(o?.key, 'key');
	switch (o.kind) {
		case 'hide':
			return { kind: 'hide', key };
		case 'edit':
			return { kind: 'edit', key, text: textOf(o.text) };
		case 'add': {
			if (!(DAY_GROUPS as readonly string[]).includes(o.group)) {
				badOverride(`no day reminder group ${String(o.group)}`);
			}
			const copy: DayReminderOverride = { kind: 'add', key, group: o.group, text: textOf(o.text) };
			if (o.characterId !== undefined) copy.characterId = characterOf(ctx, o.characterId).id;
			if (o.seatId !== undefined) copy.seatId = seatOf(game, o.seatId).seatId;
			return copy;
		}
		default:
			return badOverride(`no day override kind ${String((o as { kind?: unknown })?.kind)}`);
	}
}

/** Checks an override index: `0 <= index < length`, or `<= length` when adding. */
export function overrideIndex(index: number, length: number, adding: boolean): number {
	const max = adding ? length : length - 1;
	if (!Number.isInteger(index) || index < 0 || index > max) {
		refuse(
			'invalid-position',
			max < 0 ? 'there are no overrides' : `index must be from 0 to ${max}`
		);
	}
	return index;
}

/** Overrides are plain JSON copied field by field, so equal JSON means equal overrides. */
export function sameOverride(a: object, b: object): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Warns when an `add` override reuses the id or key of another `add` (it would be ignored). */
export function checkDuplicateAdd(
	others: readonly { kind: string; id?: string; key?: string }[],
	added: { kind: string; id?: string; key?: string },
	warn: Warn
): void {
	if (added.kind !== 'add') return;
	const name = added.id ?? added.key;
	if (others.some((o) => o.kind === 'add' && (o.id ?? o.key) === name)) {
		warn('duplicate-override', `another added item already uses ${name}`);
	}
}

export function entryOf(game: Game, entryId: string): DayEntry {
	return (
		game.today.entries.find((e) => e.entryId === entryId) ??
		refuse('unknown-entry', `no entry ${entryId} in today's log`)
	);
}

export function entryOfKind<K extends DayEntry['kind']>(
	game: Game,
	entryId: string,
	kind: K
): Extract<DayEntry, { kind: K }> {
	const entry = entryOf(game, entryId);
	if (entry.kind !== kind) refuse('wrong-entry-kind', `entry ${entryId} is not a ${kind}`);
	return entry as Extract<DayEntry, { kind: K }>;
}

export function guessesOf(
	game: Game,
	ctx: EngineContext,
	guesses: readonly CharacterGuess[] | undefined
): CharacterGuess[] {
	return (guesses ?? []).map((g) => ({
		seatId: seatOf(game, g.seatId).seatId,
		characterId: characterOf(ctx, g.characterId).id
	}));
}

/**
 * Warns when a note holds more guesses than its character may make (`guessLimit`, the
 * Juggler's 5: https://wiki.bloodontheclocktower.com/Juggler). A warning: the Storyteller
 * decides.
 */
export function checkGuessLimit(
	ctx: EngineContext,
	characterId: CharacterId,
	count: number,
	warn: Warn
): void {
	const limit = guessLimit(characterId, ctx.characters);
	if (limit !== undefined && count > limit) {
		warn('too-many-guesses', `the ${characterOf(ctx, characterId).name} guesses at most ${limit}`);
	}
}

/** The reminder token a character places when its once-only ability is used. */
export const NO_ABILITY_LABEL = 'No Ability';

export function hasPlacedReminder(game: Game, reminderId: string): boolean {
	return game.seating.some((id) =>
		game.seats[id].reminders.some((r) => r.reminderId === reminderId)
	);
}

/**
 * Checks a nomination. Each player may nominate once per day and be nominated once per
 * day, and dead players may not nominate (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination") unless their character says they may, and how often (`nominationsPerDay`).
 * These are warnings: abilities break them, and the Storyteller decides.
 */
export function checkNomination(
	game: Game,
	characters: CharacterLookup,
	nominator: string,
	nominee: string,
	warn: Warn,
	ignore?: string
): void {
	const others = game.today.entries.filter(
		(e): e is Extract<DayEntry, { kind: 'nomination' }> =>
			e.kind === 'nomination' && e.entryId !== ignore
	);
	const allowed = nominationsPerDay(game, nominator, characters);
	if (allowed === 0) warn('dead-nominator', 'dead players may not nominate');
	if (others.filter((e) => e.nominator === nominator).length >= Math.max(allowed, 1)) {
		warn('already-nominated', 'this player has already nominated today');
	}
	if (others.some((e) => e.nominee === nominee)) {
		warn('already-nominee', 'this player has already been nominated today');
	}
}

/**
 * Before players move round the circle, each unnamed seat takes the name it shows now, its
 * seat number ("Seat 3"), so every name moves with its player and character (Trevor,
 * 2026-10-22: "all names don't stay with the seat").
 */
export function seatNumberNames(game: Game): GameEvent[] {
	return game.seating.flatMap((seatId, i): GameEvent[] =>
		game.seats[seatId].playerName === undefined
			? [{ type: 'SeatRenamed', seatId, playerName: `Seat ${i + 1}` }]
			: []
	);
}

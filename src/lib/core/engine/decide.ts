/**
 * Turns a command into events, checking it against the game first.
 *
 * The Storyteller is never blocked by the rules (04-architecture.md §4: assist, never
 * rule). Rules concerns are *warnings*: the events still happen. A command is refused
 * with an *error* only when it cannot be applied at all: it names a seat, reminder,
 * tile or character that does not exist, puts a Fabled or Loric on a seat, or assigns a
 * Traveller with no alignment (the Storyteller must choose it; the UI asks), records a
 * death cause for a living player, or gives a malformed Storyteller override.
 */
import {
	defaultAlignment,
	isSeatable,
	type Alignment,
	type Character,
	type CharacterId,
	type Script
} from '#lib/core/data/index.ts';
import {
	ABNORMAL_REASONS,
	GENERAL_DEATH_CAUSES,
	GENERIC_REMINDER_ID,
	OVERRIDE_FIELDS,
	SYMBOL_COLOURS,
	getSeat,
	isKnownReminder,
	isOnScript,
	isTraveller,
	registersAsDead,
	looseReminders,
	reminderHolder,
	replacedBy,
	ruleReminders,
	trueCharacter,
	type AbnormalCause,
	type CharacterGuess,
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
	type DayReminderOverride,
	type Night,
	type NightStepOverride,
	fixedReminderMove
} from '#lib/core/rules/index.ts';
import { startingRuleCharacters } from '#lib/core/rules/script-rules.ts';
import type { Command, CommandOf } from './commands.ts';
import type { EngineContext } from './context.ts';
import type { GameEvent } from './events.ts';

export type ErrorCode =
	| 'no-game'
	| 'game-exists'
	| 'invalid-player-count'
	| 'invalid-position'
	| 'unknown-seat'
	| 'unknown-character'
	| 'unknown-reminder'
	| 'unknown-token'
	| 'unknown-override'
	| 'not-seatable'
	| 'not-rule-character'
	| 'rule-character-not-in-play'
	| 'same-seat'
	| 'invalid-direction'
	| 'invalid-bluff-set'
	| 'no-bag'
	| 'bag-empty'
	| 'unknown-tile'
	| 'tile-not-in-bag'
	| 'tile-not-drawn'
	| 'tile-confirmed'
	| 'not-dead'
	| 'invalid-override'
	| 'unknown-entry'
	| 'wrong-entry-kind'
	| 'invalid-abnormal'
	| 'invalid-prep-value'
	| 'invalid-symbol'
	| 'invalid-colour';

export type WarningCode =
	| 'unusual-player-count'
	| 'no-change'
	| 'not-on-script'
	| 'already-in-play'
	| 'kept-alignment'
	| 'alignment-differs-from-true-character'
	| 'seat-has-character'
	| 'draw-cancelled'
	| 'ghost-vote-while-alive'
	| 'reminder-not-for-character'
	| 'reminder-not-from-rule-character'
	| 'reminder-character-not-in-play'
	| 'bluff-in-play'
	| 'bluff-not-good'
	| 'bluff-duplicate'
	| 'too-many-bluffs'
	| 'traveller-in-bag'
	| 'bag-replaced'
	| 'seat-holds-tile'
	| 'replaces-character'
	| 'cause-ignored'
	| 'duplicate-override'
	| 'dead-nominator'
	| 'already-nominated'
	| 'already-nominee'
	| 'already-executed'
	| 'traveller-executed'
	| 'not-traveller'
	| 'already-dead'
	| 'not-seat-character'
	| 'already-used'
	| 'empty-day'
	| 'reminder-fixed'
	| 'no-cause';

export interface Issue<C extends string> {
	code: C;
	/** English, for logs and tests; the UI shows its own text for each code. */
	message: string;
}
export type EngineError = Issue<ErrorCode>;
export type EngineWarning = Issue<WarningCode>;

export type Decision =
	{ ok: true; events: GameEvent[]; warnings: EngineWarning[] } | { ok: false; error: EngineError };

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

class Refusal {
	constructor(readonly error: EngineError) {}
}

function refuse(code: ErrorCode, message: string): never {
	throw new Refusal({ code, message });
}

/** Checks `command` against `game` and returns the events it produces, or why it cannot. */
export function decide(game: Game | undefined, command: Command, ctx: EngineContext): Decision {
	const warnings: EngineWarning[] = [];
	const warn = (code: WarningCode, message: string) => warnings.push({ code, message });
	try {
		if (command.type === 'CreateGame') {
			if (game) refuse('game-exists', 'this log already has a game');
			const events = createGame(command, ctx, warn);
			return { ok: true, events, warnings };
		}
		if (!game) refuse('no-game', 'create a game first');
		const events = decideFor(game, command, ctx, warn);
		return { ok: true, events, warnings };
	} catch (e) {
		if (e instanceof Refusal) return { ok: false, error: e.error };
		throw e;
	}
}

type Warn = (code: WarningCode, message: string) => void;

function createGame(command: CommandOf<'CreateGame'>, ctx: EngineContext, warn: Warn): GameEvent[] {
	const { playerCount } = command;
	if (!Number.isInteger(playerCount) || playerCount < 0 || playerCount > MAX_SEATS) {
		refuse('invalid-player-count', `player count must be a whole number from 0 to ${MAX_SEATS}`);
	}
	if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
		warn(
			'unusual-player-count',
			`setup covers ${MIN_PLAYERS} to ${MAX_PLAYERS} players; more join as Travellers`
		);
	}
	const seatIds = Array.from({ length: playerCount }, () => ctx.newId());
	const storytellerName = command.storytellerName?.trim();
	return [
		{
			type: 'GameCreated',
			gameId: ctx.newId(),
			createdAt: ctx.now(),
			script: command.script,
			seatIds
		},
		// The chosen Fabled and Loric, or the script's own, start in play (script-rules.ts).
		...startingRules(command, ctx).map((characterId): GameEvent => ({
			type: 'RuleCharacterAdded',
			characterId
		})),
		// In the creation entry, so undo never takes the name away.
		...(storytellerName ? [{ type: 'StorytellerNameSet' as const, name: storytellerName }] : [])
	];
}

function startingRules(command: CommandOf<'CreateGame'>, ctx: EngineContext): CharacterId[] {
	if (!command.ruleCharacters) return startingRuleCharacters(command.script, ctx.characters);
	const ids = [...new Set(command.ruleCharacters)];
	for (const id of ids) {
		const character = characterOf(ctx, id);
		if (character.type !== 'fabled' && character.type !== 'loric') {
			refuse('not-rule-character', `${character.name} is not a Fabled or Loric`);
		}
	}
	return ids;
}

function seatOf(game: Game, seatId: string): Seat {
	return getSeat(game, seatId) ?? refuse('unknown-seat', `no seat ${seatId}`);
}

function characterOf(ctx: EngineContext, id: CharacterId): Character {
	return ctx.characters.get(id) ?? refuse('unknown-character', `no character ${id}`);
}

function seatableCharacter(ctx: EngineContext, id: CharacterId): Character {
	const character = characterOf(ctx, id);
	if (!isSeatable(character.type)) {
		refuse('not-seatable', `${character.name} is a rule character and never goes on a seat`);
	}
	return character;
}

/** Characters in play: tokens, true characters and rule characters. */
/** True characters on seats, and the Fabled and Loric in play. */
function trulyInPlay(game: Game, ctx: EngineContext): Set<CharacterId> {
	const ids = new Set<CharacterId>(game.ruleCharacters);
	for (const seatId of game.seating) {
		const truly = trueCharacter(game, seatId, ctx.characters);
		if (truly !== undefined) ids.add(truly);
	}
	return ids;
}

function inPlay(game: Game, ctx: EngineContext): Set<CharacterId> {
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
function offScript(game: Game, script: Script, ctx: EngineContext): CharacterId[] {
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
		const type = ctx.characters.get(id)?.type;
		const exempt = type === 'traveller' || type === 'fabled' || type === 'loric';
		return !exempt && !isOnScript(script, id);
	});
}

function allowsDuplicates(character: Character): boolean {
	return character.special.some(
		(s) =>
			s.type === 'selection' &&
			(s.name === 'bag-duplicate' || s.name === 'good-duplicate' || s.name === 'evil-duplicate')
	);
}

/** The default alignment for a seat given its token and the reminders it carries. */
function alignmentFromCharacters(
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
function reminderFrom(game: Game, reminder: Reminder): Reminder {
	const { characterId, label, ownerSeatId } = reminder;
	return ownerSeatId !== undefined && Object.hasOwn(game.seats, ownerSeatId)
		? { characterId, label, ownerSeatId }
		: { characterId, label };
}

/**
 * A bank ∞ token's look, tidied: trimmed text and symbol, nothing empty kept. Refuses a
 * symbol that is too long or a colour that isn't one of the theme's.
 */
function genericLook(look: GenericLook | undefined): GenericLook {
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
	return out;
}

/** The look a copy of a bank ∞ token starts with (plan B9); none without a token. */
function tokenLook(game: Game, tokenId: string | undefined): GenericLook {
	if (tokenId === undefined) return {};
	const token = game.genericTokens?.find((t) => t.tokenId === tokenId);
	if (!token) refuse('unknown-token', `no ∞ token ${tokenId}`);
	const look: GenericLook = {};
	if (token.note !== undefined) look.note = token.note;
	if (token.symbol !== undefined) look.symbol = token.symbol;
	if (token.symbolColour !== undefined) look.symbolColour = token.symbolColour;
	return look;
}

function checkReminder(game: Game, reminder: Reminder, ctx: EngineContext, warn: Warn): void {
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
function heldReminder(
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
function ruleHolderOf(game: Game, ctx: EngineContext, characterId: CharacterId): CharacterId {
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
function warnIfNotRuleReminder(reminder: Reminder, ctx: EngineContext, warn: Warn): void {
	if (reminder.characterId === GENERIC_REMINDER_ID) return;
	const type = ctx.characters.get(reminder.characterId)?.type;
	if (type !== 'fabled' && type !== 'loric') {
		warn('reminder-not-from-rule-character', `${reminder.label} is not a Fabled or Loric reminder`);
	}
}

function nextPosition(length: number, ctx: EngineContext): number {
	return Math.floor(ctx.random() * (length + 1));
}

function shuffled<T>(items: readonly T[], ctx: EngineContext): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(ctx.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function tileOf(game: Game, tileId: string): Tile {
	if (!game.bag) refuse('no-bag', 'there is no bag');
	return Object.hasOwn(game.bag.tiles, tileId)
		? game.bag.tiles[tileId]
		: refuse('unknown-tile', `no tile ${tileId}`);
}

/** A recorded death cause, checked: a general cause or a character that exists. */
function deathCause(ctx: EngineContext, cause: DeathCause): DeathCause {
	if ((GENERAL_DEATH_CAUSES as readonly string[]).includes(cause)) return cause;
	return characterOf(ctx, cause).id;
}

function badOverride(message: string): never {
	return refuse('invalid-override', message);
}

function nonEmpty(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.trim() === '') badOverride(`${name} must be text`);
	return value;
}

function textOf(value: unknown): string {
	if (typeof value !== 'string') badOverride('text must be a string');
	return value;
}

function nightOf(value: unknown): { night?: Night } {
	if (value === undefined) return {};
	if (value !== 'first' && value !== 'other') badOverride('night must be first or other');
	return { night: value };
}

function anchorOf(value: unknown): string | null {
	if (value === null) return null;
	return nonEmpty(value, 'after');
}

/** A night-order override, checked and copied field by field. */
function nightOverride(o: NightStepOverride, ctx: EngineContext): NightStepOverride {
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
function dayOverride(game: Game, o: DayReminderOverride, ctx: EngineContext): DayReminderOverride {
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
function overrideIndex(index: number, length: number, adding: boolean): number {
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
function sameOverride(a: object, b: object): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Warns when an `add` override reuses the id or key of another `add` (it would be ignored). */
function checkDuplicateAdd(
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

function entryOf(game: Game, entryId: string): DayEntry {
	return (
		game.today.entries.find((e) => e.entryId === entryId) ??
		refuse('unknown-entry', `no entry ${entryId} in today's log`)
	);
}

function entryOfKind<K extends DayEntry['kind']>(
	game: Game,
	entryId: string,
	kind: K
): Extract<DayEntry, { kind: K }> {
	const entry = entryOf(game, entryId);
	if (entry.kind !== kind) refuse('wrong-entry-kind', `entry ${entryId} is not a ${kind}`);
	return entry as Extract<DayEntry, { kind: K }>;
}

function guessesOf(
	game: Game,
	ctx: EngineContext,
	guesses: readonly CharacterGuess[] | undefined
): CharacterGuess[] {
	return (guesses ?? []).map((g) => ({
		seatId: seatOf(game, g.seatId).seatId,
		characterId: characterOf(ctx, g.characterId).id
	}));
}

/** The reminder token a character places when its once-only ability is used. */
export const NO_ABILITY_LABEL = 'No Ability';

function hasPlacedReminder(game: Game, reminderId: string): boolean {
	return game.seating.some((id) =>
		game.seats[id].reminders.some((r) => r.reminderId === reminderId)
	);
}

/**
 * Checks a nomination. Each player may nominate once per day and be nominated once per
 * day, and dead players may not nominate (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination"). These are warnings: abilities break them, and the Storyteller decides.
 */
function checkNomination(
	game: Game,
	nominator: string,
	nominee: string,
	warn: Warn,
	ignore?: string
): void {
	const others = game.today.entries.filter(
		(e): e is Extract<DayEntry, { kind: 'nomination' }> =>
			e.kind === 'nomination' && e.entryId !== ignore
	);
	if (registersAsDead(game, nominator)) warn('dead-nominator', 'dead players may not nominate');
	if (others.some((e) => e.nominator === nominator)) {
		warn('already-nominated', 'this player has already nominated today');
	}
	if (others.some((e) => e.nominee === nominee)) {
		warn('already-nominee', 'this player has already been nominated today');
	}
}

function decideFor(game: Game, command: Command, ctx: EngineContext, warn: Warn): GameEvent[] {
	switch (command.type) {
		case 'CreateGame':
			return refuse('game-exists', 'this log already has a game');

		case 'ChangeScript': {
			if (JSON.stringify(command.script) === JSON.stringify(game.script)) {
				warn('no-change', 'that is already the script');
				return [];
			}
			for (const id of offScript(game, command.script, ctx)) {
				const name = ctx.characters.get(id)?.name ?? id;
				warn('not-on-script', `${name} is not on the script`);
			}
			return [{ type: 'ScriptChanged', script: command.script }];
		}

		case 'AddSeat': {
			const position = command.position ?? game.seating.length;
			if (!Number.isInteger(position) || position < 0 || position > game.seating.length) {
				refuse('invalid-position', `position must be from 0 to ${game.seating.length}`);
			}
			if (game.seating.length >= MAX_SEATS) {
				refuse('invalid-player-count', `a game has at most ${MAX_SEATS} seats`);
			}
			const playerName = command.playerName?.trim() || undefined;
			const event: GameEvent = { type: 'SeatAdded', seatId: ctx.newId(), position };
			if (playerName !== undefined) event.playerName = playerName;
			return [event];
		}

		case 'RemoveSeat': {
			const seat = seatOf(game, command.seatId);
			const events: GameEvent[] = [];
			if (seat.characterId !== undefined) {
				warn('seat-has-character', 'the removed seat had a character');
			}
			for (const tile of Object.values(game.bag?.tiles ?? {})) {
				if (tile.drawnBySeat === seat.seatId && !tile.confirmed) {
					warn('draw-cancelled', 'the tile this player was holding went back in the bag');
					events.push({
						type: 'DrawCancelled',
						tileId: tile.tileId,
						position: nextPosition(game.bag!.order.length, ctx)
					});
				}
			}
			events.push({ type: 'SeatRemoved', seatId: seat.seatId });
			return events;
		}

		case 'RenameSeat': {
			const seat = seatOf(game, command.seatId);
			const playerName = command.playerName?.trim() || undefined;
			if (playerName === seat.playerName) {
				warn('no-change', 'the name is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'SeatRenamed', seatId: seat.seatId };
			if (playerName !== undefined) event.playerName = playerName;
			return [event];
		}

		case 'SetStorytellerName': {
			const name = command.name?.trim() || undefined;
			if (name === game.storytellerName) {
				warn('no-change', 'the name is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'StorytellerNameSet' };
			if (name !== undefined) event.name = name;
			return [event];
		}

		case 'SetSeatNote': {
			const seat = seatOf(game, command.seatId);
			const note = command.note?.trim() || undefined;
			if (note === seat.note) {
				warn('no-change', 'the note is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'SeatNoteSet', seatId: seat.seatId };
			if (note !== undefined) event.note = note;
			return [event];
		}

		case 'SetSeatLook': {
			const seat = seatOf(game, command.seatId);
			if (command.avatar === seat.avatar && command.frame === seat.frame) {
				warn('no-change', 'the look is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'SeatLookSet', seatId: seat.seatId };
			if (command.avatar !== undefined) event.avatar = command.avatar;
			if (command.frame !== undefined) event.frame = command.frame;
			return [event];
		}

		case 'SetGameNotes': {
			const notes = command.notes?.trim() || undefined;
			if (notes === game.notes) {
				warn('no-change', 'the notes are unchanged');
				return [];
			}
			const event: GameEvent = { type: 'GameNotesSet' };
			if (notes !== undefined) event.notes = notes;
			return [event];
		}

		case 'AssignCharacter': {
			const seat = seatOf(game, command.seatId);
			const character = seatableCharacter(ctx, command.characterId);
			if (character.type !== 'traveller' && !isOnScript(game.script, character.id)) {
				warn('not-on-script', `${character.name} is not on the script`);
			}
			const elsewhere = game.seating.some(
				(id) => id !== seat.seatId && game.seats[id].characterId === character.id
			);
			if (elsewhere && !allowsDuplicates(character)) {
				warn('already-in-play', `${character.name} is already on another seat`);
			}
			const typeDefault = defaultAlignment(character.type);
			let alignment = command.alignment;
			if (alignment === undefined && seat.characterId !== undefined) {
				alignment = seat.alignment;
				if (alignment !== undefined && typeDefault !== undefined && alignment !== typeDefault) {
					warn('kept-alignment', `kept ${alignment}: a character change does not change alignment`);
				}
			}
			alignment ??= typeDefault;
			// A Traveller's alignment may be chosen later: the first night step asks for it
			// (Trevor, 2026-10-16).
			const assigned: GameEvent = {
				type: 'CharacterAssigned',
				seatId: seat.seatId,
				characterId: character.id
			};
			if (alignment !== undefined) assigned.alignment = alignment;
			return [assigned];
		}

		case 'ClearCharacter': {
			const seat = seatOf(game, command.seatId);
			if (seat.characterId === undefined) {
				warn('no-change', 'the seat has no character');
				return [];
			}
			return [{ type: 'CharacterCleared', seatId: seat.seatId }];
		}

		case 'SetAlignment': {
			const seat = seatOf(game, command.seatId);
			if (seat.alignment === command.alignment) {
				warn('no-change', `already ${command.alignment}`);
				return [];
			}
			return [{ type: 'AlignmentSet', seatId: seat.seatId, alignment: command.alignment }];
		}

		case 'SetDead': {
			const seat = seatOf(game, command.seatId);
			const cause = command.cause === undefined ? undefined : deathCause(ctx, command.cause);
			if (!command.dead && cause !== undefined) {
				warn('cause-ignored', 'a living player has no cause of death');
			}
			// Every death has a cause (Trevor, 2026-10-16): still allowed, as an override.
			if (command.dead && cause === undefined && !seat.dead) {
				warn('no-cause', 'every death has a cause; record one');
			}
			if (seat.dead === command.dead) {
				// Marking a dead player dead again with a new cause records the cause.
				if (command.dead && cause !== undefined && cause !== seat.deathCause) {
					return [{ type: 'DeathCauseSet', seatId: seat.seatId, cause }];
				}
				warn('no-change', command.dead ? 'already dead' : 'already alive');
				return [];
			}
			const death: GameEvent = { type: 'DeathSet', seatId: seat.seatId, dead: command.dead };
			if (command.dead && cause !== undefined) death.cause = cause;
			const events: GameEvent[] = [death];
			// A player who comes back to life has their vote again.
			if (!command.dead && seat.ghostVoteUsed) {
				events.push({ type: 'GhostVoteRestored', seatId: seat.seatId });
			}
			return events;
		}

		case 'SetDeathCause': {
			const seat = seatOf(game, command.seatId);
			const cause = command.cause === undefined ? undefined : deathCause(ctx, command.cause);
			if (cause === seat.deathCause) {
				warn('no-change', cause === undefined ? 'no cause is recorded' : `already ${cause}`);
				return [];
			}
			if (!seat.dead) refuse('not-dead', 'only a dead player has a cause of death');
			const event: GameEvent = { type: 'DeathCauseSet', seatId: seat.seatId };
			if (cause !== undefined) event.cause = cause;
			return [event];
		}

		case 'AddNightStepOverride': {
			const list = game.nightOrderOverrides;
			const index = overrideIndex(command.index ?? list.length, list.length, true);
			const override = nightOverride(command.override, ctx);
			checkDuplicateAdd(list, override, warn);
			return [{ type: 'NightStepOverrideAdded', index, override }];
		}

		case 'ReplaceNightStepOverride': {
			const list = game.nightOrderOverrides;
			const index = overrideIndex(command.index, list.length, false);
			const override = nightOverride(command.override, ctx);
			checkDuplicateAdd(
				list.filter((_, i) => i !== index),
				override,
				warn
			);
			if (sameOverride(list[index], override)) {
				warn('no-change', 'the override is unchanged');
				return [];
			}
			return [{ type: 'NightStepOverrideReplaced', index, override }];
		}

		case 'RemoveNightStepOverride': {
			const index = overrideIndex(command.index, game.nightOrderOverrides.length, false);
			return [{ type: 'NightStepOverrideRemoved', index }];
		}

		case 'AddDayReminderOverride': {
			const list = game.dayReminderOverrides;
			const index = overrideIndex(command.index ?? list.length, list.length, true);
			const override = dayOverride(game, command.override, ctx);
			checkDuplicateAdd(list, override, warn);
			return [{ type: 'DayReminderOverrideAdded', index, override }];
		}

		case 'ReplaceDayReminderOverride': {
			const list = game.dayReminderOverrides;
			const index = overrideIndex(command.index, list.length, false);
			const override = dayOverride(game, command.override, ctx);
			checkDuplicateAdd(
				list.filter((_, i) => i !== index),
				override,
				warn
			);
			if (sameOverride(list[index], override)) {
				warn('no-change', 'the override is unchanged');
				return [];
			}
			return [{ type: 'DayReminderOverrideReplaced', index, override }];
		}

		case 'RemoveDayReminderOverride': {
			const index = overrideIndex(command.index, game.dayReminderOverrides.length, false);
			return [{ type: 'DayReminderOverrideRemoved', index }];
		}

		case 'SpendGhostVote': {
			const seat = seatOf(game, command.seatId);
			if (seat.ghostVoteUsed) {
				warn('no-change', 'the ghost vote is already used');
				return [];
			}
			if (!registersAsDead(game, seat.seatId)) {
				warn('ghost-vote-while-alive', 'living players do not use their ghost vote');
			}
			return [{ type: 'GhostVoteSpent', seatId: seat.seatId }];
		}

		case 'RestoreGhostVote': {
			const seat = seatOf(game, command.seatId);
			if (!seat.ghostVoteUsed) {
				warn('no-change', 'the ghost vote is not used');
				return [];
			}
			return [{ type: 'GhostVoteRestored', seatId: seat.seatId }];
		}

		case 'AddReminder': {
			const seat = seatOf(game, command.seatId);
			const reminder: Reminder = reminderFrom(game, command.reminder);
			const look = tokenLook(game, command.tokenId);
			checkReminder(game, reminder, ctx, warn);
			const replaces = replacedBy(reminder, ctx.characters);
			if (replaces && seat.alignment !== undefined) {
				const expected = defaultAlignment(replaces.type);
				if (expected !== undefined && expected !== seat.alignment) {
					warn(
						'alignment-differs-from-true-character',
						`the ${replaces.name} is ${expected} but this seat is ${seat.alignment}`
					);
				}
			}
			return [
				{
					type: 'ReminderAdded',
					seatId: seat.seatId,
					reminder: { reminderId: ctx.newId(), ...reminder, ...look }
				}
			];
		}

		case 'ApplySetupReminders': {
			const seats = command.placements.map((p) => seatOf(game, p.seatId));
			if (seats.length === 0) {
				warn('no-change', 'there are no reminders to place');
				return [];
			}
			return command.placements.map((p, i): GameEvent => {
				const reminder: Reminder = reminderFrom(game, p.reminder);
				checkReminder(game, reminder, ctx, warn);
				return {
					type: 'ReminderAdded',
					seatId: seats[i].seatId,
					reminder: { reminderId: ctx.newId(), ...reminder }
				};
			});
		}

		case 'MoveReminder': {
			const to = seatOf(game, command.toSeatId);
			// Off a Fabled or Loric and onto a seat.
			const holder = reminderHolder(game, command.reminderId);
			if (holder && !('seatId' in holder)) {
				return [{ type: 'ReminderMoved', reminderId: command.reminderId, toSeatId: to.seatId }];
			}
			const from = game.seating
				.map((id) => game.seats[id])
				.find((s) => s.reminders.some((r) => r.reminderId === command.reminderId));
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			if (from.seatId === to.seatId) {
				warn('no-change', 'the reminder is already on that seat');
				return [];
			}
			const fixed = fixedReminderMove(game, command.reminderId, to.seatId);
			if (fixed)
				warn('reminder-fixed', `${fixed.reminder.label} usually stays where it was placed`);
			return [{ type: 'ReminderMoved', reminderId: command.reminderId, toSeatId: to.seatId }];
		}

		case 'RemoveReminder': {
			const found = reminderHolder(game, command.reminderId) !== undefined;
			if (!found) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			return [{ type: 'ReminderRemoved', reminderId: command.reminderId }];
		}

		case 'AddRuleReminder': {
			const holder = ruleHolderOf(game, ctx, command.characterId);
			const reminder: Reminder = reminderFrom(game, command.reminder);
			const look = tokenLook(game, command.tokenId);
			checkReminder(game, reminder, ctx, warn);
			warnIfNotRuleReminder(reminder, ctx, warn);
			return [
				{
					type: 'RuleReminderAdded',
					characterId: holder,
					reminder: { reminderId: ctx.newId(), ...reminder, ...look }
				}
			];
		}

		case 'MoveReminderToRuleCharacter': {
			const holder = ruleHolderOf(game, ctx, command.characterId);
			const from = reminderHolder(game, command.reminderId);
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			if ('characterId' in from && from.characterId === holder) {
				warn('no-change', 'the reminder is already there');
				return [];
			}
			const reminder = heldReminder(game, from, command.reminderId);
			warnIfNotRuleReminder(reminder, ctx, warn);
			return [
				{
					type: 'ReminderMovedToRuleCharacter',
					reminderId: command.reminderId,
					characterId: holder
				}
			];
		}

		case 'SetReminderNote': {
			const from = reminderHolder(game, command.reminderId);
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
			const note = command.note?.trim() || undefined;
			if (note === reminder.note) {
				warn('no-change', 'the note is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'ReminderNoteSet', reminderId: command.reminderId };
			if (note !== undefined) event.note = note;
			return [event];
		}

		case 'SetReminderSymbol': {
			const from = reminderHolder(game, command.reminderId);
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
			const symbol = command.symbol?.trim() || undefined;
			if (symbol !== undefined && symbol.length > MAX_REMINDER_SYMBOL)
				refuse('invalid-symbol', `a symbol is at most ${MAX_REMINDER_SYMBOL} characters`);
			if (symbol === reminder.symbol) {
				warn('no-change', 'the symbol is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'ReminderSymbolSet', reminderId: command.reminderId };
			if (symbol !== undefined) event.symbol = symbol;
			return [event];
		}

		case 'SetReminderSymbolColour': {
			const from = reminderHolder(game, command.reminderId);
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
			const { colour } = command;
			if (colour !== undefined && !SYMBOL_COLOURS.includes(colour))
				refuse('invalid-colour', `no symbol colour ${colour}`);
			if (colour === reminder.symbolColour) {
				warn('no-change', 'the colour is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'ReminderSymbolColourSet', reminderId: command.reminderId };
			if (colour !== undefined) event.colour = colour;
			return [event];
		}

		case 'PlaceLooseReminder': {
			const reminder: Reminder = reminderFrom(game, command.reminder);
			const look = tokenLook(game, command.tokenId);
			checkReminder(game, reminder, ctx, warn);
			return [
				{ type: 'LooseReminderPlaced', reminder: { reminderId: ctx.newId(), ...reminder, ...look } }
			];
		}

		case 'AddGenericToken':
			return [
				{ type: 'GenericTokenAdded', token: { tokenId: ctx.newId(), ...genericLook(command.look) } }
			];

		case 'SetGenericToken': {
			const token = game.genericTokens?.find((t) => t.tokenId === command.tokenId);
			if (!token) refuse('unknown-token', `no ∞ token ${command.tokenId}`);
			const look = genericLook(command.look);
			if (
				look.note === token.note &&
				look.symbol === token.symbol &&
				look.symbolColour === token.symbolColour
			) {
				warn('no-change', 'the token is unchanged');
				return [];
			}
			return [{ type: 'GenericTokenSet', token: { tokenId: token.tokenId, ...look } }];
		}

		case 'RemoveGenericToken': {
			if (!game.genericTokens?.some((t) => t.tokenId === command.tokenId))
				refuse('unknown-token', `no ∞ token ${command.tokenId}`);
			return [{ type: 'GenericTokenRemoved', tokenId: command.tokenId }];
		}

		case 'LoosenReminder': {
			const from = reminderHolder(game, command.reminderId);
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			if ('loose' in from) {
				warn('no-change', 'the reminder is already loose');
				return [];
			}
			return [{ type: 'ReminderLoosened', reminderId: command.reminderId }];
		}

		case 'SwapSeats': {
			const a = seatOf(game, command.seatA);
			const b = seatOf(game, command.seatB);
			if (a.seatId === b.seatId) refuse('same-seat', 'choose two different seats');
			return [{ type: 'SeatsSwapped', seatA: a.seatId, seatB: b.seatId }];
		}

		case 'RotateSeats': {
			const { seating } = game;
			if (command.direction !== 'clockwise' && command.direction !== 'anticlockwise') {
				refuse('invalid-direction', 'rotate clockwise or anticlockwise');
			}
			if (seating.length < 2) {
				warn('no-change', 'there are fewer than 2 seats');
				return [];
			}
			const rotated =
				command.direction === 'clockwise'
					? [seating[seating.length - 1], ...seating.slice(0, -1)]
					: [...seating.slice(1), seating[0]];
			return [...seatNumberNames(game), { type: 'SeatingReordered', seating: rotated }];
		}

		case 'MoveSeat': {
			const seat = seatOf(game, command.seatId);
			const { position } = command;
			const last = game.seating.length - 1;
			if (!Number.isInteger(position) || position < 0 || position > last) {
				refuse('invalid-position', `position must be from 0 to ${last}`);
			}
			if (game.seating.indexOf(seat.seatId) === position) {
				warn('no-change', 'the player is already there');
				return [];
			}
			const seating = game.seating.filter((id) => id !== seat.seatId);
			seating.splice(position, 0, seat.seatId);
			return [...seatNumberNames(game), { type: 'SeatingReordered', seating }];
		}

		case 'SetOverride': {
			const seat = seatOf(game, command.seatId);
			const { override } = command;
			if (!(OVERRIDE_FIELDS as readonly string[]).includes(override.field)) {
				refuse('unknown-override', `no override ${String(override.field)}`);
			}
			if (override.field === 'character') characterOf(ctx, override.value);
			const copy = { ...override };
			const note = copy.note?.trim();
			if (note) copy.note = note;
			else delete copy.note;
			return [{ type: 'OverrideSet', seatId: seat.seatId, override: copy }];
		}

		case 'ClearOverride': {
			const seat = seatOf(game, command.seatId);
			if (!seat.overrides.some((o) => o.field === command.field)) {
				warn('no-change', `no ${command.field} override`);
				return [];
			}
			return [{ type: 'OverrideCleared', seatId: seat.seatId, field: command.field }];
		}

		case 'AddRuleCharacter': {
			const character = characterOf(ctx, command.characterId);
			if (character.type !== 'fabled' && character.type !== 'loric') {
				refuse('not-rule-character', `${character.name} is not a Fabled or Loric`);
			}
			if (game.ruleCharacters.includes(character.id)) {
				warn('no-change', `${character.name} is already in play`);
				return [];
			}
			return [{ type: 'RuleCharacterAdded', characterId: character.id }];
		}

		case 'RemoveRuleCharacter': {
			if (!game.ruleCharacters.includes(command.characterId)) {
				warn('no-change', `${command.characterId} is not in play`);
				return [];
			}
			return [{ type: 'RuleCharacterRemoved', characterId: command.characterId }];
		}

		case 'SetBluffs': {
			const { set } = command;
			if (!Number.isInteger(set) || set < 0 || set > game.bluffs.length) {
				refuse('invalid-bluff-set', `bluff set must be from 0 to ${game.bluffs.length}`);
			}
			const characters = command.characterIds.map((id) => characterOf(ctx, id));
			if (characters.length > BLUFFS_PER_SET) {
				warn('too-many-bluffs', `a bluff set usually has ${BLUFFS_PER_SET} characters`);
			}
			// In play means a true character (a Drunk shown the Chef leaves the Chef free to
			// bluff: https://wiki.bloodontheclocktower.com/Drunk). Set 1 is the Lunatic's bluffs
			// while a Lunatic is in play, and may hold characters in play (Trevor, 2026-10-16).
			const playing = trulyInPlay(game, ctx);
			const lunaticSet = set === 1 && playing.has('lunatic');
			const seen = new Set<CharacterId>();
			for (const character of characters) {
				if (seen.has(character.id)) warn('bluff-duplicate', `${character.name} is listed twice`);
				seen.add(character.id);
				if (!lunaticSet && playing.has(character.id)) {
					warn('bluff-in-play', `${character.name} is in play`);
				}
				if (defaultAlignment(character.type) !== 'good' || character.type === 'traveller') {
					warn('bluff-not-good', `${character.name} is not a good character`);
				}
				if (!isOnScript(game.script, character.id)) {
					warn('not-on-script', `${character.name} is not on the script`);
				}
			}
			return [{ type: 'BluffsSet', set, characterIds: characters.map((c) => c.id) }];
		}

		case 'RemoveBluffSet': {
			const { set } = command;
			if (!Number.isInteger(set) || set < 0 || set >= game.bluffs.length) {
				refuse('invalid-bluff-set', `no bluff set ${set}`);
			}
			return [{ type: 'BluffSetRemoved', set }];
		}

		case 'RenameBluffSet': {
			const { set } = command;
			// The Demon's set keeps its name; the others are the Storyteller's to name.
			if (!Number.isInteger(set) || set < 1 || set >= game.bluffs.length) {
				refuse('invalid-bluff-set', `no bluff set ${set} to rename`);
			}
			const name = command.name.trim().slice(0, MAX_BLUFF_SET_NAME);
			if (name === (game.bluffNames?.[set] ?? '')) {
				warn('no-change', 'the set already has that name');
				return [];
			}
			return [{ type: 'BluffSetRenamed', set, name }];
		}

		case 'BuildBag': {
			// A new bag starts the draw again, so what the old draw put in the grimoire goes
			// (Trevor, 2026-10-17): the characters it dealt and the reminders of its characters.
			// Player names and seats stay.
			const cleared: GameEvent[] = [];
			if (game.bag && Object.values(game.bag.tiles).some((t) => t.drawnBySeat !== undefined)) {
				warn('bag-replaced', 'tiles had already been drawn from the old bag');
				const old = game.bag;
				const tiles = Object.values(old.tiles);
				const characters = new Set([
					...tiles.flatMap((t) => [t.grimoire, t.shows, ...t.reminders.map((r) => r.characterId)]),
					...(old.unseated ?? []).map((r) => r.characterId)
				]);
				for (const tile of tiles) {
					const seat =
						tile.confirmed && tile.drawnBySeat ? game.seats[tile.drawnBySeat] : undefined;
					if (seat && seat.characterId === tile.grimoire) {
						cleared.push({ type: 'CharacterCleared', seatId: seat.seatId });
					}
				}
				for (const id of game.seating) {
					for (const r of game.seats[id].reminders) {
						if (characters.has(r.characterId)) {
							cleared.push({ type: 'ReminderRemoved', reminderId: r.reminderId });
						}
					}
				}
			}
			const tiles: Tile[] = command.tiles.map((spec) => {
				const shows = seatableCharacter(ctx, spec.shows);
				const grimoire = seatableCharacter(ctx, spec.grimoire);
				if (!command.includeTravellers && grimoire.type === 'traveller') {
					warn('traveller-in-bag', `${grimoire.name} is a Traveller in a bag without Travellers`);
				}
				for (const character of [shows, grimoire]) {
					if (character.type !== 'traveller' && !isOnScript(game.script, character.id)) {
						warn('not-on-script', `${character.name} is not on the script`);
					}
				}
				const reminders = (spec.reminders ?? []).map((r) => {
					const source = characterOf(ctx, r.characterId);
					if (!isKnownReminder(source, r.label)) {
						warn('reminder-not-for-character', `${source.name} has no "${r.label}" reminder`);
					}
					return { characterId: r.characterId, label: r.label };
				});
				return {
					tileId: ctx.newId(),
					shows: shows.id,
					grimoire: grimoire.id,
					reminders,
					confirmed: false
				};
			});
			const unseated = (command.unseated ?? []).map((r) => {
				const source = characterOf(ctx, r.characterId);
				if (!isKnownReminder(source, r.label)) {
					warn('reminder-not-for-character', `${source.name} has no "${r.label}" reminder`);
				}
				return { characterId: r.characterId, label: r.label };
			});
			const ids = tiles.map((t) => t.tileId);
			const order = command.shuffle === false ? ids : shuffled(ids, ctx);
			return [
				...cleared,
				{
					type: 'BagBuilt',
					tiles,
					order,
					includeTravellers: command.includeTravellers,
					...(unseated.length ? { unseated } : {})
				}
			];
		}

		case 'ClearBag':
			if (!game.bag) {
				warn('no-change', 'there is no bag');
				return [];
			}
			return [{ type: 'BagCleared' }];

		case 'DrawTile': {
			const seat = seatOf(game, command.seatId);
			if (!game.bag) refuse('no-bag', 'there is no bag');
			const tileId = command.tileId ?? game.bag.order[0];
			if (tileId === undefined) refuse('bag-empty', 'the bag is empty');
			tileOf(game, tileId);
			if (!game.bag.order.includes(tileId))
				refuse('tile-not-in-bag', 'that tile is not in the bag');
			const holding = Object.values(game.bag.tiles).some(
				(t) => t.drawnBySeat === seat.seatId && !t.confirmed
			);
			if (holding) warn('seat-holds-tile', 'this player is already holding a tile');
			return [{ type: 'TileDrawn', tileId, seatId: seat.seatId }];
		}

		case 'ConfirmDraw': {
			const tile = tileOf(game, command.tileId);
			if (tile.confirmed) refuse('tile-confirmed', 'that draw is already confirmed');
			if (tile.drawnBySeat === undefined) refuse('tile-not-drawn', 'nobody has drawn that tile');
			const seat = seatOf(game, tile.drawnBySeat);
			const grimoire = seatableCharacter(ctx, tile.grimoire);
			if (seat.characterId !== undefined) {
				warn('replaces-character', 'the seat already had a character');
			}
			const alignment = command.alignment ?? alignmentFromCharacters(grimoire, tile.reminders, ctx);
			return [
				{ type: 'DrawConfirmed', tileId: tile.tileId },
				{
					type: 'CharacterAssigned',
					seatId: seat.seatId,
					characterId: grimoire.id,
					...(alignment !== undefined ? { alignment } : {})
				}
				// The tile's "Is The Drunk" style reminders are not placed here: setupReminders
				// suggests them on this seat (Trevor, 2026-10-16).
			];
		}

		case 'Nominate': {
			const nominator = seatOf(game, command.nominator).seatId;
			const nominee = seatOf(game, command.nominee).seatId;
			checkNomination(game, nominator, nominee, warn);
			return [
				{
					type: 'DayEntryAdded',
					entry: { kind: 'nomination', entryId: ctx.newId(), nominator, nominee }
				}
			];
		}

		case 'EditNomination': {
			const entry = entryOfKind(game, command.entryId, 'nomination');
			const nominator = seatOf(game, command.nominator).seatId;
			const nominee = seatOf(game, command.nominee).seatId;
			if (entry.nominator === nominator && entry.nominee === nominee) {
				warn('no-change', 'the nomination is unchanged');
				return [];
			}
			checkNomination(game, nominator, nominee, warn, entry.entryId);
			return [{ type: 'DayEntryReplaced', entry: { ...entry, nominator, nominee } }];
		}

		case 'SetDemonVoted': {
			if (command.voted === game.today.demonVoted) {
				warn('no-change', 'already marked');
				return [];
			}
			const event: GameEvent = { type: 'DemonVotedSet' };
			if (command.voted !== undefined) event.voted = command.voted;
			return [event];
		}

		case 'SetPrepValue': {
			const value = command.value?.trim() || undefined;
			if (!command.key.trim()) refuse('invalid-prep-value', 'a prep value needs a key');
			if (value === game.prepValues?.[command.key]) {
				warn('no-change', 'the value is unchanged');
				return [];
			}
			const event: GameEvent = { type: 'PrepValueSet', key: command.key };
			if (value !== undefined) event.value = value;
			return [event];
		}

		case 'Execute': {
			const seat = seatOf(game, command.seatId);
			if (game.today.entries.some((e) => e.kind === 'execution')) {
				warn('already-executed', 'there is usually one execution a day');
			}
			if (isTraveller(game, seat.seatId, ctx.characters)) {
				warn('traveller-executed', 'Travellers are exiled, not executed');
			}
			const entry: DayEntry = {
				kind: 'execution',
				entryId: ctx.newId(),
				seatId: seat.seatId,
				died: !seat.dead
			};
			if (seat.dead) {
				warn('already-dead', 'the player was already dead, so the execution is only logged');
				return [{ type: 'DayEntryAdded', entry }];
			}
			return [
				{ type: 'DayEntryAdded', entry },
				{ type: 'DeathSet', seatId: seat.seatId, dead: true, cause: 'execution' }
			];
		}

		case 'Exile': {
			const seat = seatOf(game, command.seatId);
			if (!isTraveller(game, seat.seatId, ctx.characters)) {
				warn('not-traveller', 'only Travellers are exiled');
			}
			const entry: DayEntry = {
				kind: 'exile',
				entryId: ctx.newId(),
				seatId: seat.seatId,
				died: !seat.dead
			};
			if (seat.dead) {
				warn('already-dead', 'the player was already dead, so the exile is only logged');
				return [{ type: 'DayEntryAdded', entry }];
			}
			return [
				{ type: 'DayEntryAdded', entry },
				{ type: 'DeathSet', seatId: seat.seatId, dead: true, cause: 'exile' }
			];
		}

		case 'UseAbility': {
			const seat = seatOf(game, command.seatId);
			const character = characterOf(ctx, command.characterId);
			const truly = trueCharacter(game, seat.seatId, ctx.characters);
			if (seat.characterId !== character.id && truly !== character.id) {
				warn('not-seat-character', `this seat is not the ${character.name}`);
			}
			const entry: Extract<DayEntry, { kind: 'ability' }> = {
				kind: 'ability',
				entryId: ctx.newId(),
				seatId: seat.seatId,
				characterId: character.id
			};
			const usedToday = game.today.entries.some(
				(e) => e.kind === 'ability' && e.seatId === seat.seatId && e.characterId === character.id
			);
			if (!character.reminders.includes(NO_ABILITY_LABEL)) {
				if (usedToday) warn('already-used', `the ${character.name} already used it today`);
				return [{ type: 'DayEntryAdded', entry }];
			}
			const placed = seat.reminders.some(
				(r) => r.characterId === character.id && r.label === NO_ABILITY_LABEL
			);
			if (placed) {
				warn('already-used', `the ${character.name} already has "${NO_ABILITY_LABEL}"`);
				return [{ type: 'DayEntryAdded', entry }];
			}
			const reminderId = ctx.newId();
			return [
				{
					type: 'ReminderAdded',
					seatId: seat.seatId,
					reminder: { reminderId, characterId: character.id, label: NO_ABILITY_LABEL }
				},
				{ type: 'DayEntryAdded', entry: { ...entry, reminderId } }
			];
		}

		case 'DayNote': {
			const characterId = characterOf(ctx, command.characterId).id;
			const guesses = guessesOf(game, ctx, command.guesses);
			const text = typeof command.text === 'string' ? command.text : '';
			if (text.trim() === '' && guesses.length === 0) {
				warn('no-change', 'the note is empty');
				return [];
			}
			const entry: DayEntry = { kind: 'note', entryId: ctx.newId(), characterId, text };
			if (command.seatId !== undefined) entry.seatId = seatOf(game, command.seatId).seatId;
			if (guesses.length > 0) entry.guesses = guesses;
			if (typeof command.holds === 'boolean') entry.holds = command.holds;
			return [{ type: 'DayEntryAdded', entry }];
		}

		case 'EditDayNote': {
			const entry = entryOfKind(game, command.entryId, 'note');
			const guesses = guessesOf(game, ctx, command.guesses);
			const text = typeof command.text === 'string' ? command.text : '';
			// Clearing a note removes it: nothing requires a note.
			if (text.trim() === '' && guesses.length === 0) {
				return [{ type: 'DayEntryRemoved', entryId: entry.entryId }];
			}
			const next: Extract<DayEntry, { kind: 'note' }> = { ...entry, text };
			delete next.guesses;
			delete next.holds;
			if (guesses.length > 0) next.guesses = guesses;
			if (typeof command.holds === 'boolean') next.holds = command.holds;
			if (JSON.stringify(next) === JSON.stringify(entry)) {
				warn('no-change', 'the note is unchanged');
				return [];
			}
			return [{ type: 'DayEntryReplaced', entry: next }];
		}

		case 'RecordNightInfo': {
			const seat = seatOf(game, command.seatId);
			const characterId = characterOf(ctx, command.characterId).id;
			const text = typeof command.text === 'string' ? command.text.trim() : '';
			const placements = (command.reminders ?? []).map((p) => {
				const target = seatOf(game, p.seatId);
				const reminder: Reminder = reminderFrom(game, p.reminder);
				checkReminder(game, reminder, ctx, warn);
				return { seatId: target.seatId, reminder: { reminderId: ctx.newId(), ...reminder } };
			});
			const abnormal = (command.abnormal ?? []).map((cause): AbnormalCause => {
				if (!(ABNORMAL_REASONS as readonly string[]).includes(cause.reason)) {
					refuse('invalid-abnormal', `unknown abnormal reason ${String(cause.reason)}`);
				}
				return {
					reason: cause.reason,
					...(cause.characterId !== undefined
						? { characterId: characterOf(ctx, cause.characterId).id }
						: {}),
					...(cause.seatId !== undefined ? { seatId: seatOf(game, cause.seatId).seatId } : {})
				};
			});
			if (text === '' && placements.length === 0) {
				warn('no-change', 'nothing to record');
				return [];
			}
			return [
				...placements.map((p): GameEvent => ({ type: 'ReminderAdded', ...p })),
				{
					type: 'DayEntryAdded',
					entry: {
						kind: 'info',
						entryId: ctx.newId(),
						seatId: seat.seatId,
						characterId,
						text,
						reminderIds: placements.map((p) => p.reminder.reminderId),
						...(abnormal.length > 0 ? { abnormal } : {})
					}
				}
			];
		}

		case 'RemoveDayEntry': {
			const entry = entryOf(game, command.entryId);
			const events: GameEvent[] = [];
			if ((entry.kind === 'execution' || entry.kind === 'exile') && entry.died) {
				const seat = getSeat(game, entry.seatId);
				if (seat?.dead && seat.deathCause === entry.kind) {
					events.push({ type: 'DeathSet', seatId: seat.seatId, dead: false });
					if (seat.ghostVoteUsed) events.push({ type: 'GhostVoteRestored', seatId: seat.seatId });
				}
			}
			const placed =
				entry.kind === 'info'
					? entry.reminderIds
					: entry.kind === 'ability' && entry.reminderId !== undefined
						? [entry.reminderId]
						: [];
			for (const reminderId of placed) {
				if (hasPlacedReminder(game, reminderId))
					events.push({ type: 'ReminderRemoved', reminderId });
			}
			events.push({ type: 'DayEntryRemoved', entryId: entry.entryId });
			return events;
		}

		case 'NewDay':
			if (game.today.entries.length === 0 && game.today.demonVoted === undefined) {
				warn('empty-day', 'nothing was logged since the last new day');
			}
			return [{ type: 'DayStarted', at: ctx.now() }];

		case 'CancelDraw': {
			const tile = tileOf(game, command.tileId);
			if (tile.confirmed) refuse('tile-confirmed', 'that draw is already confirmed');
			if (tile.drawnBySeat === undefined) refuse('tile-not-drawn', 'nobody has drawn that tile');
			return [
				{
					type: 'DrawCancelled',
					tileId: tile.tileId,
					position: nextPosition(game.bag!.order.length, ctx)
				}
			];
		}
	}
}

/**
 * Before players move round the circle, each unnamed seat takes the name it shows now, its
 * seat number ("Seat 3"), so every name moves with its player and character (Trevor,
 * 2026-10-22: "all names don't stay with the seat").
 */
function seatNumberNames(game: Game): GameEvent[] {
	return game.seating.flatMap((seatId, i): GameEvent[] =>
		game.seats[seatId].playerName === undefined
			? [{ type: 'SeatRenamed', seatId, playerName: `Seat ${i + 1}` }]
			: []
	);
}

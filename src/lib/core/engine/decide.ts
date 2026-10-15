/**
 * Turns a command into events, checking it against the game first.
 *
 * The Storyteller is never blocked by the rules (04-architecture.md §4: assist, never
 * rule). Rules concerns are *warnings*: the events still happen. A command is refused
 * with an *error* only when it cannot be applied at all: it names a seat, reminder,
 * tile or character that does not exist, puts a Fabled or Loric on a seat, or assigns a
 * Traveller with no alignment (the Storyteller must choose it; the UI asks).
 */
import {
	defaultAlignment,
	isSeatable,
	type Alignment,
	type Character,
	type CharacterId
} from '#lib/core/data/index.ts';
import {
	OVERRIDE_FIELDS,
	getSeat,
	isKnownReminder,
	isOnScript,
	registersAsDead,
	replacedBy,
	trueCharacter,
	type Game,
	type Reminder,
	type Seat,
	type Tile
} from '#lib/core/model/index.ts';
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
	| 'unknown-override'
	| 'not-seatable'
	| 'not-rule-character'
	| 'traveller-needs-alignment'
	| 'same-seat'
	| 'invalid-bluff-set'
	| 'no-bag'
	| 'bag-empty'
	| 'unknown-tile'
	| 'tile-not-in-bag'
	| 'tile-not-drawn'
	| 'tile-confirmed';

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
	| 'reminder-character-not-in-play'
	| 'bluff-in-play'
	| 'bluff-not-good'
	| 'bluff-duplicate'
	| 'too-many-bluffs'
	| 'traveller-in-bag'
	| 'bag-replaced'
	| 'seat-holds-tile'
	| 'replaces-character';

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
	return [
		{
			type: 'GameCreated',
			gameId: ctx.newId(),
			createdAt: ctx.now(),
			script: command.script,
			seatIds
		}
	];
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

function checkReminder(game: Game, reminder: Reminder, ctx: EngineContext, warn: Warn): void {
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

function decideFor(game: Game, command: Command, ctx: EngineContext, warn: Warn): GameEvent[] {
	switch (command.type) {
		case 'CreateGame':
			return refuse('game-exists', 'this log already has a game');

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
			if (alignment === undefined) {
				refuse('traveller-needs-alignment', `choose good or evil for the ${character.name}`);
			}
			return [
				{ type: 'CharacterAssigned', seatId: seat.seatId, characterId: character.id, alignment }
			];
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
			if (seat.dead === command.dead) {
				warn('no-change', command.dead ? 'already dead' : 'already alive');
				return [];
			}
			const events: GameEvent[] = [{ type: 'DeathSet', seatId: seat.seatId, dead: command.dead }];
			// A player who comes back to life has their vote again.
			if (!command.dead && seat.ghostVoteUsed) {
				events.push({ type: 'GhostVoteRestored', seatId: seat.seatId });
			}
			return events;
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
			const reminder: Reminder = {
				characterId: command.reminder.characterId,
				label: command.reminder.label
			};
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
					reminder: { reminderId: ctx.newId(), ...reminder }
				}
			];
		}

		case 'MoveReminder': {
			const to = seatOf(game, command.toSeatId);
			const from = game.seating
				.map((id) => game.seats[id])
				.find((s) => s.reminders.some((r) => r.reminderId === command.reminderId));
			if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			if (from.seatId === to.seatId) {
				warn('no-change', 'the reminder is already on that seat');
				return [];
			}
			return [{ type: 'ReminderMoved', reminderId: command.reminderId, toSeatId: to.seatId }];
		}

		case 'RemoveReminder': {
			const found = game.seating.some((id) =>
				game.seats[id].reminders.some((r) => r.reminderId === command.reminderId)
			);
			if (!found) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
			return [{ type: 'ReminderRemoved', reminderId: command.reminderId }];
		}

		case 'SwapSeats': {
			const a = seatOf(game, command.seatA);
			const b = seatOf(game, command.seatB);
			if (a.seatId === b.seatId) refuse('same-seat', 'choose two different seats');
			return [{ type: 'SeatsSwapped', seatA: a.seatId, seatB: b.seatId }];
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
			const playing = inPlay(game, ctx);
			const seen = new Set<CharacterId>();
			for (const character of characters) {
				if (seen.has(character.id)) warn('bluff-duplicate', `${character.name} is listed twice`);
				seen.add(character.id);
				if (playing.has(character.id)) warn('bluff-in-play', `${character.name} is in play`);
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

		case 'BuildBag': {
			if (game.bag && Object.values(game.bag.tiles).some((t) => t.drawnBySeat !== undefined)) {
				warn('bag-replaced', 'tiles had already been drawn from the old bag');
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
			const ids = tiles.map((t) => t.tileId);
			const order = command.shuffle === false ? ids : shuffled(ids, ctx);
			return [{ type: 'BagBuilt', tiles, order, includeTravellers: command.includeTravellers }];
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
			if (alignment === undefined) {
				refuse('traveller-needs-alignment', `choose good or evil for the ${grimoire.name}`);
			}
			return [
				{ type: 'DrawConfirmed', tileId: tile.tileId },
				{ type: 'CharacterAssigned', seatId: seat.seatId, characterId: grimoire.id, alignment },
				...tile.reminders.map((r): GameEvent => ({
					type: 'ReminderAdded',
					seatId: seat.seatId,
					reminder: { reminderId: ctx.newId(), characterId: r.characterId, label: r.label }
				}))
			];
		}

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

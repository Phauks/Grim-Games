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
import type { CharacterId } from '#lib/core/data/index.ts';
import type { Game } from '#lib/core/model/index.ts';
import { startingRuleCharacters } from '#lib/core/rules/script-rules.ts';
import type { Command, CommandOf, CommandType } from './commands.ts';
import type { EngineContext } from './context.ts';
import type { GameEvent } from './events.ts';
import { SEATS_DECIDERS } from './decide/seats.ts';
import { CHARACTERS_DECIDERS } from './decide/characters.ts';
import { OVERRIDES_DECIDERS } from './decide/overrides.ts';
import { REMINDERS_DECIDERS } from './decide/reminders.ts';
import { BLUFFS_BAG_DECIDERS } from './decide/bluffs-bag.ts';
import { DAY_DECIDERS } from './decide/day.ts';
import {
	MAX_PLAYERS,
	MAX_SEATS,
	MIN_PLAYERS,
	Refusal,
	characterOf,
	refuse,
	type Decider,
	type Deciders,
	type Warn
} from './decide/shared.ts';

export {
	BLUFFS_PER_SET,
	MAX_BLUFF_SET_NAME,
	MIN_PLAYERS,
	MAX_PLAYERS,
	MAX_SEATS
} from './decide/shared.ts';

export type ErrorCode =
	| 'no-game'
	| 'game-exists'
	| 'invalid-player-count'
	| 'invalid-position'
	| 'unknown-seat'
	| 'unknown-character'
	| 'unknown-reminder'
	| 'unknown-note'
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
	| 'invalid-day-mark'
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
	| 'survives-execution'
	| 'save-may-not-apply'
	| 'not-seat-character'
	| 'already-used'
	| 'too-many-guesses'
	| 'empty-day'
	| 'reminder-fixed'
	| 'reminder-followed'
	| 'no-cause';

export interface Issue<C extends string> {
	code: C;
	/** English, for logs and tests; the UI shows its own text for each code. */
	message: string;
	/** The characters it is about, where a screen may judge it (not-on-script). */
	characters?: CharacterId[];
}
export type EngineError = Issue<ErrorCode>;
export type EngineWarning = Issue<WarningCode>;

export type Decision =
	{ ok: true; events: GameEvent[]; warnings: EngineWarning[] } | { ok: false; error: EngineError };

/** Checks `command` against `game` and returns the events it produces, or why it cannot. */
export function decide(game: Game | undefined, command: Command, ctx: EngineContext): Decision {
	const warnings: EngineWarning[] = [];
	const warn: Warn = (code, message, characters) =>
		warnings.push(characters ? { code, message, characters } : { code, message });
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

/** One decider per kind of command, so TypeScript checks every command has one. */
const DECIDERS: Deciders<CommandType> = {
	CreateGame: () => refuse('game-exists', 'this log already has a game'),
	...SEATS_DECIDERS,
	...CHARACTERS_DECIDERS,
	...OVERRIDES_DECIDERS,
	...REMINDERS_DECIDERS,
	...BLUFFS_BAG_DECIDERS,
	...DAY_DECIDERS
};

function decideFor(game: Game, command: Command, ctx: EngineContext, warn: Warn): GameEvent[] {
	const decider = DECIDERS[command.type] as Decider<CommandType>;
	return decider(game, command, ctx, warn);
}

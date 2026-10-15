/**
 * The event log and undo/redo. Each accepted command adds one entry holding all the
 * events it produced, so undo and redo work command by command. The game is the reducer
 * folded over the entries up to `cursor`; entries after the cursor are the redo stack,
 * and a new command discards them.
 */
import type { Game } from '#lib/core/model/index.ts';
import type { Command, CommandOf, CommandType } from './commands.ts';
import type { EngineContext } from './context.ts';
import { decide, type EngineError, type EngineWarning } from './decide.ts';
import type { GameEvent } from './events.ts';
import { applyEvent, applyEvents } from './reducer.ts';

export interface LogEntry {
	/** Milliseconds since the epoch. */
	at: number;
	command: CommandType;
	events: GameEvent[];
	/** Rules warnings the Storyteller went ahead with, kept for the game history. */
	warnings?: EngineWarning[];
}

export interface GameLog {
	/** `entries[0]` is always the `CreateGame` entry, which cannot be undone. */
	entries: LogEntry[];
	/** How many entries are applied. */
	cursor: number;
}

/** A log with its current game, so the game is not rebuilt on every command. */
export interface GameSession {
	readonly log: GameLog;
	readonly game: Game;
}

export type DispatchResult =
	{ ok: true; session: GameSession; warnings: EngineWarning[] } | { ok: false; error: EngineError };

/** Rebuilds the game from a log, up to its cursor. */
export function replay(log: GameLog): Game {
	let game: Game | undefined;
	for (const entry of log.entries.slice(0, log.cursor)) game = applyEvents(game, entry.events);
	if (!game) throw new Error('the log has no GameCreated entry');
	return game;
}

export function openSession(log: GameLog): GameSession {
	return { log, game: replay(log) };
}

function entry(command: CommandType, events: GameEvent[], warnings: EngineWarning[], at: number) {
	const e: LogEntry = { at, command, events };
	if (warnings.length > 0) e.warnings = warnings;
	return e;
}

/** Starts a new game: its log's first entry is the `CreateGame` command. */
export function createGame(command: CommandOf<'CreateGame'>, ctx: EngineContext): DispatchResult {
	const decision = decide(undefined, command, ctx);
	if (!decision.ok) return decision;
	const first = entry('CreateGame', decision.events, decision.warnings, ctx.now());
	const log: GameLog = { entries: [first], cursor: 1 };
	return { ok: true, session: { log, game: replay(log) }, warnings: decision.warnings };
}

/**
 * Runs a command. Refused commands change nothing; accepted ones return the new session
 * and any rules warnings. A command that changes nothing adds no entry.
 */
export function dispatch(
	session: GameSession,
	command: Command,
	ctx: EngineContext
): DispatchResult {
	const decision = decide(session.game, command, ctx);
	if (!decision.ok) return decision;
	if (decision.events.length === 0) return { ok: true, session, warnings: decision.warnings };
	const entries = [
		...session.log.entries.slice(0, session.log.cursor),
		entry(command.type, decision.events, decision.warnings, ctx.now())
	];
	const game = decision.events.reduce((g, e) => applyEvent(g, e), session.game);
	return {
		ok: true,
		session: { log: { entries, cursor: entries.length }, game },
		warnings: decision.warnings
	};
}

export function canUndo(session: GameSession): boolean {
	return session.log.cursor > 1;
}

export function canRedo(session: GameSession): boolean {
	return session.log.cursor < session.log.entries.length;
}

/** Steps back one command. Creating the game cannot be undone. */
export function undo(session: GameSession): GameSession {
	if (!canUndo(session)) return session;
	const log = { ...session.log, cursor: session.log.cursor - 1 };
	return { log, game: replay(log) };
}

export function redo(session: GameSession): GameSession {
	if (!canRedo(session)) return session;
	const next = session.log.entries[session.log.cursor];
	return {
		log: { ...session.log, cursor: session.log.cursor + 1 },
		game: next.events.reduce((g, e) => applyEvent(g, e), session.game)
	};
}

/** The applied entries, oldest first, for a game history view. */
export function history(session: GameSession): readonly LogEntry[] {
	return session.log.entries.slice(0, session.log.cursor);
}

/**
 * What a room tells the admins' game history (worker/game-ledger.ts): that it opened, and each
 * game's start and finish. Split from room.ts. The room keeps the game being played in its own
 * storage and hands back a row only when that game finishes, so the table's many changes cost
 * the shared data Worker nothing; the room sends it after answering (`sendFinished`). A failed
 * call is dropped: history never gets in a game's way.
 */
import {
	ledgerSite,
	type LedgerFinish,
	type LedgerGame
} from '../src/lib/core/sync/game-ledger.ts';
import { roomPreview } from '../src/lib/core/sync/room-preview.ts';
import type { RoomState, ScriptView } from '../src/lib/core/sync/room.ts';
import { gameLedger, type GameLedgerEnv } from './game-ledger.ts';

export interface RoomLedgerEnv extends GameLedgerEnv {
	ENVIRONMENT?: string;
}

/** The game being played in this room, kept until it is sent. */
interface CurrentGame {
	id: string;
	/** The Storyteller's game id, to tell this game from the next. */
	gameId: string;
	started: number;
	/** The most phones here at once. */
	phones: number;
	/** The table and script as last published, so a game replaced by the next keeps its own. */
	players: number;
	script?: string;
	official?: boolean;
	/** Sent as ended by End game; a later finish (a new game, closing) then changes nothing. */
	over?: true;
}

const CURRENT = 'ledger-game';
const GAMES_RUN = 'games-run';

type Storage = DurableObjectStorage;

export async function noteRoomOpened(env: RoomLedgerEnv, code: string, now: number) {
	await gameLedger(env)
		?.opened({ site: ledgerSite(env.ENVIRONMENT), room: code, opened: now })
		.catch(() => {});
}

/** How many games this room has started (the admins' Live games). */
export async function gamesRun(storage: Storage): Promise<number> {
	return (await storage.get<number>(GAMES_RUN)) ?? 0;
}

/**
 * After a publish: a game id this room hasn't had starts a game, and finishes the one before it
 * as replaced by a new game unless End game already sent it. Either way the game keeps the
 * table's size and the script as they are now. Returns the finished game to send, if any.
 */
export async function notePublished(
	storage: Storage,
	env: RoomLedgerEnv,
	code: string | undefined,
	room: RoomState,
	phones: number,
	now: number
): Promise<LedgerGame | undefined> {
	if (!room.gameId) return undefined;
	let current = await storage.get<CurrentGame>(CURRENT);
	let finished: LedgerGame | undefined;
	if (current?.gameId !== room.gameId) {
		if (current && code && !current.over) {
			finished = ledgerGame(env, code, current, room, 'new-game', now);
		}
		current = { id: crypto.randomUUID(), gameId: room.gameId, started: now, phones, players: 0 };
		await storage.put(GAMES_RUN, (await gamesRun(storage)) + 1);
	}
	const preview = roomPreview(room, (await storage.get<ScriptView>('script'))?.script);
	const next: CurrentGame = { ...current, players: preview.seats ?? 0 };
	delete next.script;
	delete next.official;
	if (preview.script?.name) {
		next.script = preview.script.name;
		next.official = preview.script.official;
	}
	await storage.put(CURRENT, next);
	return finished;
}

/** Phones here now, so the game remembers the most it had. */
export async function notePhones(storage: Storage, phones: number): Promise<void> {
	const current = await storage.get<CurrentGame>(CURRENT);
	if (current && phones > current.phones) await storage.put(CURRENT, { ...current, phones });
}

/** End game: the game to send, with who won and how; again if the Storyteller ends it again. */
export async function noteGameOver(
	storage: Storage,
	env: RoomLedgerEnv,
	code: string | undefined,
	room: RoomState,
	now: number
): Promise<LedgerGame | undefined> {
	const current = await storage.get<CurrentGame>(CURRENT);
	if (!current || !code || room.ended?.gameId !== current.gameId) return undefined;
	await storage.put(CURRENT, { ...current, over: true } satisfies CurrentGame);
	return ledgerGame(env, code, current, room, 'game-over', now);
}

/**
 * The room is closing or expiring: its game, unless End game sent it, finishes that way. Read
 * before the room's storage is deleted; the row is sent after.
 */
export async function finishOnLeaving(
	storage: Storage,
	env: RoomLedgerEnv,
	code: string | undefined,
	room: RoomState | undefined,
	finish: Extract<LedgerFinish, 'closed' | 'expired'>,
	ended: number
): Promise<LedgerGame | undefined> {
	const current = await storage.get<CurrentGame>(CURRENT);
	if (!current || current.over || !code || !room) return undefined;
	return ledgerGame(env, code, current, room, finish, ended);
}

/** Sends a finished game to the admins' history. */
export async function sendFinished(env: RoomLedgerEnv, game: LedgerGame): Promise<void> {
	await gameLedger(env)
		?.record(game)
		.catch(() => {});
}

function ledgerGame(
	env: RoomLedgerEnv,
	code: string,
	current: CurrentGame,
	room: RoomState,
	finish: LedgerFinish,
	ended: number
): LedgerGame {
	const game: LedgerGame = {
		id: current.id,
		site: ledgerSite(env.ENVIRONMENT),
		room: code,
		started: current.started,
		ended: Math.max(current.started, ended),
		finish,
		players: current.players,
		phones: current.phones
	};
	if (current.script) {
		game.script = current.script;
		if (current.official !== undefined) game.official = current.official;
	}
	if (finish === 'game-over' && room.ended?.winner) {
		game.winner = room.ended.winner;
		if (room.ended.reason) game.reason = room.ended.reason;
	}
	return game;
}

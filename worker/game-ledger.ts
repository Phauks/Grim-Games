/**
 * The admins' game history (Trevor, 2026-11-12, option B): one row for each game played in a
 * live room and one for each room opened, on every site, kept in the shared data Worker
 * (worker/data-service.ts) so production and the previews land in one list. No names, no
 * characters and no grimoire: the script's name, the table's size and how it finished.
 */
import { DurableObject } from 'cloudflare:workers';
import type {
	GameHistory,
	LedgerFinish,
	LedgerGame,
	LedgerRoom,
	LedgerSite
} from '../src/lib/core/sync/game-ledger.ts';
import { remote, type DataBinding } from './shared-data.ts';

export interface GameLedgerEnv {
	DATA?: DataBinding;
}

/** The one ledger, in the shared data Worker; undefined where that Worker isn't bound. */
export function gameLedger(env: GameLedgerEnv): GameLedgerApi | undefined {
	return env.DATA ? remote<GameLedgerApi>(env.DATA, 'ledger', 'all') : undefined;
}

/** What the app Worker calls; each call goes over the service binding as plain data. */
export interface GameLedgerApi {
	opened(room: LedgerRoom): Promise<void>;
	record(game: LedgerGame): Promise<void>;
	list(since?: number): Promise<GameHistory>;
}

/** The longest a script name kept here may be. */
const MAX_SCRIPT = 120;

interface GameRow extends Record<string, SqlStorageValue> {
	id: string;
	site: string;
	room: string;
	started: number;
	ended: number;
	finish: string;
	script: string | null;
	official: number | null;
	players: number;
	phones: number;
	winner: string | null;
	reason: string | null;
}

export class GameLedger extends DurableObject implements GameLedgerApi {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS game (
				id TEXT PRIMARY KEY,
				site TEXT NOT NULL,
				room TEXT NOT NULL,
				started INTEGER NOT NULL,
				ended INTEGER NOT NULL,
				finish TEXT NOT NULL,
				script TEXT,
				official INTEGER,
				players INTEGER NOT NULL,
				phones INTEGER NOT NULL,
				winner TEXT,
				reason TEXT
			);
			CREATE INDEX IF NOT EXISTS game_ended ON game (ended);
			CREATE TABLE IF NOT EXISTS room (
				site TEXT NOT NULL,
				room TEXT NOT NULL,
				opened INTEGER NOT NULL
			);
			CREATE INDEX IF NOT EXISTS room_opened ON room (opened);
		`);
	}

	async opened(room: LedgerRoom): Promise<void> {
		this.sql.exec(
			'INSERT INTO room (site, room, opened) VALUES (?, ?, ?)',
			room.site,
			room.room,
			room.opened
		);
	}

	/** Adds a game, or replaces it when its room says it finished again (reopened, then over). */
	async record(game: LedgerGame): Promise<void> {
		this.sql.exec(
			`INSERT OR REPLACE INTO game
				(id, site, room, started, ended, finish, script, official, players, phones, winner, reason)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			game.id,
			game.site,
			game.room,
			game.started,
			game.ended,
			game.finish,
			game.script?.slice(0, MAX_SCRIPT) ?? null,
			game.official === undefined ? null : game.official ? 1 : 0,
			game.players,
			game.phones,
			game.winner ?? null,
			game.reason ?? null
		);
	}

	/** Games that ended and rooms that opened at or after `since`, newest first. */
	async list(since = 0): Promise<GameHistory> {
		const games = this.sql
			.exec<GameRow>('SELECT * FROM game WHERE ended >= ? ORDER BY ended DESC', since)
			.toArray()
			.map(readGame);
		const rooms = this.sql
			.exec<{ site: string; room: string; opened: number }>(
				'SELECT site, room, opened FROM room WHERE opened >= ? ORDER BY opened DESC',
				since
			)
			.toArray()
			.map((r): LedgerRoom => ({ site: r.site as LedgerSite, room: r.room, opened: r.opened }));
		return { games, rooms };
	}
}

function readGame(row: GameRow): LedgerGame {
	const game: LedgerGame = {
		id: row.id,
		site: row.site as LedgerSite,
		room: row.room,
		started: row.started,
		ended: row.ended,
		finish: row.finish as LedgerFinish,
		players: row.players,
		phones: row.phones
	};
	if (row.script !== null) game.script = row.script;
	if (row.official !== null) game.official = row.official === 1;
	if (row.winner === 'good' || row.winner === 'evil') game.winner = row.winner;
	if (row.reason !== null) game.reason = row.reason;
	return game;
}

/**
 * Game history for admins (Trevor, 2026-11-12, option B): each live room's games, kept in the
 * shared data Worker so production and every preview land in one list. Only what an admin needs
 * to see how the app is used: no names, no characters, no grimoire.
 */
import type { Alignment } from '#lib/core/data/types.ts';

/** The admins' game history; signed-out and other accounts get 404. */
export const GAME_HISTORY_API = '/api/admin/history';

/** Where a game ran: the production site or a preview (beta). */
export type LedgerSite = 'production' | 'preview';

/**
 * How a game stopped being played: the Storyteller's End game, a new game started over it, the
 * room closed, or the room left open until it expired.
 */
export type LedgerFinish = 'game-over' | 'new-game' | 'closed' | 'expired';

/** One game in a room, from its first publish to its finish. */
export interface LedgerGame {
	/** Made by the room; not the Storyteller's game id. */
	id: string;
	site: LedgerSite;
	room: string;
	/** Milliseconds since the epoch. */
	started: number;
	ended: number;
	finish: LedgerFinish;
	/** The script's name, once the Storyteller's device sent it. */
	script?: string;
	/** No characters of its own (an edition or a script of official characters). */
	official?: boolean;
	/** Seats at the table when it finished. */
	players: number;
	/** The most phones in the room at once. */
	phones: number;
	winner?: Alignment;
	/** `EndReason` as End game saved it. */
	reason?: string;
}

/** A room opening, for the count of rooms. */
export interface LedgerRoom {
	site: LedgerSite;
	room: string;
	opened: number;
}

export interface GameHistory {
	games: LedgerGame[];
	rooms: LedgerRoom[];
}

/** The site a Worker's ENVIRONMENT var names. */
export function ledgerSite(environment: string | undefined): LedgerSite {
	return environment === 'preview' ? 'preview' : 'production';
}

/** `GET /api/admin/history?since=<ms>`; all of it without `since`. */
export function gameHistoryPath(since: number | undefined): string {
	return since === undefined ? GAME_HISTORY_API : `${GAME_HISTORY_API}?since=${since}`;
}

/** The `since` a history request asks for, or undefined for all of it. */
export function parseSince(value: string | null): number | undefined {
	if (value === null || !/^[0-9]{1,15}$/.test(value)) return undefined;
	return Number(value);
}

export interface HistorySummary {
	games: number;
	rooms: number;
	players: number;
	/** Milliseconds, over games that ended by End game; undefined with none. */
	averageLength?: number;
	wins: Record<Alignment, number>;
}

export interface HistoryScript {
	script: string;
	games: number;
	good: number;
	evil: number;
	averageLength?: number;
}

export interface HistoryDay {
	/** The day's key, as `dayOf` gave it. */
	day: string;
	rooms: number;
	games: number;
	players: number;
	/** The most games running at the same moment that day. */
	atOnce: number;
}

export interface HistoryStats {
	summary: HistorySummary;
	scripts: HistoryScript[];
	days: HistoryDay[];
}

const average = (lengths: number[]) =>
	lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : undefined;

/** A game's length, counted only for games ended by End game (the rest just stopped). */
const playedLength = (game: LedgerGame) =>
	game.finish === 'game-over' ? Math.max(0, game.ended - game.started) : undefined;

/** The most intervals open at one moment; an end and a start at the same time don't overlap. */
function mostAtOnce(spans: { from: number; to: number }[]): number {
	const edges = spans.flatMap((s) => [
		{ at: s.from, step: 1 },
		{ at: s.to, step: -1 }
	]);
	edges.sort((a, b) => a.at - b.at || a.step - b.step);
	let open = 0;
	let most = 0;
	for (const edge of edges) {
		open += edge.step;
		most = Math.max(most, open);
	}
	return most;
}

/**
 * Totals, scripts and days for the games that ended and the rooms that opened at or after
 * `since`. `dayOf` names the day a time falls on (the page gives the viewer's own days); days
 * are listed newest first, scripts by most games.
 */
export function historyStats(
	history: GameHistory,
	since: number,
	dayOf: (at: number) => string
): HistoryStats {
	const games = history.games.filter((g) => g.ended >= since);
	const rooms = history.rooms.filter((r) => r.opened >= since);
	const lengths = games.flatMap((g) => playedLength(g) ?? []);
	const averageLength = average(lengths);
	const summary: HistorySummary = {
		games: games.length,
		rooms: rooms.length,
		players: games.reduce((sum, g) => sum + g.players, 0),
		wins: {
			good: games.filter((g) => g.winner === 'good').length,
			evil: games.filter((g) => g.winner === 'evil').length
		}
	};
	if (averageLength !== undefined) summary.averageLength = averageLength;

	const byScript = new Map<string, LedgerGame[]>();
	for (const game of games) {
		if (!game.script) continue;
		byScript.set(game.script, [...(byScript.get(game.script) ?? []), game]);
	}
	const scripts = [...byScript].map(([script, played]): HistoryScript => {
		const row: HistoryScript = {
			script,
			games: played.length,
			good: played.filter((g) => g.winner === 'good').length,
			evil: played.filter((g) => g.winner === 'evil').length
		};
		const length = average(played.flatMap((g) => playedLength(g) ?? []));
		if (length !== undefined) row.averageLength = length;
		return row;
	});
	scripts.sort((a, b) => b.games - a.games || a.script.localeCompare(b.script));

	const days = new Map<string, HistoryDay>();
	const dayRow = (day: string) => {
		let row = days.get(day);
		if (!row) days.set(day, (row = { day, rooms: 0, games: 0, players: 0, atOnce: 0 }));
		return row;
	};
	const spansByDay = new Map<string, { from: number; to: number }[]>();
	for (const room of rooms) dayRow(dayOf(room.opened)).rooms++;
	for (const game of games) {
		const day = dayOf(game.ended);
		const row = dayRow(day);
		row.games++;
		row.players += game.players;
		spansByDay.set(day, [...(spansByDay.get(day) ?? []), { from: game.started, to: game.ended }]);
	}
	for (const [day, spans] of spansByDay) dayRow(day).atOnce = mostAtOnce(spans);
	const dayList = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));

	return { summary, scripts, days: dayList };
}

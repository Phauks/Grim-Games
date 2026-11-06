/**
 * The game this device had open last, whichever way it was played (Trevor, 2026-11-06: the
 * last active game at the top of the sidebar): the newest of the games Join game lists, so
 * the two never disagree. A Storyteller's saved game still being played (newest save), a
 * room this phone joined (when it last opened it) or a players-only town (when /play last
 * showed it).
 */
import { resolve } from '$app/paths';
import type { GameId } from '#lib/core/model/index.ts';
import { scriptLogo } from '#lib/core/data/script-logo.ts';
import { formatRoomCode } from '#lib/core/sync/room-code.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { storytellerGameLine, storytellerGames } from '#lib/features/grimoire/storyteller-games.ts';
import { keptLocalTown, localTownVisits } from '#lib/features/player/local-town.svelte.ts';
import { openPlayersOnly } from '#lib/features/player/open-players-only.ts';
import {
	playersOnlyGames,
	playersOnlyLine,
	type PlayersOnlyGame
} from '#lib/features/player/players-only-games.svelte.ts';
import { recentRooms } from '#lib/features/room/recent-rooms.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

export type LastGame =
	| {
			kind: 'storyteller';
			at: number;
			gameId: GameId;
			name?: string;
			logo?: string;
			line: string;
	  }
	| { kind: 'room'; at: number; code: string; town: boolean; name?: string }
	| { kind: 'local'; at: number; game: PlayersOnlyGame };

/** The newest of each list's first game. */
export function newestGame(candidates: (LastGame | undefined)[]): LastGame | undefined {
	return candidates.reduce<LastGame | undefined>(
		(best, game) => (game && (!best || game.at > best.at) ? game : best),
		undefined
	);
}

async function storytellerCandidate(): Promise<LastGame | undefined> {
	const { all, ended } = await storytellerGames();
	const newest = all
		.filter((g) => !ended[g.gameId])
		.reduce<(typeof all)[number] | undefined>(
			(a, g) => (!a || g.savedAt > a.savedAt ? g : a),
			undefined
		);
	if (!newest) return undefined;
	return {
		kind: 'storyteller',
		at: newest.savedAt,
		gameId: newest.gameId,
		...(newest.scriptName ? { name: newest.scriptName } : {}),
		...(newest.scriptLogo ? { logo: newest.scriptLogo } : {}),
		line: storytellerGameLine(newest.gameId, newest.days, newest.seatCount)
	};
}

function roomCandidate(): LastGame | undefined {
	const room = recentRooms()[0];
	if (!room) return undefined;
	return {
		kind: 'room',
		at: room.at,
		code: room.code,
		town: !!room.town,
		...(room.script ? { name: room.script } : {})
	};
}

async function localCandidate(): Promise<LastGame | undefined> {
	// The character data is only fetched when there is a town to name.
	if (!localTownVisits().some((v) => keptLocalTown(v.key)?.seats.length)) return undefined;
	await loadOfficialData();
	const game = playersOnlyGames()[0];
	return game && { kind: 'local', at: game.visit.at, game };
}

/** Which game it is, and when it was last played: hiding lasts until it is played again. */
export function lastGameId(game: LastGame): string {
	const id =
		game.kind === 'storyteller'
			? game.gameId
			: game.kind === 'room'
				? game.code
				: game.game.visit.key;
	return `${game.kind}:${id}:${game.at}`;
}

const HIDDEN_KEY = 'grim-games:last-game-hidden';

let current = $state.raw<LastGame | undefined>();
let running: Promise<void> | undefined;

async function find(): Promise<void> {
	try {
		const [storyteller, local] = await Promise.all([storytellerCandidate(), localCandidate()]);
		const newest = newestGame([storyteller, roomCandidate(), local]);
		// Hidden from the menu (its ⋯ Hide): nothing shows until another game is played.
		current = newest && readStored(HIDDEN_KEY) === lastGameId(newest) ? undefined : newest;
	} catch (e) {
		reportError(e, { area: 'grimoire', notify: false });
	}
}

export const lastGame = {
	/** The last value found, kept while a refresh runs so the menu shows it at once. */
	get current(): LastGame | undefined {
		return current;
	},
	/** Looks again, as the lists may have changed (a game left, saved or ended). */
	refresh(): Promise<void> {
		const run = (running ??= find().finally(() => (running = undefined)));
		return run;
	},
	/** Takes it off the menu and Home until it, or another game, is played again. */
	hide(game: LastGame): void {
		writeStored(HIDDEN_KEY, lastGameId(game));
		current = undefined;
	}
};

/** Where the game opens, for a link; a players-only town opens through `openLastGame`. */
export function lastGameHref(game: LastGame): string | undefined {
	if (game.kind === 'storyteller') return resolve('/grimoire/[gameId]', { gameId: game.gameId });
	if (game.kind === 'room')
		return game.town
			? resolve('/town/[code]', { code: game.code })
			: resolve('/join/[code]', { code: game.code });
	return undefined;
}

export function openLastGame(game: LastGame): void {
	if (game.kind === 'local') void openPlayersOnly(game.game.script, game.game.source);
}

/** The card's name, logo and lines, as Join game's row for it says them. */
export function lastGameCard(
	game: LastGame,
	when: Intl.DateTimeFormat
): { name: string | undefined; logo?: string; line: string; when: string } {
	const at = when.format(game.at);
	if (game.kind === 'storyteller')
		return {
			name: game.name,
			...(game.logo ? { logo: game.logo } : {}),
			line: game.line,
			when: at
		};
	if (game.kind === 'room')
		return {
			name: game.name,
			line: formatRoomCode(game.code),
			when: game.town ? `${at} · ${t('room.town.title')}` : at
		};
	const logo = scriptLogo(game.game.script);
	return {
		name: game.game.script.name,
		...(logo ? { logo } : {}),
		line: playersOnlyLine(game.game.seats, game.game.dead),
		when: at
	};
}

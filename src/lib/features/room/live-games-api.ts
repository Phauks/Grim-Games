import { LIVE_GAMES_API, type LiveGameList } from '#lib/core/sync/live-games.ts';
import { gameHistoryPath, type GameHistory } from '#lib/core/sync/game-ledger.ts';
import { fetchWithTimeout } from '#lib/ui/fetch.ts';

/**
 * The open rooms, for an admin account (plan J31); undefined for anyone else. The session
 * cookie says who is asking; the Worker decides.
 */
export async function listLiveGames(): Promise<LiveGameList | undefined> {
	const response = await fetchWithTimeout(LIVE_GAMES_API);
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as LiveGameList;
}

/**
 * The games played in live rooms on every site since `since` (all of them without), for an
 * admin account; undefined for anyone else.
 */
export async function loadGameHistory(since?: number): Promise<GameHistory | undefined> {
	const response = await fetchWithTimeout(gameHistoryPath(since));
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as GameHistory;
}

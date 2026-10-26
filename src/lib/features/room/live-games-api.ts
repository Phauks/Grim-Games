import { LIVE_GAMES_API, type LiveGameList } from '#lib/core/sync/live-games.ts';

/**
 * The open rooms, for an admin account (plan J31); undefined for anyone else. The session
 * cookie says who is asking; the Worker decides.
 */
export async function listLiveGames(): Promise<LiveGameList | undefined> {
	const response = await fetch(LIVE_GAMES_API);
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as LiveGameList;
}

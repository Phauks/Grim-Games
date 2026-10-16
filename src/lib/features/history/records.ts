import { deriveGameRecord, type GameRecord } from '#lib/core/stats/index.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { gameStore } from '#lib/features/game/session.svelte.ts';
import { endedGames } from '#lib/features/grimoire/device-notes.ts';

/**
 * The records of the games ended on this device, worked out from their saved logs each time
 * (Trevor, 2026-10-16), so reopened and edited games are always current. A game that can no
 * longer be read is left out.
 */
export async function loadGameRecords(): Promise<GameRecord[]> {
	const [data, { games }] = await Promise.all([loadOfficialData(), gameStore().list()]);
	const ended = endedGames.read();
	const records = await Promise.all(
		games
			.filter((g) => ended[g.gameId])
			.map(async (g) => {
				const saved = await gameStore()
					.load(g.gameId)
					.catch(() => undefined);
				return saved ? deriveGameRecord(saved, ended[g.gameId], data) : undefined;
			})
	);
	return records.filter((r) => r !== undefined);
}

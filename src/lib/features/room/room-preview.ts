/**
 * Which game a typed room code opens, before the phone joins (Trevor, 2026-10-19). Asks the
 * Worker (`GET /api/room/<code>`, the code in the path, never a query string) and turns
 * what it says into what the Join game page shows.
 */
import { authorLogo, editionLogo, OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
import type { RoomPreview } from '#lib/core/sync/room.ts';

export interface GamePreview {
	name: string;
	author?: string;
	logo?: string;
	storyteller?: string;
	seats?: number;
	seated?: number;
}

/** `undefined` when no open room has the code. Throws when the Worker can't be reached. */
export async function fetchRoomPreview(
	code: string,
	signal?: AbortSignal
): Promise<GamePreview | undefined> {
	const response = await fetch(`/api/room/${code}`, { signal });
	if (!response.ok) throw new Error(`Room lookup failed: ${response.status}`);
	return toGamePreview((await response.json()) as RoomPreview);
}

export function toGamePreview(preview: RoomPreview): GamePreview | undefined {
	if (!preview.open) return undefined;
	const script = preview.script;
	const edition = script?.official
		? OFFICIAL_EDITIONS.find((e) => e.name === script.name)
		: undefined;
	const game: GamePreview = { name: script?.name ?? '' };
	if (script?.author) game.author = script.author;
	const logo = editionLogo(edition?.id) ?? authorLogo(script?.logo);
	if (logo) game.logo = logo;
	if (preview.storyteller) game.storyteller = preview.storyteller;
	if (preview.seats !== undefined) {
		game.seats = preview.seats;
		game.seated = preview.seated ?? 0;
	}
	return game;
}

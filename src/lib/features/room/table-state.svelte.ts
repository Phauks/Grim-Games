import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
import {
	publicProjection,
	type PublicCorner,
	type PublicGameState,
	type PublicSeatLayout
} from '#lib/core/sync/public-projection.ts';
import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import { forPlayers } from '#lib/features/game-settings/game-settings.ts';
import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
import { gameSheetRules } from '#lib/features/modes/sheet-rules.ts';
import { publicTravellerTest } from '#lib/features/player/travellers-in-play.ts';
import { gameSound } from '#lib/features/sound/room-sounds.ts';
import type { RoomHost } from './host.svelte.ts';
import { storytellerLook } from './storyteller-look.svelte.ts';

/**
 * The game's public state as players' phones get it now: the town, where the game is up to,
 * the day timer as players see it, the rules and game settings, the board's look, the Storyteller's own look and
 * the sounds the room plays. The room sends it, and the
 * board's Script and the grim cover's Player view draw from it too, so they show whatever
 * phones show (Trevor, 2026-10-27: "Design it so that these additions move in
 * automatically"), with or without a room.
 */
export function tableState(
	host: RoomHost,
	game: Game,
	characters: CharacterLookup,
	layout?: PublicSeatLayout,
	corner?: PublicCorner
): PublicGameState {
	const now = host.playersPhase(game.gameId);
	const state = publicProjection(
		game,
		publicTravellerTest(game.gameId, characters),
		layout,
		corner,
		characters,
		gameSheetRules(game.gameId),
		// By day, and in Town, where a sun shows set (Trevor, 2026-10-27).
		now?.kind === 'day' || now?.kind === 'town' ? liveDayTimer.forPlayers : undefined,
		now,
		host.lookOf(game.gameId).look,
		// Beside Setup, the Storyteller's choice for this game (Trevor, 2026-10-28).
		now?.kind === 'setup' ? gameSettings.of(game.gameId).setupForPlayers : undefined,
		// Played by the Public Town and phones, never by the board (Trevor, 2026-10-30).
		gameSound(now),
		// How the game runs, so players understand it (Trevor, 2026-10-30), while one is in play.
		now ? forPlayers(gameSettings.of(game.gameId)) : undefined
	);
	// The Storyteller's own avatar and laurel, as each phone shares its own (Trevor, 2026-10-30).
	const storyteller = storytellerLook(host.code);
	return storyteller ? { ...state, storyteller } : state;
}

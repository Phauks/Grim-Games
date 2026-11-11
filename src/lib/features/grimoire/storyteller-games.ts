/**
 * The games this device is storytelling, as Join game's As Storyteller lists them, and the
 * line under each one's name. Join game, the leave dialog and the menu's last game share
 * them, so all three say the same.
 */
import type { SavedGameSummary, UnreadableGame } from '#lib/core/engine/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { gamePhase } from '#lib/core/rules/game-phase.ts';
import { labGameId } from '#lib/features/character-lab/lab-store.svelte.ts';
import { gameStore } from '#lib/features/game/session.svelte.ts';
import {
	endedGames,
	gameStarts,
	nightUnderway,
	nightViews,
	type EndedGame
} from './device-notes.ts';
import { phaseText } from './phase-text.ts';

export interface StorytellerGames {
	/** Every saved game, ended ones too, without the Character Lab's own (plan M37). */
	all: SavedGameSummary[];
	unreadable: UnreadableGame[];
	ended: Record<string, EndedGame>;
}

export async function storytellerGames(): Promise<StorytellerGames> {
	const { games, unreadable } = await gameStore().list();
	const lab = labGameId();
	return { all: games.filter((g) => g.gameId !== lab), unreadable, ended: endedGames.read() };
}

/** Where a game is up to: the board's phase (gamePhase), so the list and the board agree. */
export function gameStageText(gameId: GameId, days: number, ended: boolean): string {
	const phase = gamePhase(days, {
		begun: gameStarts.read(gameId) !== undefined,
		nightUnderway: nightUnderway(nightViews.read(gameId), days, ended)
	});
	return phase.kind === 'setup' ? 'Setting up' : phaseText(phase);
}

/** "Day 2 · 8 seats": a game's stage and seats, as its row says them. */
export function storytellerGameLine(gameId: GameId, days: number, seats: number): string {
	return `${gameStageText(gameId, days, false)} · ${seats} seats`;
}

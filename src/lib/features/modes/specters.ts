import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';

/** Whether the game's mode gives spectators a vote (Specters), for a link from its board. */
export function hasSpectatorVote(gameId: GameId): boolean {
	const record = readGameMode(gameId);
	const mode = record && findMode(record.modeId);
	return mode?.parts.daySteps?.some((s) => s.kind === 'spectator-vote') === true;
}

/**
 * What the spectators' shared ability is this game, set by the Storyteller (Trevor,
 * 2026-10-18: "It may be a characters ability for a night, or it may be something totally
 * custom"). Kept on this device beside the game, versioned key; unset reads as the mode's
 * own (Apparition grants the Wizard).
 */
export type SpecterAbility =
	| { kind: 'character'; characterId: CharacterId }
	| { kind: 'custom'; text: string };

const ABILITY_KEY = (gameId: GameId) => `grim-games:specters-ability:v1:${gameId}`;

export function readSpecterAbility(gameId: GameId): SpecterAbility | undefined {
	const raw = readStored(ABILITY_KEY(gameId));
	if (!raw || typeof raw !== 'object') return undefined;
	const r = raw as Record<string, unknown>;
	if (r.kind === 'character' && typeof r.characterId === 'string')
		return { kind: 'character', characterId: r.characterId };
	if (r.kind === 'custom' && typeof r.text === 'string') return { kind: 'custom', text: r.text };
	return undefined;
}

export function writeSpecterAbility(gameId: GameId, ability: SpecterAbility): void {
	writeStored(ABILITY_KEY(gameId), ability);
}

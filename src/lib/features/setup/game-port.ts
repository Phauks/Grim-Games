/**
 * What the setup screens need from the game in progress. The grimoire's game session store
 * provides it; setup only sends ordinary engine commands, so a confirmed draw lands on its
 * seat through the engine's own events and the grimoire just re-renders.
 */
import type { Command, EngineError, EngineWarning } from '#lib/core/engine/index.ts';
import type { CharacterLookup, Game } from '#lib/core/model/index.ts';

export type PortResult =
	{ ok: true; warnings: EngineWarning[] } | { ok: false; error: EngineError };

export interface SetupGamePort {
	/** The open game, or undefined while it loads. */
	readonly game: Game | undefined;
	/** Characters for the game (official plus its script's homebrew). */
	readonly lookup: CharacterLookup | undefined;
	dispatch(command: Command): PortResult;
	/** Resolves once every change so far is saved (before going to another page). */
	flush(): Promise<void>;
}

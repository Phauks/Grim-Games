/**
 * What the engine needs from outside to turn a command into events. Ids, time and
 * randomness are injected so tests (and replays) are deterministic; the outcomes are
 * written into the events, so the reducer never needs them.
 */
import type { CharacterLookup } from '#lib/core/model/index.ts';

export interface EngineContext {
	characters: CharacterLookup;
	newId(): string;
	/** Milliseconds since the epoch. */
	now(): number;
	/** A number in [0, 1), like `Math.random`. */
	random(): number;
}

/** The real clock, random UUIDs and `Math.random`. */
export function systemContext(characters: CharacterLookup): EngineContext {
	return {
		characters,
		newId: () => crypto.randomUUID(),
		now: () => Date.now(),
		random: Math.random
	};
}

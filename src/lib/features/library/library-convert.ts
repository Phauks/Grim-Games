/**
 * Changing what kind of item something in the Library is (Trevor, 2026-10-18: "allow changing
 * type of file ... but note if being changed to incompatible format"). Every change is allowed
 * when there is something to change into; what won't carry over is said first, never refused.
 */
import type { Character } from '#lib/core/data/index.ts';
import type { ItemKind } from './library-items.ts';

/** What the item holds, enough to say what a change keeps. */
export interface ConvertSource {
	kind: ItemKind;
	name: string;
	/** Every character on it, in order. */
	characters: readonly Character[];
	/** Of those, the ones defined by the item itself (homebrew). */
	homebrew: readonly Character[];
	/** A script with details beyond its name (author, logo, almanac, ...). */
	details?: boolean;
}

export type ConvertLoss =
	{ kind: 'details' } | { kind: 'others'; count: number } | { kind: 'kept-character' };

export type ConvertPlan =
	| { possible: true; losses: ConvertLoss[] }
	| { possible: false; reason: 'no-characters' | 'no-homebrew' };

/** The kinds an item can change into: every other kind. */
export function otherKinds(kind: ItemKind): ItemKind[] {
	return (['script', 'character', 'collection'] as const).filter((k) => k !== kind);
}

export function convertPlan(source: ConvertSource, to: ItemKind): ConvertPlan {
	const losses: ConvertLoss[] = [];
	if (source.kind === 'script' && source.details) losses.push({ kind: 'details' });
	if (to === 'character') {
		// A script's character must be its own: an official one is already in the game.
		const pool = source.kind === 'script' ? source.homebrew : source.characters;
		if (pool.length === 0) {
			return {
				possible: false,
				reason: source.kind === 'script' ? 'no-homebrew' : 'no-characters'
			};
		}
		if (source.characters.length > 1) {
			losses.push({ kind: 'others', count: source.characters.length - 1 });
		}
	}
	// A collection holds the character itself, so it stays in the Library.
	if (source.kind === 'character' && to === 'collection') losses.push({ kind: 'kept-character' });
	return { possible: true, losses };
}

/** The character a change into a character keeps: a script's first homebrew, else the first. */
export function keptCharacter(source: ConvertSource): Character | undefined {
	return source.kind === 'script' ? source.homebrew[0] : source.characters[0];
}

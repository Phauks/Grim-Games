import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { customModes } from './custom-modes.svelte.ts';
import { customRules } from './custom-rules.svelte.ts';

/**
 * Whether a mode's own wording (its description, its Storyteller instructions) shows as it
 * is: a file someone added is their own wording, and our own wording setting shows a built-in
 * one's. Otherwise each built-in text waits for Trevor's approval (approved-about.ts).
 */
export function showsOwnWording(mode: GameMode | SpecialRule): boolean {
	return (
		(mode.kind === 'special-rule' ? customRules.list : customModes.list).some(
			(m) => m.id === mode.id
		) || preferences.current.ownWording
	);
}

import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { customModes } from './custom-modes.svelte.ts';
import { aboutApproved } from './approved-about.ts';
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

/** A mode's or rule's description where it may show: approved, its own file's, or our own wording on. */
export function shownAbout(mode: GameMode | SpecialRule): string | undefined {
	return showsOwnWording(mode) || aboutApproved(mode.id, mode.about) ? mode.about : undefined;
}

/**
 * Editing the night order by hand: each change is one command on the game's night-order
 * overrides (core `NightStepOverride`), so it is one History entry. Changes made on the
 * First night tab apply to the first night only, and the same for Other nights.
 */
import type { Command } from '#lib/core/engine/index.ts';
import type { Night, NightStep, NightStepOverride } from '#lib/core/rules/index.ts';

type Kind = NightStepOverride['kind'];

/** Where this night's override of `kind` for step `id` is, or -1. */
function find(overrides: readonly NightStepOverride[], night: Night, kind: Kind, id: string) {
	return overrides.findIndex((o) => o.kind === kind && o.id === id && o.night === night);
}

/** Adds an override, or replaces this night's one of the same kind for the same step. */
function put(overrides: readonly NightStepOverride[], override: NightStepOverride): Command {
	const index = find(overrides, override.night!, override.kind, override.id);
	return index >= 0
		? { type: 'ReplaceNightStepOverride', index, override }
		: { type: 'AddNightStepOverride', override };
}

/** The step the Storyteller added on this night, if `id` is one. */
function added(overrides: readonly NightStepOverride[], night: Night, id: string) {
	const index = find(overrides, night, 'add', id);
	return index >= 0
		? { index, override: overrides[index] as NightStepOverride & { kind: 'add' } }
		: undefined;
}

/** Moves the step at `index` one place up (-1) or down (1); undefined at either end. */
export function moveStep(
	steps: readonly NightStep[],
	overrides: readonly NightStepOverride[],
	night: Night,
	index: number,
	by: -1 | 1
): Command | undefined {
	const step = steps[index];
	const target = index + by;
	if (!step || target < 0 || target >= steps.length) return undefined;
	// The step it will follow: two up when moving up, the next one when moving down.
	const after = by === -1 ? (steps[index - 2]?.id ?? null) : steps[index + 1].id;
	const own = added(overrides, night, step.id);
	if (own) {
		return {
			type: 'ReplaceNightStepOverride',
			index: own.index,
			override: { ...own.override, after }
		};
	}
	return put(overrides, { kind: 'move', id: step.id, after, night });
}

/** New text for a step (a step the Storyteller added keeps its title). */
export function editStep(
	overrides: readonly NightStepOverride[],
	night: Night,
	id: string,
	text: string
): Command {
	const own = added(overrides, night, id);
	if (own) {
		return {
			type: 'ReplaceNightStepOverride',
			index: own.index,
			override: { ...own.override, text }
		};
	}
	return put(overrides, { kind: 'edit', id, text, night });
}

/** Skips a step on this night; a step the Storyteller added is removed instead. */
export function skipStep(
	overrides: readonly NightStepOverride[],
	night: Night,
	id: string
): Command {
	const own = added(overrides, night, id);
	if (own) return { type: 'RemoveNightStepOverride', index: own.index };
	return { type: 'AddNightStepOverride', override: { kind: 'hide', id, night } };
}

/** The steps skipped on this night, with the override that skips each (to restore it). */
export function skippedSteps(
	overrides: readonly NightStepOverride[],
	night: Night
): { id: string; index: number }[] {
	return overrides.flatMap((o, index) =>
		o.kind === 'hide' && o.night === night ? [{ id: o.id, index }] : []
	);
}

/** Puts a skipped step back. */
export function restoreStep(index: number): Command {
	return { type: 'RemoveNightStepOverride', index };
}

/** A step of the Storyteller's own, after the step `after` (null: first). */
export function addStep(
	night: Night,
	after: string | null,
	title: string,
	text: string,
	id: string
): Command {
	const override: NightStepOverride = { kind: 'add', id, text, after, night };
	if (title.trim()) override.title = title.trim();
	return { type: 'AddNightStepOverride', override };
}

/** Whether a step was added by the Storyteller on this night. */
export function isOwnStep(overrides: readonly NightStepOverride[], night: Night, id: string) {
	return find(overrides, night, 'add', id) >= 0;
}

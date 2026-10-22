/**
 * A character's rules as data: one `rules` block per character (Trevor, 2026-10-22, plan B;
 * behaviours with parameters, option 1). Official characters get theirs from our overlay file
 * `rules/<id>.json`, because TPI's `roles.json` stays untouched; a custom character
 * carries the same block as `rules` in its own script entry. Both are read by
 * `parseCharacterRules`, so a custom character can do anything an official one can.
 *
 * Each key is one behaviour the rules code knows, and names no character. The tables still in
 * TypeScript move here one per PR (the list is in docs/shared-components.md).
 * Design: /mnt/project-files/character-changes/option-1-parameters-spike.md.
 */
import type { ReminderLabel } from './types.ts';
import { describe, isObject, type Issues } from './validate.ts';

/** The question placing a reminder asks: mark the living seat dead, or revive a dead one. */
export const REMINDER_PROMPTS = ['markDead', 'revive'] as const;
export type ReminderPrompt = (typeof REMINDER_PROMPTS)[number];

export interface CharacterRules {
	/** Reminders whose placing is the moment to change the seat's state, by label. */
	reminderPrompts?: Readonly<Record<ReminderLabel, ReminderPrompt>>;
}

/** Every key a rules block may have; one more per migrated table. */
export const RULE_KEYS = ['reminderPrompts'] as const satisfies readonly (keyof CharacterRules)[];

/**
 * Reads a rules block, recording each problem in `issues` with its path. `reminders`, when
 * given, are the character's own reminder labels: a rule about a reminder it lacks is an error.
 * Our overlay files are checked against `roles.json` by their tests instead.
 */
export function parseCharacterRules(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders?: readonly ReminderLabel[]
): CharacterRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const before = issues.list.length;
	const rules: CharacterRules = {};
	for (const key of Object.keys(raw)) {
		if (!(RULE_KEYS as readonly string[]).includes(key))
			issues.add(`${path}.${key}`, 'unknown rule');
	}
	if (raw.reminderPrompts !== undefined) {
		const prompts = readPrompts(raw.reminderPrompts, `${path}.reminderPrompts`, issues, reminders);
		if (prompts) rules.reminderPrompts = prompts;
	}
	return issues.list.length > before ? undefined : rules;
}

function readPrompts(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Record<ReminderLabel, ReminderPrompt> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const own = reminders && new Set(reminders.map((r) => r.toLowerCase()));
	const out: Record<ReminderLabel, ReminderPrompt> = {};
	for (const [label, prompt] of Object.entries(raw)) {
		if (own && !own.has(label.toLowerCase())) {
			issues.add(`${path}.${label}`, 'not one of this character’s reminders');
		} else if (!(REMINDER_PROMPTS as readonly unknown[]).includes(prompt)) {
			issues.add(`${path}.${label}`, `unknown prompt ${JSON.stringify(prompt)}`);
		} else out[label] = prompt as ReminderPrompt;
	}
	return out;
}

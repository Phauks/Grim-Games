/**
 * A character's rules as data: one `rules` block per character (Trevor, 2026-10-22, plan B;
 * behaviours with parameters, option 1). Official characters get theirs from our overlay file
 * `rules/<id>.json`, because TPI's `roles.json` stays untouched; a custom character
 * carries the same block as `rules` in its own script entry. Both are read by
 * `parseCharacterRules`, so a custom character can do anything an official one can.
 *
 * Each key is one part (`parts/`): a behaviour the rules code knows, which names no character.
 * The block's type and reader are built from the part list in `parts/index.ts`. The tables
 * still in TypeScript move here one per PR (the list is in docs/shared-components.md).
 * Design: /mnt/project-files/character-changes/option-1-parameters-spike.md.
 */
import * as PARTS from './parts/index.ts';
import type { PartValue, Reminders } from './parts/part.ts';
import { describe, isObject, type Issues } from './validate.ts';

export type { ReminderPrompt } from './parts/reminder-prompts.ts';
export type { KilledBy } from './parts/on-death.ts';
export type { NominatedEffect } from './parts/on-nominated.ts';
export type { DayClaim } from './parts/day-claim.ts';
export type { DayUse, DayUseAnswer, DayUseWho } from './parts/day-use.ts';
export type { DeathCheckKind, DeathCheckRule } from './parts/death-check.ts';
export type { Kills } from './parts/kills.ts';
export { PROTECTS_FROM, type Protects } from './parts/protects.ts';
export type { ShownTo } from './parts/shown-to.ts';
export type { Registers, RegistersAs, TokenRegisters } from './registers-as-rules.ts';
export type { ImpairmentReason, Impairs, TokenImpairment } from './impairs-rules.ts';
export type { Answers, Learns } from './night-info-rules.ts';

type PartKey = keyof typeof PARTS;

/** Every part, each one optional, as its reader returns it. */
export type PartRules = { [K in PartKey]?: PartValue<(typeof PARTS)[K]> };

export interface CharacterRules extends PartRules {
	/**
	 * The character's optional rule from its wiki page (Trevor, 2026-10-30: an official
	 * character's optional rule is its own functionality, chosen at the start of the game): the
	 * rules that replace this block's own, key by key, in a game that turns it on
	 * (`rulesIn`, `Game.optionalRules`). Never nested.
	 */
	optionalRule?: CharacterRules;
}

const PART_KEYS = Object.keys(PARTS).sort() as PartKey[];

/**
 * Reads a rules block, recording each problem in `issues` with its path. `reminders`, when
 * given, are the character's own reminder labels: a rule about a reminder it lacks is an error.
 * Our overlay files are checked against `roles.json` by their tests instead.
 */
export function parseCharacterRules(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders?: Reminders
): CharacterRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const before = issues.list.length;
	const rules: Record<string, unknown> = {};
	for (const key of Object.keys(raw)) {
		if (key !== 'optionalRule' && !(key in PARTS)) issues.add(`${path}.${key}`, 'unknown rule');
	}
	for (const key of PART_KEYS) {
		if (raw[key] === undefined) continue;
		const value = PARTS[key].read(raw, key, path, issues, reminders);
		if (value !== undefined) rules[key] = value;
	}
	if (raw.optionalRule !== undefined) {
		const at = `${path}.optionalRule`;
		if (isObject(raw.optionalRule) && raw.optionalRule.optionalRule !== undefined)
			issues.add(`${at}.optionalRule`, 'an optional rule has no optional rule of its own');
		else {
			const optional = parseCharacterRules(raw.optionalRule, at, issues, reminders);
			if (optional) rules.optionalRule = optional;
		}
	}
	return issues.list.length > before ? undefined : (rules as CharacterRules);
}

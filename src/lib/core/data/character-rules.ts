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
import { CHARACTER_TYPES, type CharacterType, type ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readString,
	type Issues
} from './validate.ts';

/** The question placing a reminder asks: mark the living seat dead, or revive a dead one. */
export const REMINDER_PROMPTS = ['markDead', 'revive'] as const;
export type ReminderPrompt = (typeof REMINDER_PROMPTS)[number];

/** Who did the killing: the Demon's kill, another ability's, or either. */
export const KILLED_BY = ['demon', 'other', 'any'] as const;
export type KilledBy = (typeof KILLED_BY)[number];

/** What being nominated sets off: the nominator is executed straight away. */
export const NOMINATED_EFFECTS = ['execute-nominator'] as const;
export type NominatedEffect = (typeof NOMINATED_EFFECTS)[number];

export interface CharacterRules {
	/** Reminders whose placing is the moment to change the seat's state, by label. */
	reminderPrompts?: Readonly<Record<ReminderLabel, ReminderPrompt>>;
	/**
	 * The ability still acts once its player is dead: it triggers on their death ("When you
	 * die", "If you died today or tonight") or works "even if dead". Its reminders stay with
	 * the living ones in the reminder bank.
	 */
	actsWhenDead?: boolean;
	/** The ability is set off by its player's death, by `by` (the Ravenkeeper, the Sage). */
	onDeath?: { by: KilledBy };
	/**
	 * The ability stops a death: its own player's (`self`, the Soldier) or the player marked
	 * with its `token` (the Monk's "Safe"), against the Demon's kill only or any kill.
	 */
	protects?: Protects;
	/**
	 * The first time its player is nominated by a `by` character, `effect` happens (the
	 * Virgin). Once used, the character's "No Ability" reminder marks it spent.
	 */
	onNominated?: { by: CharacterType; effect: NominatedEffect };
}

export const PROTECTS_WHO = ['self', 'marked'] as const;
export const PROTECTS_FROM = ['demon', 'any'] as const;
export type Protects =
	| { who: 'self'; from: (typeof PROTECTS_FROM)[number] }
	| { who: 'marked'; token: ReminderLabel; from: (typeof PROTECTS_FROM)[number] };

/** Every key a rules block may have; one more per migrated table. */
export const RULE_KEYS = [
	'reminderPrompts',
	'actsWhenDead',
	'onDeath',
	'protects',
	'onNominated'
] as const satisfies readonly (keyof CharacterRules)[];

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
	const actsWhenDead = readBoolean(raw, 'actsWhenDead', path, issues);
	if (actsWhenDead !== undefined) rules.actsWhenDead = actsWhenDead;
	if (raw.onDeath !== undefined) {
		if (!isObject(raw.onDeath)) {
			issues.add(`${path}.onDeath`, `expected object, got ${describe(raw.onDeath)}`);
		} else {
			checkKeys(raw.onDeath, ['by'], `${path}.onDeath`, issues);
			const by = readEnum(raw.onDeath, 'by', KILLED_BY, `${path}.onDeath`, issues, true);
			if (by) rules.onDeath = { by };
		}
	}
	if (raw.protects !== undefined) {
		const protects = readProtects(raw.protects, `${path}.protects`, issues, reminders);
		if (protects) rules.protects = protects;
	}
	if (raw.onNominated !== undefined) {
		const at = `${path}.onNominated`;
		if (!isObject(raw.onNominated)) {
			issues.add(at, `expected object, got ${describe(raw.onNominated)}`);
		} else {
			checkKeys(raw.onNominated, ['by', 'effect'], at, issues);
			const by = readEnum(raw.onNominated, 'by', CHARACTER_TYPES, at, issues, true);
			const effect = readEnum(raw.onNominated, 'effect', NOMINATED_EFFECTS, at, issues, true);
			if (by && effect) rules.onNominated = { by, effect };
		}
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

function readProtects(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Protects | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['who', 'token', 'from'], path, issues);
	const who = readEnum(raw, 'who', PROTECTS_WHO, path, issues, true);
	const from = readEnum(raw, 'from', PROTECTS_FROM, path, issues, true);
	if (!who || !from) return undefined;
	if (who === 'self') {
		if (raw.token !== undefined) issues.add(`${path}.token`, 'only a marked player has a token');
		return { who, from };
	}
	const token = readString(raw, 'token', path, issues, true);
	if (token === undefined) return undefined;
	if (reminders && !reminders.some((r) => r.toLowerCase() === token.toLowerCase())) {
		issues.add(`${path}.token`, 'not one of this character’s reminders');
		return undefined;
	}
	return { who, token, from };
}

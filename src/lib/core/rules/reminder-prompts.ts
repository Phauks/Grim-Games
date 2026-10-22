/**
 * Reminders whose placing is the moment to change a player's state, so the board asks
 * (Trevor, 2026-10-19). Each character's own rules block says which of its reminders ask
 * which question (`reminderPrompts` in `data/rules/<id>.json`, or a custom character's
 * `rules`); a new one is a line there, not new code.
 *
 * "Dead" (the Imp's and most Demons') and "Died Today" (the Undertaker's, Godfather's) record
 * a death; the Professor's and Shabaloth's "Alive" marks a dead player brought back. Ones that
 * only threaten a death ("About To Die") or prevent one ("Cannot Die") never ask.
 */
import type { CharacterRules, ReminderPrompt } from '#lib/core/data/character-rules.ts';
import { OFFICIAL_RULES, rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';

export type { ReminderPrompt } from '#lib/core/data/character-rules.ts';

export interface ReminderPromptRule {
	/** The reminder's words, as the character data has them (any case). */
	label: string;
	prompt: ReminderPrompt;
	/** Characters with this reminder; the tests check each one has it. */
	characters: readonly string[];
}

/** The official characters' prompts, one entry per label, built from their rules files. */
export const REMINDER_PROMPTS: readonly ReminderPromptRule[] = (() => {
	const byLabel = new Map<string, ReminderPromptRule & { characters: string[] }>();
	for (const [id, rules] of OFFICIAL_RULES) {
		for (const [label, prompt] of Object.entries(rules.reminderPrompts ?? {})) {
			const rule = byLabel.get(label) ?? { label, prompt, characters: [] };
			rule.characters.push(id);
			byLabel.set(label, rule);
		}
	}
	return [...byLabel.values()];
})();

const BY_LABEL = new Map(REMINDER_PROMPTS.map((rule) => [rule.label.toLowerCase(), rule.prompt]));

/**
 * The question placing this reminder asks, if any. With the reminder's character, that
 * character's own rules block decides first, so a custom character's reminders can ask too.
 */
export function reminderPrompt(
	label: string,
	characterId?: CharacterId,
	characters?: ReadonlyMap<CharacterId, { rules?: CharacterRules }>
): ReminderPrompt | undefined {
	const key = label.trim().toLowerCase();
	const own = characterId ? rulesOf(characterId, characters)?.reminderPrompts : undefined;
	const mine = own && Object.entries(own).find(([l]) => l.toLowerCase() === key)?.[1];
	return mine ?? BY_LABEL.get(key);
}

/** Whether the prompt applies to a seat in this state: mark the living dead, revive the dead. */
export function promptApplies(prompt: ReminderPrompt, dead: boolean): boolean {
	return prompt === 'markDead' ? !dead : dead;
}

/** A reminder that records a death ("Dead", "Died Today"). */
export function marksDeath(label: string): boolean {
	return reminderPrompt(label) === 'markDead';
}

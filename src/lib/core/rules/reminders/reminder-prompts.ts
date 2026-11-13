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
import type { ReminderPrompt } from '#lib/core/data/character-rules.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game } from '#lib/core/model/types.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

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
 * The question placing this reminder asks, if any. A character's reminder asks what its own
 * rules block says (`reminderPrompts`), official or custom alike, and never borrows another
 * character's prompt by its words. A reminder with no character (a generic token) asks what an
 * official reminder with the same words does.
 */
export function reminderPrompt(
	game: Game,
	label: string,
	characterId: CharacterId | undefined,
	characters: CharacterLookup
): ReminderPrompt | undefined {
	const key = label.trim().toLowerCase();
	if (characterId === undefined) return BY_LABEL.get(key);
	const own = rulesFor(game, characterId, characters)?.reminderPrompts;
	return own && Object.entries(own).find(([l]) => l.toLowerCase() === key)?.[1];
}

/** Whether the prompt applies to a seat in this state: mark the living dead, revive the dead. */
export function promptApplies(prompt: ReminderPrompt, dead: boolean): boolean {
	return prompt === 'markDead' ? !dead : dead;
}

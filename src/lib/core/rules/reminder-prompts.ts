/**
 * Reminders whose placing is the moment to change a player's state, so the board asks
 * (Trevor, 2026-10-19). Each entry says which reminder words ask, which question, and the
 * characters whose reminders carry those words; a new one is a line here, not new code.
 */
export type ReminderPrompt = 'markDead' | 'revive';

export interface ReminderPromptRule {
	/** The reminder's words, as the character data has them (any case). */
	label: string;
	prompt: ReminderPrompt;
	/** Characters with this reminder; the tests check each one has it. */
	characters: readonly string[];
}

export const REMINDER_PROMPTS: readonly ReminderPromptRule[] = [
	// "Dead" (the Imp's and most Demons') and "Died Today" (the Undertaker's, Godfather's)
	// record a death. Ones that only threaten a death ("About To Die") or prevent one
	// ("Cannot Die") never ask.
	{ label: 'Dead', prompt: 'markDead', characters: ['imp', 'gossip', 'tinker'] },
	{ label: 'Died Today', prompt: 'markDead', characters: ['undertaker', 'godfather', 'zombuul'] },
	// The Professor's and Shabaloth's "Alive" marks a dead player brought back.
	{ label: 'Alive', prompt: 'revive', characters: ['professor', 'shabaloth'] }
];

const BY_LABEL = new Map(REMINDER_PROMPTS.map((rule) => [rule.label.toLowerCase(), rule.prompt]));

/** The question placing this reminder asks, if any. */
export function reminderPrompt(label: string): ReminderPrompt | undefined {
	return BY_LABEL.get(label.trim().toLowerCase());
}

/** Whether the prompt applies to a seat in this state: mark the living dead, revive the dead. */
export function promptApplies(prompt: ReminderPrompt, dead: boolean): boolean {
	return prompt === 'markDead' ? !dead : dead;
}

/** A reminder that records a death ("Dead", "Died Today"). */
export function marksDeath(label: string): boolean {
	return reminderPrompt(label) === 'markDead';
}

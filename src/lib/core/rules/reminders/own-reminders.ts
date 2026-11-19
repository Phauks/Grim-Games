/**
 * A character's own reminder tokens, without the stand-ins for the abilities it gives
 * (`givesAbility.standIns`: the Hermit's 1, 2 and 3, https://wiki.bloodontheclocktower.com/Hermit).
 * The app gives each holder its own copies of the real tokens instead (M68), so the stand-ins
 * are never listed, counted or offered (Trevor, 2026-11-19: "remove the hermit tokens").
 */
import type { Character, ReminderLabel } from '#lib/core/data/types.ts';

type WithReminders = Pick<Character, 'reminders' | 'remindersGlobal' | 'rules'>;

/** Whether `label` stands in for a given ability's token, never one of its own. */
export function isStandIn(character: Pick<Character, 'rules'>, label: ReminderLabel): boolean {
	return character.rules?.givesAbility?.standIns?.includes(label) ?? false;
}

/** The character's own reminders and global reminders, stand-ins left out. */
export function ownReminders(character: WithReminders): {
	reminders: ReminderLabel[];
	remindersGlobal: ReminderLabel[];
} {
	const own = (labels: readonly ReminderLabel[]) => labels.filter((l) => !isStandIn(character, l));
	return { reminders: own(character.reminders), remindersGlobal: own(character.remindersGlobal) };
}

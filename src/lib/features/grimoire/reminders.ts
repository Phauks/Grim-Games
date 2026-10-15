/**
 * What the reminders picker offers (Pocket Grimoire parity: script-filtered list, show all,
 * add several, recent reminders). Reminder tokens come from TPI's data: a character's
 * `reminders` while it is in play, and its `remindersGlobal` whenever it is on the script.
 */
import type { Character } from '#lib/core/data/index.ts';
import {
	charactersInPlay,
	scriptCharacterIds,
	type CharacterLookup,
	type Game,
	type Reminder
} from '#lib/core/model/index.ts';

export interface ReminderGroup {
	character: Character;
	/** Distinct labels, in TPI's order. */
	labels: string[];
}

function unique(labels: readonly string[]): string[] {
	return [...new Set(labels)];
}

/**
 * Reminder groups for a game. By default: characters in play (seats, Fabled and Loric) with
 * all their reminders, then characters on the script that are not in play with only their
 * global reminders. With `all`, every character on the script or in play offers all of its
 * reminders. Characters with nothing to offer are left out.
 */
export function reminderGroups(
	game: Game,
	characters: CharacterLookup,
	all: boolean
): ReminderGroup[] {
	const inPlay = [...new Set([...charactersInPlay(game), ...game.ruleCharacters])];
	const onScript = scriptCharacterIds(game.script).filter((id) => !inPlay.includes(id));
	const groups: ReminderGroup[] = [];
	for (const id of [...inPlay, ...onScript]) {
		const character = characters.get(id);
		if (!character) continue;
		const labels =
			all || inPlay.includes(id)
				? unique([...character.reminders, ...character.remindersGlobal])
				: unique(character.remindersGlobal);
		if (labels.length > 0) groups.push({ character, labels });
	}
	return groups;
}

/** A reminder as a stable key, for the recent list. */
export function reminderKey(reminder: Reminder): string {
	return JSON.stringify([reminder.characterId, reminder.label]);
}

export function parseReminderKey(key: string): Reminder | undefined {
	try {
		const raw: unknown = JSON.parse(key);
		if (Array.isArray(raw) && typeof raw[0] === 'string' && typeof raw[1] === 'string')
			return { characterId: raw[0], label: raw[1] };
	} catch {
		// An unreadable entry is skipped.
	}
	return undefined;
}

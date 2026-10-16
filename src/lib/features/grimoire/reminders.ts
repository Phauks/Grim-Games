/**
 * What the reminders picker offers: reminders of characters in play, several at a time,
 * with recent reminders first. Reminder tokens come from TPI's data: a character's
 * `reminders` while it is in play, and its `remindersGlobal` whenever it is on the script.
 */
import type { Character } from '#lib/core/data/index.ts';
import { gainedAbilities } from '#lib/core/rules/index.ts';
import {
	charactersInPlay,
	scriptCharacterIds,
	trueCharacter,
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
 * Reminder groups for a game: only characters in play offer reminders. In play means a
 * token on a seat, a seat's true character (the Drunk, Marionette, Philosopher or Alchemist
 * marked by its "Is The …" reminder), the Fabled and Loric, and an ability a seat has
 * gained (the Pixie's Townsfolk). One exception: a script character's global reminders are
 * always offered, because "Is The Drunk" and the like are how the Storyteller marks a
 * character that is in play but hidden under another token.
 */
export function reminderGroups(game: Game, characters: CharacterLookup): ReminderGroup[] {
	const inPlay = [
		...new Set([
			...charactersInPlay(game),
			...game.seating.flatMap((seatId) => trueCharacter(game, seatId, characters) ?? []),
			...game.ruleCharacters,
			...gainedAbilities(game).map((gained) => gained.characterId)
		])
	];
	const onScript = scriptCharacterIds(game.script).filter((id) => !inPlay.includes(id));
	const groups: ReminderGroup[] = [];
	for (const id of [...inPlay, ...onScript]) {
		const character = characters.get(id);
		if (!character) continue;
		const labels = inPlay.includes(id)
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

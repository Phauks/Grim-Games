/**
 * Character data for a game: every official character plus the homebrew characters its
 * script defines. Selectors and command validation read characters through this lookup,
 * so the game state itself only stores ids.
 */
import type { Character, CharacterId, GameData, Script } from '#lib/core/data/index.ts';
import { BOOTLEGGER, bootleggerWithRules, scriptRules } from '#lib/core/rules/script-rules.ts';

export type CharacterLookup = ReadonlyMap<CharacterId, Character>;

/**
 * All official characters (Travellers, Fabled and Loric can join any game) plus the
 * script's homebrew characters, which win over an official character with the same id.
 * The Bootlegger's ability is the script's rules when it has any.
 */
export function characterLookup(
	data: Pick<GameData, 'characters'>,
	script: Script
): CharacterLookup {
	const map = new Map<CharacterId, Character>(data.characters.map((c) => [c.id, c]));
	for (const entry of script.entries) {
		if (entry.kind === 'custom') map.set(entry.character.id, entry.character);
	}
	// The Bootlegger shows the script's own rules (script-rules.ts).
	const bootlegger = map.get(BOOTLEGGER);
	if (bootlegger) map.set(BOOTLEGGER, bootleggerWithRules(bootlegger, scriptRules(script.meta)));
	return map;
}

/** The ids of the characters on a script, in script order. */
export function scriptCharacterIds(script: Script): CharacterId[] {
	return script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id));
}

export function isOnScript(script: Script, id: CharacterId): boolean {
	return script.entries.some((e) => (e.kind === 'official' ? e.id : e.character.id) === id);
}

/** Whether a reminder label is one of the character's reminder tokens (local or global). */
export function isKnownReminder(character: Character, label: string): boolean {
	return character.reminders.includes(label) || character.remindersGlobal.includes(label);
}

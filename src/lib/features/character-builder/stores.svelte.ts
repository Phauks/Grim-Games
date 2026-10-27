import { readParsed, writeStored } from '#lib/ui/stored.ts';
import type { CharacterFields } from '#lib/core/rules/character-builder.ts';
import { characterEntry } from '#lib/core/rules/character-builder.ts';
import { emptyCharacterDraft, parseCharacterDraft, type CharacterDraft } from './draft.ts';
import {
	parseSavedCharacters,
	SAVED_CHARACTERS_VERSION,
	type SavedCharacter
} from './saved-characters.ts';

const CHARACTER_DRAFT_KEY = 'grim-games:character-builder';
const SAVED_CHARACTERS_KEY = 'grim-games:characters';

/**
 * A character being built. The Character builder page keeps its draft on this device on every
 * change; the builder opened over another page (a modal) keeps one only while it is open.
 */
export class CharacterBuilderDraft {
	#key: string | undefined;
	#draft = $state<CharacterDraft>(emptyCharacterDraft());

	/** With a storage key, read from and saved to the device; without, starts from `initial`. */
	constructor(key?: string, initial?: CharacterDraft) {
		this.#key = key;
		this.#draft = key ? readParsed(key, parseCharacterDraft) : (initial ?? emptyCharacterDraft());
	}

	get current(): CharacterDraft {
		return this.#draft;
	}

	#set(next: CharacterDraft): void {
		this.#draft = next;
		if (this.#key) writeStored(this.#key, next);
	}

	update(change: Partial<CharacterFields>): void {
		this.#set({ ...this.#draft, fields: { ...this.#draft.fields, ...change } });
	}

	/** Clears a field that can be absent (night positions, setup). */
	unset(key: 'firstNight' | 'otherNight' | 'setup'): void {
		const fields = { ...this.#draft.fields };
		delete fields[key];
		this.#set({ ...this.#draft, fields });
	}

	setEditing(savedId: string | undefined): void {
		const next = { ...this.#draft, editing: savedId };
		if (!savedId) delete next.editing;
		this.#set(next);
	}

	replace(draft: CharacterDraft): void {
		this.#set(draft);
	}

	clear(): void {
		this.#set(emptyCharacterDraft());
	}
}

export const characterBuilderDraft = new CharacterBuilderDraft(CHARACTER_DRAFT_KEY);

function newSavedId(): string {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`c${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
	);
}

/** Characters made in the Character builder, on this device. */
class SavedCharacterList {
	#list = $state.raw<SavedCharacter[]>(
		readParsed(SAVED_CHARACTERS_KEY, parseSavedCharacters).characters
	);

	get list(): readonly SavedCharacter[] {
		return this.#list;
	}

	#set(next: SavedCharacter[]): void {
		this.#list = next;
		writeStored(SAVED_CHARACTERS_KEY, { version: SAVED_CHARACTERS_VERSION, characters: next });
	}

	get(savedId: string): SavedCharacter | undefined {
		return this.#list.find((c) => c.savedId === savedId);
	}

	/** Saves over `savedId`, or as a new character; returns the saved id. */
	save(fields: CharacterFields, savedId?: string): string {
		const entry = characterEntry($state.snapshot(fields) as CharacterFields);
		const id = savedId && this.get(savedId) ? savedId : newSavedId();
		const saved: SavedCharacter = { savedId: id, entry, updatedAt: Date.now() };
		this.#set([saved, ...this.#list.filter((c) => c.savedId !== id)]);
		return id;
	}

	remove(savedId: string): void {
		this.#set(this.#list.filter((c) => c.savedId !== savedId));
	}
}

export const savedCharacters = new SavedCharacterList();

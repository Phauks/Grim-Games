/**
 * Badges inside catalog sentences. Character and reminder names never show as plain text
 * (Trevor, 2026-10-16), but catalog text is plain: so the name goes into `t()` as a slot,
 * and the sentence is split back into words and slots for display (`Sentence.svelte`).
 * Translations may move a slot anywhere in their sentence.
 */
const MARK = '';
const SLOT = new RegExp(`${MARK}(\\w+)${MARK}`);

/** A placeholder value for `t()` that `Sentence` (or `splitSlots`) swaps for a badge. */
export function slot(name: string): string {
	return `${MARK}${name}${MARK}`;
}

/** `"a ⟨x⟩ b"` → `["a ", "x", " b"]`: odd entries are slot names. */
export function splitSlots(text: string): string[] {
	return text.split(SLOT);
}

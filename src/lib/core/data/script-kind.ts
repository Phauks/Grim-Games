/**
 * What a pasted, uploaded or linked JSON file holds (Trevor, 2026-10-22, backlog L23):
 * a script, one character, or a character pack. The guess is shown on the add confirmation
 * in a drop-down with its reason, so a wrong guess is one tap to fix
 * (research/json-detection.md, option B with the source's own label first).
 */

export type ScriptKind = 'script' | 'character' | 'collection';

/** Why the guess was made, for the line under the drop-down. */
export type KindReason =
	/** A single `{ }` object with an ability, not a list. */
	| 'single-character'
	/** A list with one homebrew character, no `_meta` and nothing else. */
	| 'one-homebrew'
	/** A list of homebrew characters only, with no `_meta`. */
	| 'only-homebrew'
	/** Anything else: script details, official characters, or a source that lists scripts. */
	| 'script';

export interface KindGuess {
	kind: ScriptKind;
	reason: KindReason;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** A character defined in full (homebrew, or an official one rewritten): it has an ability. */
const isDefined = (entry: unknown): entry is Record<string, unknown> =>
	isObject(entry) && typeof entry.id === 'string' && typeof entry.ability === 'string';

/**
 * Guesses the kind from the JSON alone. A source that only publishes scripts (BotC Scripts,
 * the official lists, Bloodstar's `script.json`) is a script whatever the JSON looks like;
 * the caller passes `scriptSource` for those.
 */
export function guessScriptKind(json: unknown, scriptSource = false): KindGuess {
	const script: KindGuess = { kind: 'script', reason: 'script' };
	if (scriptSource) return script;
	if (isDefined(json)) return { kind: 'character', reason: 'single-character' };
	if (!Array.isArray(json)) return script;
	// Script details, or any character named by id only (an official one), make a script.
	if (json.some((e) => !isDefined(e))) return script;
	if (json.length === 1) return { kind: 'character', reason: 'one-homebrew' };
	if (json.length > 1) return { kind: 'collection', reason: 'only-homebrew' };
	return script;
}
